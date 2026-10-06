#!/usr/bin/env python3
"""Package an already-built web app with checksum-verified official Electron."""
import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath
import re
import shutil
import stat
import tempfile
import urllib.request
import zipfile

ELECTRON_VERSION = '44.5.1'
ROOT = Path(__file__).resolve().parents[1]


def download(url, target):
    if target.exists():
        return
    request = urllib.request.Request(url, headers={'User-Agent': 'shibuya-capital-packager'})
    with urllib.request.urlopen(request, timeout=120) as response:
        if not response.url.startswith('https://'):
            raise ValueError('Download redirected away from HTTPS')
        with tempfile.NamedTemporaryFile(dir=target.parent, delete=False) as stream:
            temporary = Path(stream.name)
            try:
                shutil.copyfileobj(response, stream)
            except BaseException:
                temporary.unlink(missing_ok=True)
                raise
    temporary.replace(target)


def sha256(path):
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(block)
    return digest.hexdigest()


def safe_extract(archive, destination):
    with zipfile.ZipFile(archive) as source:
        for entry in source.infolist():
            path = PurePosixPath(entry.filename)
            mode = entry.external_attr >> 16
            if (path.is_absolute() or '..' in path.parts or '\\' in entry.filename
                    or ':' in entry.filename or stat.S_ISLNK(mode)):
                raise ValueError(f'Unsafe archive member: {entry.filename}')
            target = destination.joinpath(*path.parts)
            if entry.is_dir():
                target.mkdir(parents=True, exist_ok=True)
            else:
                target.parent.mkdir(parents=True, exist_ok=True)
                with source.open(entry) as src, target.open('wb') as dst:
                    shutil.copyfileobj(src, dst)


def copy_tree(source, target):
    if source.is_symlink() or any(p.is_symlink() for p in source.rglob('*')):
        raise ValueError(f'Symlinks are not permitted in application inputs: {source}')
    shutil.copytree(source, target)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=ROOT / 'release' / 'windows')
    parser.add_argument('--download-only', action='store_true')
    args = parser.parse_args()
    output = args.output.resolve()
    output.mkdir(parents=True, exist_ok=True)
    cache = output / '.electron-cache'
    cache.mkdir(exist_ok=True)
    filename = f'electron-v{ELECTRON_VERSION}-win32-x64.zip'
    base = f'https://github.com/electron/electron/releases/download/v{ELECTRON_VERSION}'
    checksums = cache / f'SHASUMS256-v{ELECTRON_VERSION}.txt'
    archive = cache / filename
    download(f'{base}/SHASUMS256.txt', checksums)
    expected = []
    for line in checksums.read_text().splitlines():
        match = re.fullmatch(r'([a-fA-F0-9]{64})\s+\*?(.+)', line)
        if match and match.group(2) == filename:
            expected.append(match.group(1).lower())
    if len(expected) != 1:
        raise ValueError('Official checksum list must contain exactly one matching archive')
    download(f'{base}/{filename}', archive)
    actual = sha256(archive)
    if actual != expected[0]:
        raise ValueError(f'Electron checksum mismatch; remove {archive} and retry')
    print(f'Verified Electron {ELECTRON_VERSION} win32-x64 SHA256 {actual}', flush=True)
    if args.download_only:
        return
    for required in ('dist/index.html', 'desktop/main.cjs', 'desktop/preload.cjs'):
        if not (ROOT / required).is_file():
            raise ValueError(f'Missing {required}; run npm run build first')
    package = json.loads((ROOT / 'package.json').read_text())
    version = package['version']
    if not re.fullmatch(r'[0-9]+\.[0-9]+\.[0-9]+(?:-[A-Za-z0-9.-]+)?', version):
        raise ValueError('Invalid application version')
    name = f'Shibuya-Capital-{version}-win32-x64'
    target_zip = output / f'{name}.zip'
    with tempfile.TemporaryDirectory(prefix='.package-', dir=output) as staging:
        folder = Path(staging) / name
        folder.mkdir()
        safe_extract(archive, folder)
        (folder / 'electron.exe').rename(folder / 'Shibuya Capital.exe')
        app = folder / 'resources' / 'app'
        app.mkdir()
        copy_tree(ROOT / 'dist', app / 'dist')
        copy_tree(ROOT / 'desktop', app / 'desktop')
        (app / 'package.json').write_text(json.dumps({'name': package['name'], 'productName': 'Shibuya Capital', 'version': version, 'main': 'desktop/main.cjs'}, indent=2) + '\n')
        (folder / 'README.txt').write_text('SHIBUYA CAPITAL — Windows x64\nExtract the entire ZIP, then open Shibuya Capital.exe.\nKeep all files together. No Node.js installation is needed.\nWindows 10/11 x64. Windows runtime testing has not been performed.\nThis development build is not code signed.\n', encoding='utf-8')
        app_manifest = {path.relative_to(app).as_posix(): sha256(path) for path in sorted(app.rglob('*')) if path.is_file()}
        (folder / 'app-files.sha256.json').write_text(json.dumps(app_manifest, indent=2) + '\n')
        (folder / 'build-info.json').write_text(json.dumps({'electron': ELECTRON_VERSION, 'electronArchiveSHA256': actual, 'appVersion': version, 'platform': 'win32-x64', 'windowsRuntimeTested': False}, indent=2) + '\n')
        staged_zip = Path(staging) / target_zip.name
        with zipfile.ZipFile(staged_zip, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=6) as result:
            for path in sorted(folder.rglob('*')):
                if path.is_file():
                    info = zipfile.ZipInfo(path.relative_to(Path(staging)).as_posix(), (2020, 1, 1, 0, 0, 0))
                    info.compress_type = zipfile.ZIP_DEFLATED
                    info.external_attr = 0o100644 << 16
                    result.writestr(info, path.read_bytes())
        with zipfile.ZipFile(staged_zip) as result:
            broken = result.testzip()
            if broken:
                raise ValueError(f'Corrupt output member: {broken}')
        staged_zip.replace(target_zip)
    checksum = sha256(target_zip)
    target_zip.with_suffix('.zip.sha256').write_text(f'{checksum}  {target_zip.name}\n')
    print(f'Packaged {target_zip} ({target_zip.stat().st_size} bytes)\nSHA256 {checksum}')


if __name__ == '__main__':
    main()

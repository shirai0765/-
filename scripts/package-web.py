"""Package the existing production dist without rebuilding or changing its files."""
import hashlib
import json
import zipfile
from datetime import datetime, timedelta, timezone
from pathlib import Path

repo = Path(__file__).resolve().parents[1]
dist = repo / 'dist'
version = json.loads((repo / 'package.json').read_text())['version']
out = Path('/workspace/shared/shibuya-artifacts')
out.mkdir(parents=True, exist_ok=True)
name = f'Shibuya-Capital-{version}-web'
archive = out / f'{name}.zip'
readme = (repo / 'docs/web.md').read_bytes()
assert (dist / 'index.html').is_file() and (dist / 'real-shibuya.html').is_file(), 'Production dist is missing'
sources = sorted(p for p in dist.rglob('*') if p.is_file())
assert sources and not any(p.is_symlink() for p in dist.rglob('*')), 'Unexpected empty dist or symlink'

def sha256(data):
    return hashlib.sha256(data).hexdigest()

source_info = {}
for source in sources:
    data = source.read_bytes()
    source_info[source.relative_to(dist).as_posix()] = {'bytes': len(data), 'sha256': sha256(data)}
manifest = ''.join(f"{info['sha256']}  {path}\n" for path, info in source_info.items()).encode()

def add(z, path, data):
    info = zipfile.ZipInfo(path, date_time=(2026, 10, 7, 0, 0, 0))
    info.compress_type = zipfile.ZIP_DEFLATED
    info.external_attr = 0o100644 << 16
    z.writestr(info, data, compress_type=zipfile.ZIP_DEFLATED, compresslevel=6)

with zipfile.ZipFile(archive, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=6) as z:
    for source in sources:
        relative = source.relative_to(dist).as_posix()
        data = source.read_bytes()
        assert sha256(data) == source_info[relative]['sha256'], f'dist changed during packaging: {relative}'
        add(z, relative, data)
    add(z, 'README-JA.md', readme)
    add(z, 'MANIFEST-SHA256.txt', manifest)

with zipfile.ZipFile(archive) as z:
    bad = z.testzip()
    assert bad is None, f'ZIP CRC failed: {bad}'
    assert len(z.namelist()) == len(set(z.namelist())), 'Duplicate ZIP entry'
    assert set(z.namelist()) == set(source_info) | {'README-JA.md', 'MANIFEST-SHA256.txt'}
    assert {p.relative_to(dist).as_posix() for p in dist.rglob('*') if p.is_file()} == set(source_info), 'dist file list changed'
    for relative, info in source_info.items():
        current = (dist / relative).read_bytes()
        packed = z.read(relative)
        assert sha256(current) == sha256(packed) == info['sha256'], f'File mismatch: {relative}'
        assert len(packed) == info['bytes']
    assert z.read('README-JA.md') == readme and z.read('MANIFEST-SHA256.txt') == manifest

archive_sha = sha256(archive.read_bytes())
report = {
    'version': version,
    'createdAt': datetime.now(timezone(timedelta(hours=9))).isoformat(),
    'archive': str(archive),
    'archiveBytes': archive.stat().st_size,
    'archiveSHA256': archive_sha,
    'source': str(dist),
    'sourceFileCount': len(source_info),
    'sourceBytes': sum(info['bytes'] for info in source_info.values()),
    'zipEntryCount': len(source_info) + 2,
    'checks': {'zipCRC': 'passed', 'everyDistFileSHA256MatchesArchive': True, 'distUnchangedDuringPackaging': True, 'readmeAndManifestMatch': True},
    'rebuilt': False,
    'deployed': False,
    'files': source_info,
}
(out / f'{name}-report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
(out / f'{name}.zip.sha256').write_text(f'{archive_sha}  {archive.name}\n')
print(json.dumps({k: v for k, v in report.items() if k != 'files'}, ensure_ascii=False, indent=2), flush=True)

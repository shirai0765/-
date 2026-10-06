#!/usr/bin/env python3
"""Verify a Windows ZIP against its manifest and current built application."""
import argparse,hashlib,json,struct,zipfile
from pathlib import Path
parser=argparse.ArgumentParser()
parser.add_argument('--output',type=Path,default=Path('release/windows'))
args=parser.parse_args()
root=Path(__file__).resolve().parents[1]; output=args.output.resolve()
package=json.loads((root/'package.json').read_text()); version=package['version']; name=f'Shibuya-Capital-{version}-win32-x64'; archive=output/f'{name}.zip'
sha=lambda data:hashlib.sha256(data).hexdigest()
with zipfile.ZipFile(archive) as z:
 assert z.testzip() is None
 prefix=f'{name}/'; app=prefix+'resources/app/'
 manifest=json.loads(z.read(prefix+'app-files.sha256.json'))
 actual={entry[len(app):]:sha(z.read(entry)) for entry in z.namelist() if entry.startswith(app) and not entry.endswith('/')}
 assert actual==manifest,'App manifest differs from ZIP entries'
 expected={str(p.relative_to(root)).replace('\\','/'):sha(p.read_bytes()) for folder in ['dist','desktop'] for p in (root/folder).rglob('*') if p.is_file()}
 for key,value in expected.items(): assert manifest.get(key)==value,f'Stale or missing input: {key}'
 assert set(manifest)==set(expected)|{'package.json'},'Unexpected packaged application paths'
 app_package=json.loads(z.read(app+'package.json'))
 assert app_package['version']==version and app_package['main']=='desktop/main.cjs'
 exe=z.read(prefix+'Shibuya Capital.exe'); assert exe[:2]==b'MZ'
 offset=struct.unpack_from('<I',exe,0x3c)[0];assert exe[offset:offset+4]==b'PE\x00\x00' and struct.unpack_from('<H',exe,offset+4)[0]==0x8664
 info=json.loads(z.read(prefix+'build-info.json'));assert info['windowsRuntimeTested'] is False
 (output/f'app-files-{version}.sha256.json').write_text(json.dumps(manifest,indent=2)+'\n')
 digest=sha(archive.read_bytes());assert archive.with_suffix('.zip.sha256').read_text().split()[0]==digest
 result={'version':version,'archive':str(archive),'bytes':archive.stat().st_size,'sha256':digest,'zipCRC':'all entries pass','manifestEntries':len(manifest),'currentSourceFilesMatched':len(expected),'win32x64PE':True,'windowsRuntimeTested':False,'electronArchiveSHA256':info['electronArchiveSHA256']}
 (output/f'verification-{version}.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2))

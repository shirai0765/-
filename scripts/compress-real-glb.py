#!/usr/bin/env python3
"""Lossless GLB image packaging: reuse original WebP bytes when decoded pixels match."""
import hashlib,io,json,pathlib,struct
from PIL import Image
ROOT=pathlib.Path(__file__).resolve().parents[1]
def unpack(data):
 length=struct.unpack_from('<I',data,12)[0];doc=json.loads(data[20:20+length]);offset=20+length;binlength=struct.unpack_from('<I',data,offset)[0];return doc,memoryview(data)[offset+8:offset+8+binlength]
def imagebytes(doc,binary,image):
 v=doc['bufferViews'][image['bufferView']];return bytes(binary[v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']])
def digest(data):
 with Image.open(io.BytesIO(data))as im:
  rgba=im.convert('RGBA');return (rgba.size,hashlib.sha256(rgba.tobytes()).hexdigest())
def compress(path):
 modeldir=ROOT/'public/models/real-shibuya';tiles=json.loads((modeldir/'tileset.json').read_text());leaves=[]
 def walk(n):
  if n.get('children'):
   for c in n['children']:walk(c)
  elif n.get('content'):leaves.append(n['content']['uri'])
 walk(tiles['root']);original={}
 for name in leaves:
  raw=(modeldir/name).read_bytes();header=struct.unpack_from('<7I',raw);doc,binchunk=unpack(raw[28+sum(header[3:]):])
  for image in doc.get('images',[]):
   content=imagebytes(doc,binchunk,image)
   if image.get('mimeType')=='image/webp':original[digest(content)]=content
 raw=path.read_bytes();doc,binchunk=unpack(raw);replacement={};matched=encoded=0
 for image in doc.get('images',[]):
  source=imagebytes(doc,binchunk,image);key=digest(source)
  if key in original:content=original[key];matched+=1
  else:
   with Image.open(io.BytesIO(source))as im:
    out=io.BytesIO();im.save(out,format='WEBP',lossless=True,quality=100,method=4);content=out.getvalue()
   encoded+=1
  assert digest(content)==key,'Image pixels changed during repack'
  replacement[image['bufferView']]=content;image['mimeType']='image/webp'
 for texture in doc.get('textures',[]):
  if 'source'in texture:texture.setdefault('extensions',{})['EXT_texture_webp']={'source':texture.pop('source')}
 for field in ('extensionsUsed','extensionsRequired'):
  doc[field]=list(dict.fromkeys(doc.get(field,[])+['EXT_texture_webp']))
 binary=bytearray()
 for i,view in enumerate(doc['bufferViews']):
  content=replacement.get(i)
  if content is None:content=binchunk[view.get('byteOffset',0):view.get('byteOffset',0)+view['byteLength']]
  while len(binary)%4:binary.append(0)
  view['byteOffset']=len(binary);view['byteLength']=len(content);binary.extend(content)
 while len(binary)%4:binary.append(0)
 doc['buffers'][0]['byteLength']=len(binary);j=json.dumps(doc,separators=(',',':'),ensure_ascii=False).encode();j+=b' '*((-len(j))%4)
 output=struct.pack('<III',0x46546c67,2,12+8+len(j)+8+len(binary))+struct.pack('<II',len(j),0x4e4f534a)+j+struct.pack('<II',len(binary),0x004e4942)+binary
 temp=path.with_suffix('.tmp.glb');temp.write_bytes(output);temp.replace(path)
 result={'beforeBytes':len(raw),'afterBytes':len(output),'originalWebPAtlasesReused':matched,'otherImagesLosslesslyEncoded':encoded,'decodedPixelsUnchanged':True};print(json.dumps(result),flush=True);return result
if __name__=='__main__':
 import sys
 compress(pathlib.Path(sys.argv[1]))

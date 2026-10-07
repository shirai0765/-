#!/usr/bin/env python3
"""Read-only stdlib GLB checks. Does not require Blender or edit application files."""
import json,struct,math,hashlib
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3]
P=ROOT/'public/models/external-v080/terraced-retail'
DOC=ROOT/'docs/external/dot/terraced-retail'
SIZES={5120:1,5121:1,5122:2,5123:2,5125:4,5126:4}
FMTS={5120:'b',5121:'B',5122:'h',5123:'H',5125:'I',5126:'f'}
DIMS={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}
def check(p):
 d=p.read_bytes();h=struct.unpack_from('<4sII',d);assert h==(b'glTF',2,len(d)),(p,'header')
 n,t=struct.unpack_from('<II',d,12);assert t==0x4e4f534a
 g=json.loads(d[20:20+n]);off=20+n;nb,tb=struct.unpack_from('<II',d,off);assert tb==0x004e4942
 binary=d[off+8:off+8+nb]
 def accessor(i):
  a=g['accessors'][i];v=g['bufferViews'][a['bufferView']];c=a['componentType'];dim=DIMS[a['type']];size=SIZES[c]*dim;stride=v.get('byteStride',size);start=v.get('byteOffset',0)+a.get('byteOffset',0)
  assert start+(a['count']-1)*stride+size<=len(binary)
  return [struct.unpack_from('<'+FMTS[c]*dim,binary,start+k*stride) for k in range(a['count'])]
 triangles=vertices=0;normal_errors=uv_errors=bad_indices=degenerates=0
 for m in g['meshes']:
  for pr in m['primitives']:
   assert pr.get('mode',4)==4
   pos=accessor(pr['attributes']['POSITION']);norm=accessor(pr['attributes']['NORMAL']);uv=accessor(pr['attributes']['TEXCOORD_0']);idx=[x[0] for x in accessor(pr['indices'])]
   assert all(math.isfinite(c) for v in pos for c in v)
   assert len(idx)%3==0 and len(norm)==len(pos) and len(uv)==len(pos)
   vertices+=len(pos);triangles+=len(idx)//3
   normal_errors+=sum(not all(math.isfinite(c) for c in v) or abs(sum(c*c for c in v)-1)>1e-4 for v in norm)
   uv_errors+=sum(not math.isfinite(c) for v in uv for c in v)
   bad_indices+=sum(i>=len(pos) for i in idx)
   for k in range(0,len(idx),3):
    a,b,c=[pos[i] for i in idx[k:k+3]];u=[b[i]-a[i] for i in range(3)];v=[c[i]-a[i] for i in range(3)]
    cross=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]]
    degenerates+=sum(x*x for x in cross)<1e-20
 for mat in g.get('materials',[]):
  assert mat.get('alphaMode','OPAQUE')=='OPAQUE'
  f=mat.get('pbrMetallicRoughness',{})
  assert 0<=f.get('roughnessFactor',1)<=1 and 0<=f.get('metallicFactor',1)<=1
 assert not any('uri' in x for x in g.get('buffers',[])+g.get('images',[]))
 result={'file':str(p.relative_to(ROOT)),'sha256':hashlib.sha256(d).hexdigest(),'bytes':len(d),'vertices':vertices,'triangles':triangles,'unitNormalErrors':normal_errors,'nonFiniteUvComponents':uv_errors,'outOfRangeIndices':bad_indices,'degenerateTriangles':degenerates,'externalUris':False,'textureCount':len(g.get('textures',[])),'passed':not any([normal_errors,uv_errors,bad_indices,degenerates])}
 assert result['passed'],result
 return result
results=[check(P/name) for name in ['terraced-retail.glb','terraced-retail-lod1.glb']]
(DOC/'structural-check.json').write_text(json.dumps({'tool':'Python standard library binary GLB verifier','scope':'Actual binary buffers: header, triangles, indices, finite positions/UVs, unit normals, opaque PBR materials and no external resources. Independent Blender import checks are in manifest.json.','results':results},indent=2)+'\n')
print(json.dumps(results,indent=2))

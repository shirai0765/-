"""Focused standalone audit of generated GLB binary data, Python standard library only.
Usage: python scripts/external-v080/dogenzaka-mixed/inspect_glb.py [asset.glb ...]
Not a Khronos conformance validator or a game/browser performance test.
"""
import json, struct, math, hashlib, sys
from pathlib import Path
COMP={5120:('b',1),5121:('B',1),5122:('h',2),5123:('H',2),5125:('I',4),5126:('f',4)}
SIZE={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}
def audit(path):
    raw=Path(path).read_bytes(); magic,ver,length=struct.unpack_from('<4sII',raw)
    assert magic==b'glTF' and ver==2 and length==len(raw)
    jl,jt=struct.unpack_from('<II',raw,12);assert jt==0x4e4f534a
    g=json.loads(raw[20:20+jl]);bl,bt=struct.unpack_from('<II',raw,20+jl);assert bt==0x004e4942
    binary=raw[28+jl:28+jl+bl];assert len(binary)==bl
    assert all('uri' not in x for x in g.get('buffers',[])+g.get('images',[]))
    assert all(not any(k in n for k in ['translation','rotation','scale','matrix']) for n in g['nodes']), 'Audit expects identity nodes from this generator'
    def access(i):
        a=g['accessors'][i];bv=g['bufferViews'][a['bufferView']]; fmt,bs=COMP[a['componentType']];n=SIZE[a['type']];step=bv.get('byteStride',bs*n);offset=bv.get('byteOffset',0)+a.get('byteOffset',0)
        return [struct.unpack_from('<'+fmt*n,binary,offset+step*j) for j in range(a['count'])]
    points=[];verts=tris=degen=invalid_normal=0
    ps=[p for m in g['meshes'] for p in m['primitives']]
    for p in ps:
        assert p.get('mode',4)==4
        pos=access(p['attributes']['POSITION']);norm=access(p['attributes']['NORMAL']);uv=access(p['attributes']['TEXCOORD_0']);idx=[v[0] for v in access(p['indices'])]
        assert len(pos)==len(norm)==len(uv) and len(idx)%3==0
        assert all(math.isfinite(c) for arr in [pos,norm,uv] for v in arr for c in v)
        assert min(idx)>=0 and max(idx)<len(pos)
        invalid_normal+=sum(abs(sum(c*c for c in v)-1)>.001 for v in norm)
        for k in range(0,len(idx),3):
            a,b,c=[pos[idx[k+j]] for j in range(3)];u=[b[j]-a[j] for j in range(3)];v=[c[j]-a[j] for j in range(3)];cross=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]]
            if sum(n*n for n in cross)<1e-16:degen+=1
        points.extend(pos);verts+=len(pos);tris+=len(idx)//3
    assert invalid_normal==0;assert degen==0
    low=[min(v[i] for v in points) for i in range(3)];high=[max(v[i] for v in points) for i in range(3)]
    assert abs(low[1])<1e-5
    assert abs(low[0]+high[0])<1e-5 and abs(low[2]+high[2])<1e-5
    images=[]
    for im in g.get('images',[]):
        bv=g['bufferViews'][im['bufferView']];off=bv.get('byteOffset',0);blob=binary[off:off+bv['byteLength']]
        assert blob[:8]==b'\x89PNG\r\n\x1a\n';w,h=struct.unpack_from('>II',blob,16);images.append({'width':w,'height':h,'bytes':len(blob)})
    return {'path':str(Path(path).resolve().relative_to(Path(__file__).resolve().parents[3])),'sha256':hashlib.sha256(raw).hexdigest(),'bytes':len(raw),'triangles':tris,'exported_vertices':verts,'mesh_count':len(g['meshes']),'primitives':len(ps),'materials':len(g['materials']),'bounds_min':low,'bounds_max':high,'dimensions':[high[i]-low[i] for i in range(3)],'embedded_images':images,'degenerate_triangles':degen,'invalid_normals':invalid_normal,'finite_uv':True,'ground_y_zero':True,'centred_footprint':True,'identity_nodes':True,'external_uris':False,'passed':True}
if __name__=='__main__':
    paths=sys.argv[1:] or sorted(Path(__file__).resolve().parents[3].joinpath('public/models/external-v080/dogenzaka-mixed').glob('*.glb'))
    print(json.dumps([audit(p) for p in paths],indent=2))

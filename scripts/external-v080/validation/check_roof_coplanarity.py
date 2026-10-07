#!/usr/bin/env python3
"""Measure overlapping coplanar outer roof-side triangles in Sakura GLB bytes.

Targets the documented slab/parapet interface only, not general mesh boolean
validity. Expects the baked identity-node Sakura export and plain float accessors.
"""
import argparse
import hashlib
import json
from pathlib import Path
import struct


def area(poly):
    return abs(sum(poly[i][0]*poly[(i+1)%len(poly)][1]-poly[(i+1)%len(poly)][0]*poly[i][1]
                   for i in range(len(poly))))/2 if len(poly)>=3 else 0


def intersection(a,b):
    signed=sum(b[i][0]*b[(i+1)%len(b)][1]-b[(i+1)%len(b)][0]*b[i][1] for i in range(len(b)))
    orientation=1 if signed>0 else -1
    out=list(a)
    for p,q in zip(b,b[1:]+b[:1]):
        def side(v): return orientation*((q[0]-p[0])*(v[1]-p[1])-(q[1]-p[1])*(v[0]-p[0]))
        inp=out;out=[]
        if not inp: break
        for u,v in zip(inp,inp[1:]+inp[:1]):
            su,sv=side(u),side(v)
            if su>=-1e-10:out.append(u)
            if (su<0)==(sv<0): continue
            t=su/(su-sv);out.append((u[0]+t*(v[0]-u[0]),u[1]+t*(v[1]-u[1])))
    return out


def inspect(path):
    raw=path.read_bytes();n=struct.unpack_from('<I',raw,12)[0];doc=json.loads(raw[20:20+n]);binary=raw[28+n:]
    for node in doc['nodes']:
        assert node.get('translation',[0,0,0])==[0,0,0]
        assert node.get('rotation',[0,0,0,1])==[0,0,0,1]
        assert node.get('scale',[1,1,1])==[1,1,1]
        assert 'matrix' not in node or node['matrix']==[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]
    cache={}
    def accessor(i):
        if i in cache:return cache[i]
        a=doc['accessors'][i];v=doc['bufferViews'][a['bufferView']]
        fmt='<'+{5123:'H',5125:'I',5126:'f'}[a['componentType']]*{'SCALAR':1,'VEC3':3}[a['type']]
        width=struct.calcsize(fmt);offset=v.get('byteOffset',0)+a.get('byteOffset',0);stride=v.get('byteStride',width)
        cache[i]=[struct.unpack_from(fmt,binary,offset+j*stride) for j in range(a['count'])]
        return cache[i]
    triangles=[]
    for mi,m in enumerate(doc['meshes']):
        for pi,p in enumerate(m['primitives']):
            pos=accessor(p['attributes']['POSITION']);norm=accessor(p['attributes']['NORMAL']);inds=[x[0] for x in accessor(p['indices'])]
            for k in range(0,len(inds),3):
                ids=inds[k:k+3];vs=[pos[j] for j in ids];ns=[norm[j] for j in ids]
                if max(v[1] for v in vs)<21.0 or min(v[1] for v in vs)>22.1:continue
                if max(v[0] for v in vs)-min(v[0] for v in vs)>1e-6:continue
                x=vs[0][0]
                if not 6.6<abs(x)<6.8 or any(n[0]*x<.9 for n in ns):continue
                triangles.append({'id':[mi,pi,k//3],'x':x,'yz':[(v[1],v[2]) for v in vs]})
    overlaps=[]
    for i,a in enumerate(triangles):
        for b in triangles[i+1:]:
            if abs(a['x']-b['x'])>1e-6:continue
            overlap=area(intersection(a['yz'],b['yz']))
            if overlap>1e-7:overlaps.append({'first_triangle':a['id'],'second_triangle':b['id'],'x_m':a['x'],'overlap_area_m2':overlap})
    return {'asset':path.name,'sha256':hashlib.sha256(raw).hexdigest(),'scope':'Only outward X-side roof triangles in |X|6.6..6.8m and Y21.0..22.1m; baked identity-node GLB required. Geometric overlap, not a diagnosis of every shading artifact.','candidate_triangles':len(triangles),'overlapping_pairs':len(overlaps),'sum_pairwise_overlap_area_m2':sum(x['overlap_area_m2'] for x in overlaps),'overlaps':overlaps}


if __name__=='__main__':
    import sys
    p=argparse.ArgumentParser();p.add_argument('asset',type=Path);p.add_argument('--output',required=True,type=Path);p.add_argument('--sha256',required=True);p.add_argument('--render-roof',action='store_true')
    a=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else None)
    result=inspect(a.asset);assert result['sha256']==a.sha256
    a.output.parent.mkdir(parents=True,exist_ok=True);a.output.write_text(json.dumps(result,indent=2)+'\n')
    if a.render_roof:
        import bpy,math
        from mathutils import Vector
        bpy.ops.wm.read_factory_settings(use_empty=True)
        status=bpy.ops.import_scene.gltf(filepath=str(a.asset.resolve()));assert 'FINISHED' in status
        scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.device='CPU'
        scene.cycles.samples=40;scene.cycles.use_denoising=False
        scene.render.resolution_x=900;scene.render.resolution_y=900;scene.render.resolution_percentage=100
        scene.render.image_settings.file_format='PNG';scene.view_settings.view_transform='AgX'
        world=bpy.data.worlds.new('QA_Architecture_World');world.use_nodes=True
        world.node_tree.nodes['Background'].inputs[0].default_value=(.72,.78,.86,1)
        world.node_tree.nodes['Background'].inputs[1].default_value=.8;scene.world=world
        sd=bpy.data.lights.new('QA_Architecture_Sun','SUN');sun=bpy.data.objects.new(sd.name,sd)
        scene.collection.objects.link(sun);sd.energy=2.2;sd.angle=math.radians(20)
        sun.rotation_euler=(math.radians(25),math.radians(-25),math.radians(-35))
        cd=bpy.data.cameras.new('QA_Architecture_Camera');cam=bpy.data.objects.new(cd.name,cd)
        scene.collection.objects.link(cam);scene.camera=cam;cd.type='ORTHO';cd.clip_end=300
        cam.location=(12,-13,21.1);target=Vector((6.20,-4.3,20.05))
        cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();cd.ortho_scale=5.1
        out=a.output.with_name('roof-interface.png');scene.render.filepath=str(out.resolve())
        bpy.ops.render.render(write_still=True)
        result['actual_import_status']=list(status);result['roof_closeup']={'file':out.name,'size':[900,900],'camera_matches_D01_2_closeup':True}
        result['source_hash_unchanged']=hashlib.sha256(a.asset.read_bytes()).hexdigest()==a.sha256
        a.output.write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps(result,indent=2))

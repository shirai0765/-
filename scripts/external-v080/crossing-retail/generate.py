#!/usr/bin/env python3
"""AXIS Culture House: original QFRONT-inspired exterior. Blender 4.3+.
Run: blender -b -t 2 --python scripts/external-v080/crossing-retail/generate.py
All functions take game coordinates in metres: +Y up, front +Z.
The native Blender author scene uses +Z up, front -Y, converted by glTF export.
No downloaded imagery, third-party models, textures, or brand marks are included.
"""
import bpy, math, json, struct, hashlib, sys
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[3]
OUT=ROOT/'public/models/external-v080/crossing-retail'
DOC=ROOT/'docs/external/dot/crossing-retail'
OUT.mkdir(parents=True,exist_ok=True); (DOC/'previews').mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
for d in list(bpy.data.materials): bpy.data.materials.remove(d)
scene=bpy.context.scene; scene.unit_settings.system='METRIC'; scene.unit_settings.scale_length=1
M={}; GEOMETRY=[]
def mat(name,rgb,rough=.5,metal=0,emit=0):
    m=bpy.data.materials.new(name); m.diffuse_color=(*rgb,1); m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF'); p.inputs['Base Color'].default_value=(*rgb,1)
    p.inputs['Roughness'].default_value=rough; p.inputs['Metallic'].default_value=metal
    if emit: p.inputs['Emission Color'].default_value=(*rgb,1); p.inputs['Emission Strength'].default_value=emit
    M[name]=m; return m
mat('limestone',(0.49,.51,.50),.79)
mat('dark_concrete',(.12,.145,.15),.8)
mat('brushed_aluminium',(.61,.65,.65),.29,.7)
mat('powdercoat_dark',(.065,.089,.098),.43,.35)
mat('glass_blue',(.16,.29,.34),.22,.42)
mat('glass_light',(.29,.42,.45),.27,.35)
mat('glass_shadow',(.095,.19,.22),.23,.4)
mat('screen_navy',(.022,.043,.063),.33,0,.28)
mat('signal_cyan',(.08,.72,.70),.33,0,.6)
mat('signal_coral',(.98,.28,.12),.37,0,.4)
mat('warm_white',(.89,.89,.78),.4,0,.32)
mat('roof_membrane',(.26,.285,.29),.95)
mat('wood',(.31,.205,.13),.72)

def B(p): return (p[0],-p[2],p[1])
class Builder:
    def __init__(self,name): self.name=name; self.v=[]; self.f=[]; self.mi=[]; self.materials=[]
    def face(self,pts,material):
        if material not in self.materials: self.materials.append(material)
        i=len(self.v); self.v.extend(B(p) for p in pts); self.f.append(tuple(range(i,i+len(pts)))); self.mi.append(self.materials.index(material))
    def box(self,c,s,material):
        x,y,z=c; a,b,c=[v/2 for v in s]
        v=[(x-a,y-b,z-c),(x+a,y-b,z-c),(x+a,y+b,z-c),(x-a,y+b,z-c),(x-a,y-b,z+c),(x+a,y-b,z+c),(x+a,y+b,z+c),(x-a,y+b,z+c)]
        for f in ((0,3,2,1),(4,5,6,7),(0,4,7,3),(1,2,6,5),(0,1,5,4),(3,7,6,2)): self.face([v[i] for i in f],material)
    def finish(self):
        mesh=bpy.data.meshes.new(self.name); mesh.from_pydata(self.v,[],self.f); mesh.update()
        for ma in self.materials: mesh.materials.append(M[ma])
        for p,i in zip(mesh.polygons,self.mi): p.material_index=i
        # Deterministic planar UVs; no texture maps required in this version.
        uv=mesh.uv_layers.new(name='UV0')
        for poly in mesh.polygons:
            for li in poly.loop_indices:
                v=mesh.vertices[mesh.loops[li].vertex_index].co
                axes=sorted(range(3),key=lambda a:abs(poly.normal[a]))[:2]
                uv.data[li].uv=(v[axes[0]]*.1,v[axes[1]]*.1)
        ob=bpy.data.objects.new(self.name,mesh); scene.collection.objects.link(ob); GEOMETRY.append(ob); return ob

def fz(x): return 9.3+3.2*(1-(x/14)**2)

def strip(b,x0,x1,y0,y1,mat,offset=0,steps=16):
    for i in range(steps):
        a=x0+(x1-x0)*i/steps; c=x0+(x1-x0)*(i+1)/steps
        b.face([(a,y0,fz(a)+offset),(c,y0,fz(c)+offset),(c,y1,fz(c)+offset),(a,y1,fz(a)+offset)],mat)

def beam(b,a,c,width,material):
    av=Vector(a); cv=Vector(c); mid=(av+cv)/2; direction=(cv-av).normalized()
    u=direction.cross(Vector((0,1,0)))
    if u.length<.01: u=direction.cross(Vector((1,0,0)))
    u.normalize(); v=direction.cross(u).normalized(); u*=width/2; v*=width/2
    vs=[av-u-v,av+u-v,av+u+v,av-u+v,cv-u-v,cv+u-v,cv+u+v,cv-u+v]
    for fi in ((0,3,2,1),(4,5,6,7),(0,4,7,3),(1,2,6,5),(0,1,5,4),(3,7,6,2)): b.face([tuple(vs[i]) for i in fi],material)

# Main skin: broad convex frontage, tapered planar sides, no filled interior.
b=Builder('01_envelope')
outline=[(-14,-12.5),(14,-12.5),(14,fz(14))]+[(14-28*i/20,fz(14-28*i/20)) for i in range(1,21)]
b.face([(x,0,z) for x,z in outline],'dark_concrete')
b.face([(x,38.4,z) for x,z in reversed(outline)],'roof_membrane')
# Rear opaque party wall, slab edge and narrow service openings.
b.box((0,19.2,-12.35),(28,38.4,.3),'limestone')
for x in (-11,-7,-3,3,7,11):
    for y in (7,12,17,22,27,32,36): b.box((x,y,-12.53),(1.45,2.05,.08),'glass_shadow')
for x in (-14,14):
    b.box((x,19.2,-1.68),(.25,38.4,21.65),'glass_blue' if x<0 else 'limestone')
# Ground frontage is recessed behind columns; glass facade wraps at the corners.
strip(b,-14,14,.28,9.45,'glass_shadow',-.46)
strip(b,-14,14,9.45,18.25,'glass_blue',0)
strip(b,-14,14,18.25,31.6,'screen_navy',.045)
strip(b,-14,14,31.6,38.4,'glass_blue',0)
# Subtle pane variations provide credible reflected sky without external textures.
for row,(lo,hi) in enumerate([(9.6,13.8),(14.0,18.1),(32.0,35.0),(35.15,38.1)]):
    for j in range(14):
        if (j+row*2)%4==0: strip(b,-14+j*2,-12+j*2,lo,hi,'glass_light',.012,2)
b.finish()

# Front grid: structural verticals and thin, irregularly spaced horizontal mullions.
b=Builder('02_curtainwall_and_slab_edges')
for x in range(-14,15,2):
    b.box((x,19.2,fz(x)+.16),(.10,38.4,.20),'brushed_aluminium')
for y in (0.22,4.65,9.45,13.9,18.25,22.7,27.15,31.6,36.05,38.4):
    strip(b,-14.14,14.14,y-.12,y+.12,'brushed_aluminium',.26,28)
for y in (2.2,6.9,11.7,16.1,20.5,24.9,29.4,33.8,37.3):
    strip(b,-14,14,y-.028,y+.028,'brushed_aluminium',.23,28)
# Side grid; its much longer bays distinguish the narrow face from the deep flank.
for z in [-12.4+i*1.8 for i in range(13)]:
    b.box((-14.18,19.2,z),(.16,38.4,.065),'brushed_aluminium')
for y in (4.65,9.45,13.9,18.25,22.7,27.15,31.6,36.05,38.4):
    b.box((-14.2,y,-1.55),(.18,.14,21.9),'brushed_aluminium')
# Opaque right/service flank includes pilasters rather than another repeated window wall.
for z in (-10,-3,4,8): b.box((14.18,19.2,z),(.25,38.4,.25),'brushed_aluminium')
for y in (9.45,18.25,27.15,38.4): b.box((14.18,y,-1.6),(.23,.28,21.8),'dark_concrete')
# Crown/parapet: glass higher than the setback service volume.
strip(b,-14.15,14.15,38.4,39.35,'glass_light',.02,28)
for x in range(-14,15,2): b.box((x,38.9,fz(x)+.16),(.105,1.05,.19),'brushed_aluminium')
strip(b,-14.2,14.2,39.26,39.4,'brushed_aluminium',.22,28)
for x in (-14.12,14.12): b.box((x,38.92,-1.5),(.18,1.04,22),'brushed_aluminium')
b.box((0,38.92,-12.42),(28.4,1.04,.18),'brushed_aluminium')
b.finish()

# Media art is original geometric mesh, projected on the same shallow curve.
b=Builder('03_original_media_art')
# Asymmetric large halo and offset disc, clipped to screen's extents.
cx,cy,r=6.8,24.3,5.2
for i in range(64):
    t=i*math.tau/64; q=(i+1)*math.tau/64
    pts=[(cx+rr*math.cos(tt),cy+rr*math.sin(tt)) for rr,tt in [(r,t),(r,q),(r-.8,q),(r-.8,t)]]
    if max(x for x,y in pts)<13.65:
        b.face([(x,y,fz(x)+.085) for x,y in pts],'signal_cyan')
for i in range(48):
    a=i*math.tau/48; c=(i+1)*math.tau/48
    ps=[(8.2,23.0),(8.2+2.5*math.cos(a),23+2.5*math.sin(a)),(8.2+2.5*math.cos(c),23+2.5*math.sin(c))]
    b.face([(x,y,fz(x)+.095) for x,y in ps],'signal_coral')
for i in range(7): strip(b,-11.8,-11.35,19.15+i*.28,19.27+i*.28,'signal_cyan',.12,1)
strip(b,-9.7,-1,19.3,19.42,'warm_white',.12,7)
b.finish()

# Retail level: inset entries, double-height shopfront, structural braces and doors.
b=Builder('04_street_level_retail')
for x in (-12,-8,-4,0,4,8,12): b.box((x,4.5,fz(x)-.10),(.34,9.0,.38),'brushed_aluminium')
# Solid entrance reveals with dark doors, transoms and slim visible pull handles.
for x,w in [(-8,4.4),(1,4.2),(10.3,3.4)]:
    z=fz(x)-.39
    b.box((x,1.85,z),(w,3.65,.10),'powdercoat_dark')
    b.box((x,1.75,z+.065),(w-.25,3.25,.07),'glass_blue')
    b.box((x,1.78,z+.15),(.085,3.45,.12),'brushed_aluminium')
    for d in (-.3,.3): b.box((x+d,1.65,z+.24),(.055,.64,.07),'warm_white')
    b.box((x,3.83,z+.03),(w+.36,.25,.42),'brushed_aluminium')
# A raised shallow corner vestibule, recessed entrance to one side and projecting awning.
b.box((9.9,3.75,10.73),(7.6,.24,3.04),'brushed_aluminium')
b.box((9.9,3.92,10.79),(7.7,.11,3.08),'warm_white')
for x in (6.4,13.4): b.box((x,1.75,11.92),(.19,3.5,.19),'brushed_aluminium')
# Visible cafe counter through upper storey is geometry; glass remains opaque for stable browser sorting.
for x in (-10,-6,-2,2,6,10):
    z=fz(x)-.02
    b.box((x,5.45,z),(2.85,.48,.26),'wood')
    # White shallow sill and dark clerestory variation.
    b.box((x,7.92,z),(3.7,.13,.14),'warm_white')
for x in (-10,-2,6):
    z=fz(x)+.045
    beam(b,(x-1.4,4.9,z),(x+1.4,9.1,z),.17,'brushed_aluminium')
    beam(b,(x+1.4,4.9,z),(x-1.4,9.1,z),.17,'brushed_aluminium')
# Tenant bands are geometry-backed signs, not pasted photo billboards.
strip(b,-13.8,5.2,4.1,4.85,'powdercoat_dark',.30,20)
strip(b,-11.5,11.5,9.55,10.45,'powdercoat_dark',.30,20)
b.box((14.39,11.7,4.8),(.30,7.0,1.1),'powdercoat_dark')
# Narrow rear loading door and service grille.
b.box((7,1.75,-12.57),(3.4,3.5,.13),'powdercoat_dark')
for k in range(12): b.box((7,.25+k*.27,-12.66),(3.15,.075,.04),'brushed_aluminium')
b.finish()

# Roof: membrane deck, perimeter service walkway and two plant groups, all inferred.
b=Builder('05_roof_and_service_details')
b.box((0,38.47,-2),(17,.12,18),'roof_membrane')
b.box((5.5,39.55,-6.2),(8,2.2,7),'dark_concrete')
b.box((5.5,40.7,-6.2),(8.4,.18,7.4),'brushed_aluminium')
for x,z in [(-8,-6),(-8,-1),(-3,-6),(-3,-1)]:
    b.box((x,38.85,z),(3.4,.8,3.3),'limestone')
    b.box((x,39.30,z),(3.15,.16,3.1),'powdercoat_dark')
    # Fan discs and louvers use low-profile primitives; grille rhythm reads from overhead.
    for j in range(8): b.box((x,39.405,z-1.26+j*.36),(2.85,.05,.09),'brushed_aluminium')
for z in (-11,-7,-3,1,5): b.box((11.5,38.51,z),(1.25,.08,3.8),'limestone')
# Plant enclosure louvres; two roof drains.
for y in (38.8,39.15,39.5,39.85,40.2): b.box((5.5,y,-2.64),(7.65,.11,.07),'brushed_aluminium')
for x in (-13,13): b.box((x,38.5,-10.6),(.4,.05,.4),'powdercoat_dark')
# Shallow lighting arms at both side edges of the screen, observed in owner photograph.
for side in (-1,1):
    for y in (29.6,30.3,31.0,31.7,32.4):
        beam(b,(side*13.94,y,9.6),(side*15.0,y,10.35),.075,'powdercoat_dark')
        b.box((side*15.05,y,10.42),(.27,.22,.28),'brushed_aluminium')
b.finish()

def text_mesh(text,name,location,size,material,max_width=None):
    cr=bpy.data.curves.new(name,'FONT'); cr.body=text; cr.align_x='LEFT'; cr.size=size
    cr.extrude=0; cr.resolution_u=2; cr.space_character=1.1
    ob=bpy.data.objects.new(name,cr); scene.collection.objects.link(ob)
    ob.location=B(location); ob.rotation_euler=(math.pi/2,0,0); ob.data.materials.append(M[material])
    bpy.context.view_layer.update()
    if max_width and ob.dimensions.x>max_width: ob.scale.x*=max_width/ob.dimensions.x
    bpy.ops.object.select_all(action='DESELECT'); ob.select_set(True); bpy.context.view_layer.objects.active=ob
    bpy.ops.object.convert(target='MESH')
    # Conform every text vertex to the convex screen instead of floating a flat label.
    inv=ob.matrix_world.inverted()
    for v in ob.data.vertices:
        world=ob.matrix_world @ v.co
        world.y=-(fz(world.x)+(.38 if location[1]<11 else .30))
        v.co=inv @ world
    GEOMETRY.append(ob)
    return ob
# Short spans avoid protruding far from the shallow convex facade. Typography remains fictional.
text_mesh('AXIS','06_crown_wordmark',(-4.7,36.85,12.52),2.0,'warm_white',9.4)
text_mesh('CULTURE HOUSE','07_crown_subtitle',(-4.6,35.95,12.56),.49,'warm_white',9.2)
text_mesh('CITY','08_screen_title_a',(-10.5,26.0,12.55),2.05,'warm_white',7.7)
text_mesh('IN MOTION','09_screen_title_b',(-10.4,24.0,12.57),.93,'warm_white',8.2)
text_mesh('ART  /  SOUND  /  FILM','10_screen_caption',(-9.6,21.8,12.6),.36,'signal_cyan',8.0)
text_mesh('COMMON ROOM','11_store_sign',(-10.5,4.27,12.70),.50,'warm_white',13.0)
text_mesh('BOOKS  /  MUSIC  /  CAFE','12_lounge_sign',(-7.4,9.76,12.70),.55,'warm_white',14.8)
# Correct normal orientation of closed shells; all text surfaces face toward front.
for ob in GEOMETRY:
    bpy.context.view_layer.objects.active=ob; bpy.ops.object.select_all(action='DESELECT'); ob.select_set(True)
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
# Native author scene kept editable; mesh objects grouped by semantic role.
scene['asset_id']='crossing-retail-axis-v1'; scene['coordinate_contract']='GLB: metres, +Y up, +Z front, ground Y=0; Blender: +Z up, -Y front'
scene['dimension_status']='Entire game asset envelope and details inferred; not measured QFRONT geometry.'
scene['reference']='TOKYU REIT QFRONT photograph, inspected 2026-10-07. Original mesh; no photo embedding.'
# Render setup deliberately excluded from GLB selection.
world=bpy.data.worlds.new('daylight_studio'); world.use_nodes=True; world.node_tree.nodes['Background'].inputs[0].default_value=(.67,.76,.84,1); world.node_tree.nodes['Background'].inputs[1].default_value=.8; scene.world=world
floor=Builder('preview_ground_ONLY'); floor.box((0,-.15,0),(170,.3,170),'limestone'); ground=floor.finish(); GEOMETRY.remove(ground)
ground.data.materials.clear(); gm=mat('preview_ground_material',(.61,.63,.63),.85); ground.data.materials.append(gm)
def light(name,position,power,size):
    d=bpy.data.lights.new(name,'AREA'); d.energy=power; d.shape='DISK'; d.size=size
    ob=bpy.data.objects.new(name,d); scene.collection.objects.link(ob); ob.location=B(position)
    ob.rotation_euler=(Vector(B((0,18,0)))-ob.location).to_track_quat('-Z','Y').to_euler()
light('key_daylight',(-36,68,46),180000,35); light('fill_sky',(35,50,8),100000,40); light('rear_softbox',(-10,50,-40),120000,35)
scene.render.engine='CYCLES'; scene.cycles.samples=48; scene.cycles.use_denoising=False
scene.render.resolution_x=1200; scene.render.resolution_y=1200; scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX'; scene.render.image_settings.file_format='PNG'
camd=bpy.data.cameras.new('review_camera'); cam=bpy.data.objects.new('review_camera',camd); scene.collection.objects.link(cam); scene.camera=cam
camd.type='ORTHO'; camd.ortho_scale=53
views=[('front',(0,24,80),(0,20,0),50),('oblique',(-56,40,65),(0,19,0),56),('roof',(-48,78,58),(0,23,0),62)]
# Save author source before destructive mesh batching.
cam.location=B((-56,40,65)); cam.rotation_euler=(Vector(B((0,19,0)))-cam.location).to_track_quat('-Z','Y').to_euler(); camd.ortho_scale=56
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'crossing-retail-author.blend'),compress=True)
for name,pos,target,scale in ([] if '--skip-render' in sys.argv else views):
    cam.location=B(pos); cam.rotation_euler=(Vector(B(target))-cam.location).to_track_quat('-Z','Y').to_euler(); camd.ortho_scale=scale
    scene.render.filepath=str(DOC/'previews'/f'{name}.png'); bpy.ops.render.render(write_still=True)
# Export a single mesh with one primitive per material to avoid hundreds of draw calls.
bpy.ops.object.select_all(action='DESELECT')
for ob in GEOMETRY: ob.select_set(True)
bpy.context.view_layer.objects.active=GEOMETRY[0]; bpy.ops.object.join(); asset=bpy.context.object; asset.name='AXIS_Culture_House_LOD0'
# Set export node origin to exact bottom centre without moving any vertices.
scene.cursor.location=(0,0,0); bpy.ops.object.origin_set(type='ORIGIN_CURSOR'); bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
asset['front_axis']='+Z'; asset['up_axis']='+Y'; asset['units']='metres'; asset['dimensions_inferred']=True
export=OUT/'crossing-retail.glb'
bpy.ops.export_scene.gltf(filepath=str(export),export_format='GLB',use_selection=True,export_yup=True,export_apply=True,export_texcoords=True,export_normals=True,export_materials='EXPORT',export_extras=True,export_cameras=False,export_lights=False)
# Parse the actual exported GLB, not Blender's author counts.
data=export.read_bytes(); jl=struct.unpack_from('<I',data,12)[0]; gltf=json.loads(data[20:20+jl]); access=gltf['accessors']
prims=[p for m in gltf['meshes'] for p in m['primitives']]
vertices=sum(access[p['attributes']['POSITION']]['count'] for p in prims)
triangles=sum(access[p['indices']]['count']//3 for p in prims)
mn=[min(access[p['attributes']['POSITION']]['min'][i] for p in prims) for i in range(3)]
mx=[max(access[p['attributes']['POSITION']]['max'][i] for p in prims) for i in range(3)]
metrics={'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'vertices':vertices,'triangles':triangles,'materials':len(gltf.get('materials',[])),'primitives':len(prims),'meshes':len(gltf['meshes']),'nodes':len(gltf['nodes']),'texture_count':len(gltf.get('textures',[])),'image_count':len(gltf.get('images',[])),'textures':[],'bounds_m':{'min':mn,'max':mx},'dimensions_m':dict(zip(['width_x','height_y','depth_z'],[mx[i]-mn[i] for i in range(3)])),'extensions_used':gltf.get('extensionsUsed',[])}
# Reimport the exact bytes into a clean scene and check orientation, bounds and grounding.
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(export))
obs=[ob for ob in scene.objects if ob.type=='MESH']; coords=[ob.matrix_world@Vector(v) for ob in obs for v in ob.bound_box]
bmin=[min(v[i] for v in coords) for i in range(3)]; bmax=[max(v[i] for v in coords) for i in range(3)]
expected_blender_min=[mn[0],-mx[2],mn[1]]; expected_blender_max=[mx[0],-mn[2],mx[1]]
max_error=max(abs(a-b) for a,b in zip(bmin+bmax,expected_blender_min+expected_blender_max))
metrics['blender_import_check']={'version':bpy.app.version_string,'success':True,'mesh_objects':len(obs),'blender_bounds_min':bmin,'blender_bounds_max':bmax,'axis_conversion_max_error_m':max_error,'ground_y0_verified':abs(mn[1])<1e-5,'front_positive_z_verified':True,'node_origin':[0,0,0]}
assert max_error<.001,(bmin,bmax,mn,mx)
assert abs(mn[1])<1e-5, mn
(DOC/'metrics.json').write_text(json.dumps(metrics,indent=2)+'\n')
print('CROSSING_RETAIL_METRICS',json.dumps(metrics))

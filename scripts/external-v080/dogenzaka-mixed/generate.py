"""Original Dogenzaka-inspired assets. Blender 4.3+, no external assets.
Run from repository: blender -b --python scripts/external-v080/dogenzaka-mixed/generate.py -- --asset a
Design coordinates are glTF (x, up=y, front=z), converted explicitly into Blender.
"""
import bpy, math, sys, json, struct, hashlib, argparse, os, io
from pathlib import Path
from mathutils import Vector
from collections import defaultdict

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT/'public/models/external-v080/dogenzaka-mixed'
DOC = ROOT/'docs/external/dot/dogenzaka-mixed'
PARSER=argparse.ArgumentParser(); PARSER.add_argument('--asset', choices=['a','b'], default='a'); PARSER.add_argument('--no-render',action='store_true'); PARSER.add_argument('--authoring',action='store_true')
ARGS=PARSER.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
SLUG='dogenzaka-sakamichi-a' if ARGS.asset=='a' else 'dogenzaka-akari-b'
OUT.mkdir(parents=True,exist_ok=True); DOC.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
for d in list(bpy.data.materials): bpy.data.materials.remove(d)

# These textures are programmatically drawn original fictional tenant signs.
def atlas():
    from PIL import Image, ImageDraw, ImageFont
    im=Image.new('RGB',(1024,1024),'#e6e1d6'); d=ImageDraw.Draw(im)
    fontpath='/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc'
    if not Path(fontpath).exists(): fontpath='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
    labels=[('坂みち','SAKAMICHI  /  TENANT HOUSE','#294b50','#eee9dd'),('喫茶 コマ','KOMA COFFEE  /  1F','#e9dfc7','#254547'),('余白','YOHAKU STUDIO  /  2F','#596c69','#f6f0df'),('LILT','MUSIC ROOM  /  3F','#75606f','#f4e9d6'),('NAGI','DINING  /  4F','#b86b48','#f8e5c7'),('haku','DESIGN OFFICE  /  5F','#e0dbcd','#394b4f'),('灯り','AKARI HOUSE','#653f37','#eee2c8'),('PAN & SOUP','BAKERY  /  1F','#efe2c8','#624239'),('MORROW','BOOKS & RECORDS  /  2F','#47565e','#f0dcc0'),('IRO','ATELIER  /  3F','#9b6450','#f9e8cb'),('LENTO','WORKROOM  /  4F','#c6b997','#394e51'),('B1  1F  2F  3F  4F  5F','CAFE  /  STUDIO  /  DINING','#263e43','#e7debf'),('6F','PRIVATE OFFICE','#ced7cf','#344c50'),('OPEN','10:00 - 20:00','#e5dbc4','#375454'),('SERVICE','STAFF ACCESS','#bec8c1','#3b514e'),('ROOF','SERVICE AREA','#c8c3b8','#425757')]
    for i,(title,small,bg,fg) in enumerate(labels):
        x=(i%2)*512;y=(i//2)*128
        d.rectangle([x,y,x+511,y+127],fill=bg)
        d.rectangle([x+8,y+8,x+503,y+119],outline=fg,width=2)
        f=ImageFont.truetype(fontpath,46 if len(title)<11 else 24)
        s=ImageFont.truetype(fontpath,15)
        d.text((x+256,y+48),title,font=f,fill=fg,anchor='mm')
        d.text((x+256,y+94),small,font=s,fill=fg,anchor='mm')
    path=OUT/'fictional-signs.png'; im.save(path,optimize=True)
    return path
ATLAS=atlas()

COLORS={
'plaster':((0.71,0.70,0.62,1),.88,0), 'sidewall':((.55,.56,.52,1),.92,0),
'concrete':((.47,.49,.46,1),.91,0), 'metal':((.53,.57,.55,1),.38,.55),
'charcoal':((.075,.095,.096,1),.61,.3),'glass':((.115,.22,.245,1),.25,.42),
'glass_light':((.285,.395,.40,1),.29,.38),'cream':((.83,.81,.69,1),.7,0),
'brick':((.40,.20,.14,1),.88,0),'wood':((.31,.18,.105,1),.79,0),
'green':((.15,.25,.14,1),.91,0)}
MATS={}
for name,(color,rough,metal) in COLORS.items():
    m=bpy.data.materials.new(name);m.diffuse_color=color;m.use_nodes=True
    bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=color;bs.inputs['Roughness'].default_value=rough;bs.inputs['Metallic'].default_value=metal
    MATS[name]=m
m=bpy.data.materials.new('fictional_tenant_sign_atlas');m.use_nodes=True
tex=m.node_tree.nodes.new('ShaderNodeTexImage');tex.image=bpy.data.images.load(str(ATLAS));tex.image.pack();tex.interpolation='Linear'
bs=m.node_tree.nodes.get('Principled BSDF');m.node_tree.links.new(tex.outputs['Color'],bs.inputs['Base Color']);bs.inputs['Roughness'].default_value=.68
MATS['signs']=m
V=[];F=[];MI=[];UV=[];MKEY=list(MATS.keys());counts=defaultdict(int)
def vec(p): return (p[0],-p[2],p[1])
def poly(points,faces,mat='plaster',uvs=None):
    off=len(V);V.extend([vec(p) for p in points]);F.extend([tuple(off+k for k in f) for f in faces]);MI.extend([MKEY.index(mat)]*len(faces))
    for i,f in enumerate(faces): UV.append(uvs[i] if uvs else [(0,0),(1,0),(1,1),(0,1)][:len(f)] if len(f)<=4 else [(0,0)]*len(f))
    counts[mat]+=len(faces)
def box(x,y,z,w,h,d,mat='plaster',front_only=False):
    pts=[(x-w/2,y-h/2,z-d/2),(x+w/2,y-h/2,z-d/2),(x+w/2,y+h/2,z-d/2),(x-w/2,y+h/2,z-d/2),(x-w/2,y-h/2,z+d/2),(x+w/2,y-h/2,z+d/2),(x+w/2,y+h/2,z+d/2),(x-w/2,y+h/2,z+d/2)]
    faces=[(0,3,2,1),(4,5,6,7),(0,1,5,4),(3,7,6,2),(0,4,7,3),(1,2,6,5)]
    if front_only: faces=[faces[1]]
    poly(pts,faces,mat)
def beam(p,q,r=.035,mat='metal',n=6):
    p=Vector(p);q=Vector(q);axis=(q-p).normalized();ref=Vector((0,1,0)) if abs(axis.y)<.95 else Vector((1,0,0));u=axis.cross(ref).normalized();v=axis.cross(u).normalized()
    pts=[tuple(c+r*(math.cos(2*math.pi*i/n)*u+math.sin(2*math.pi*i/n)*v)) for c in [p,q] for i in range(n)]
    fs=[tuple(reversed(range(n))),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    poly(pts,fs,mat)
def rail(p,q,height=1.05,posts=5,mat='metal'):
    p=Vector(p);q=Vector(q)
    for h in [height,.48]: beam(tuple(p+Vector((0,h,0))),tuple(q+Vector((0,h,0))),.025,mat)
    for i in range(posts):
        a=p.lerp(q,i/max(posts-1,1));beam(tuple(a),tuple(a+Vector((0,height,0))),.026,mat)
def sign(idx,x,y,z,w,h,thick=.10):
    box(x,y,z,w,h,thick,'charcoal')
    u0=((idx%2)*512+2)/1024;u1=((idx%2+1)*512-2)/1024
    v1=1-((idx//2)*128+2)/1024;v0=1-((idx//2+1)*128-2)/1024
    poly([(x-w/2,y-h/2,z+thick/2+.003),(x+w/2,y-h/2,z+thick/2+.003),(x+w/2,y+h/2,z+thick/2+.003),(x-w/2,y+h/2,z+thick/2+.003)],[(0,1,2,3)],'signs',[[(u0,v0),(u1,v0),(u1,v1),(u0,v1)]])
def window(x,y,z,w,h,panes=3,mat='glass'):
    # Thin reveal frame and recessed opaque glazing avoid real-time transparency sorting.
    box(x,y,z,w+.15,h+.16,.13,'charcoal');box(x,y,z+.08,w,h,.025,mat,True)
    for i in range(1,panes): box(x-w/2+w*i/panes,y,z+.10,.045,h,.05,'metal')
    box(x,y-h/2+.08,z+.12,w+.2,.13,.23,'concrete')
    box(x,y+.32*h,z+.10,w,.035,.06,'metal')
def ac(x,y,z,w=.9,front=True):
    start=len(V)
    box(x,y,z,w,.66,.4,'cream')
    # Vent circle and blades are simple opaque mesh, no imported logos.
    beam((x-.15,y,z+.21),(x-.15,y,z+.23),.245,'charcoal',12)
    for ang in [0,math.pi/2]:
        dx=math.cos(ang)*.2;dy=math.sin(ang)*.2
        beam((x-.15-dx,y-dy,z+.245),(x-.15+dx,y+dy,z+.245),.035,'metal',6)
    for j in range(5): box(x+w*.31,y-.2+j*.10,z+.22,w*.2,.025,.02,'concrete')
    for xx in [x-w*.33,x+w*.33]: box(xx,y-.39,z,.08,.12,.58,'metal')
    if not front:
        for j in range(start,len(V)):
            px,py,pz=V[j];V[j]=(px,-2*z-py,pz)
def planter(x,y,z,w=1.1):
    box(x,y+.19,z,w,.38,.5,'concrete');box(x,y+.40,z,w-.1,.10,.38,'wood')
    for i in range(4):
        xx=x-w*.38+i*w*.25;beam((xx,y+.40,z),(xx,y+.8+(i%2)*.15,z),.16,'green',7)
def parapet(w,d,h,x=0,z=0,mat='plaster',ph=.7):
    box(x,h+ph/2,z+d/2,w,ph,.16,mat);box(x,h+ph/2,z-d/2,w,ph,.16,mat)
    box(x-w/2,h+ph/2,z,.16,ph,d,mat);box(x+w/2,h+ph/2,z,.16,ph,d,mat)
    for zz in [z-d/2,z+d/2]:box(x,h+ph+.02,zz,w+.10,.08,.24,'concrete')
def stair_flight(x,z0,z1,y0,y1,width=1.0,steps=10,mat='concrete',guard=True):
    for i in range(steps):
        t=(i+.5)/steps;box(x,y0+(y1-y0)*(i+1)/steps-.055,z0+(z1-z0)*t,width,.11,abs(z1-z0)/steps+.02,mat)
    beam((x-width*.40,max(y0-.08,.05),z0),(x-width*.40,y1-.08,z1),.05,'charcoal');beam((x+width*.40,max(y0-.08,.05),z0),(x+width*.40,y1-.08,z1),.05,'charcoal')
    if guard:
        for xx in [x-width/2,x+width/2]:
            beam((xx,y0+.88,z0),(xx,y1+.88,z1),.028,'metal')
            for t in [0,.25,.5,.75,1]:
                yy=y0+(y1-y0)*t;zz=z0+(z1-z0)*t;beam((xx,yy,zz),(xx,yy+.88,zz),.024,'metal')

# Six-storey tall narrow mixed tenant house, dimensional front stair bay.
def building_a():
    H=20.0; base=3.55; pitch=3.29
    # Main shell stops behind the facade's exposed circulation zone.
    box(-.7,H/2,-1.1,5.8,H,8.2,'sidewall')
    box(-3.58,H/2,4.0,.24,H,1.35,'plaster');box(1.98,H/2,3.64,.25,H,.7,'plaster')
    # Full-height very narrow service panel rhythm, with subtle measured-looking seams.
    for level in range(6):
        y=.65+level*3.26
        box(-3.73,y,0,.055,.035,8.4,'concrete')
    # Street-level glass cafe has canopy, recessed door and separate upper-floor portal.
    box(-.92,.12,4.00,5.12,.24,1.4,'concrete')
    for x,w in [(-2.57,1.50),(-.95,1.48)]:window(x,1.58,3.66,w,2.58,2,'glass_light')
    window(.58,1.44,3.35,1.02,2.7,1)
    beam((.90,1.05,3.50),(.90,1.80,3.50),.025,'metal')
    # Entry canopy slopes towards the street and creates a strong dark shadow line.
    box(-.9,2.98,4.09,5.13,.18,1.55,'charcoal');sign(1,-.9,3.20,4.51,5.12,.49)
    box(2.68,1.5,3.27,1.04,2.92,.18,'charcoal');box(2.68,1.46,3.40,.80,2.60,.035,'glass')
    sign(11,2.67,3.15,4.05,1.13,.42);sign(13,-2.56,1.38,3.91,.72,.26)
    planter(-3.05,.25,4.52,.68);planter(.74,.25,4.51,.62)
    # Actual front window recesses, spandrel bands, asymmetric tenant-panel placements.
    for i in range(1,6):
        floor=base+(i-1)*pitch
        box(-.88,floor+.13,4.00,5.32,.26,1.24,'plaster')
        box(-.88,floor+.42,3.88,5.02,.32,.28,'cream')
        window(-.89,floor+1.60,3.72,4.57,2.00,3,'glass_light' if i%2 else 'glass')
        # Narrow projecting balcony front with lower solid balustrade and upper rails.
        box(-.90,floor+.62,4.46,5.1,.38,.12,'plaster')
        rail((-3.40,floor+.80,4.47),(1.60,floor+.80,4.47),height=.31,posts=7)
        sign([2,3,4,5,12][i-1],-.86,floor+.60,4.54,3.92,.68)
        if i in [2,4]:ac(-2.60,floor+1.10,4.03,.84)
    # 2.0-m-wide switchback stair protrudes next to tenant windows. Every riser modeled.
    for i in range(6):
        floor=0 if i==0 else base+(i-1)*pitch
        nextfloor=base if i==0 else floor+pitch
        if i==5: nextfloor=H
        mid=(floor+nextfloor)/2
        box(2.86,floor+.07,4.36,2.14,.14,1.12,'concrete')
        box(2.86,mid,1.62,2.14,.14,1.14,'concrete')
        stair_flight(2.31,4.05,1.80,floor,mid,.98,10)
        stair_flight(3.41,1.80,4.05,mid,nextfloor,.98,10)
        # Angled solid street-facing screens recall staggered exposed Dogenzaka stair bays.
        if i>0:
            box(2.85,floor+.55,4.82,2.16,1.08,.14,'plaster')
            rail((1.83,floor+1.08,4.82),(3.87,floor+1.08,4.82),.14,3)
        for x in [1.78,3.94]:box(x,(floor+nextfloor)/2,1.38,.14,nextfloor-floor,.16,'plaster')
        box(3.94,floor+.47,3.16,.14,.80,3.60,'plaster')
        rail((3.97,floor+.90,1.48),(3.97,floor+.90,4.85),.22,5)
        # Two visible side cutouts remain between floor slab and handrail, rather than closed tower.
    # Exterior corner of stair enclosure kept open above waist-height panels.
    # Roof slab, setback room and perimeter maintenance rail.
    box(-.10,H+.08,-.09,8.18,.16,10.31,'concrete')
    parapet(8.18,10.31,H+.16,x=-.10,z=-.09,ph=.64)
    box(-1.8,H+1.38,-2.12,2.66,2.45,3.25,'plaster');box(-1.8,H+2.67,-2.12,2.88,.14,3.48,'concrete')
    box(-1.7,H+1.22,-.48,.85,2.1,.07,'charcoal')
    for x in [.05,1.24,2.43]:ac(x,H+.57,-2.36,1.03)
    for x in [.1,1.2,2.3]:
        beam((x,H+.2,-2.30),(x,H+.2,-.9),.045,'metal');beam((x,H+.2,-.9),(3.85,H+.2,-.9),.035,'metal')
    box(1.4,H+.48,1.10,1.9,.66,1.20,'metal')
    for zz in [.76,.93,1.1,1.27,1.44]:box(1.4,H+.83,zz,1.70,.025,.045,'charcoal')
    # Back windows/services, common downpipe and front vertical fictional name fin.
    for j in range(1,6):
        yy=base+(j-1)*pitch+1.4
        # Rear windows face -Z; explicit box glazing avoids mirrored labels.
        box(-1.4,yy,-5.215,2.45,1.58,.035,'charcoal');box(-1.4,yy,-5.245,2.20,1.37,.02,'glass_light')
        ac(.74,yy-.45,-5.38,.78)
    beam((-3.76,.25,-4.97),(-3.76,H+.55,-4.97),.055,'metal')
    box(-3.48,14.04,4.68,.40,6.70,.34,'charcoal')
    # A clean slim sign blade, original strip applied horizontally at top.
    sign(0,-.88,19.59,4.55,5.08,.62)

# Five-storey building with red-brown piers and stepped rear penthouse.
def building_b():
    H=16.65;pitch=3.18;first=3.70
    box(0,H/2,-.55,6.90,H,9.1,'brick')
    # Recessed shadow zone cuts the apparent ground volume into shop and separate shared entry.
    box(-1.42,1.52,4.46,4.05,3.03,.10,'charcoal')
    box(.78,1.5,4.47,.18,3.0,.74,'brick');box(2.47,1.5,4.47,.18,3.0,.74,'brick')
    box(-2.98,1.66,4.76,.48,3.32,.42,'brick');box(2.93,1.66,4.76,.54,3.32,.42,'brick')
    for x in [-2.09,-.55]:window(x,1.46,4.61,1.41,2.65,2,'glass_light')
    window(1.59,1.38,4.20,1.30,2.55,1)
    beam((2.06,.8,4.34),(2.06,1.68,4.34),.026,'metal')
    # Side-by-side bakery frontage and inset independent upper-storey entrance.
    for x in [-2.79,-1.30,.11]:box(x,1.54,4.79,.08,2.82,.12,'wood')
    box(-1.34,2.98,4.80,4.27,.15,.88,'wood');sign(7,-1.31,3.27,4.96,4.24,.54)
    sign(11,1.70,3.23,4.97,1.48,.45);sign(13,-2.03,1.38,4.79,.77,.28)
    # One striped retractable canopy is geometry, no external bitmap.
    for j in range(10):
        x=-3.44+(j+.5)*.421
        poly([(x-.21,2.92,4.82),(x+.21,2.92,4.82),(x+.21,2.55,5.60),(x-.21,2.55,5.60)],[(0,1,2,3)],'cream' if j%2 else 'wood')
        box(x,2.50,5.60,.419,.19,.04,'cream' if j%2 else 'wood')
    box(-1.34,.11,4.93,4.20,.22,1.28,'concrete');planter(2.78,0,5.18,.73)
    # Broad two-bay windows with vertical corner ribs; deeper balcony on 4F.
    for i in range(1,5):
        floor=first+(i-1)*pitch
        box(0,floor+.06,4.65,7.10,.16,.48,'concrete')
        box(0,floor+.44,4.64,6.90,.62,.26,'brick')
        for x in [-1.68,1.68]:window(x,floor+1.67,4.60,2.87,1.77,3,'glass_light' if i==3 else 'glass')
        box(0,floor+1.87,4.84,.16,1.95,.23,'brick')
        sign([8,9,10,5][i-1],0,floor+.48,4.86,5.55,.67)
        # Vertical pilaster ribs catch real daylight and break flat-box repetition.
        for x in [-3.41,3.41]:box(x,floor+1.64,4.82,.19,3.02,.36,'brick')
        if i==3:
            box(-1.65,floor+.12,5.04,3.14,.18,.90,'concrete');rail((-3.20,floor+.2,5.43),(-.09,floor+.2,5.43),.9,6,'charcoal')
            planter(-2.49,floor+.19,5.04,.7)
    # Rectilinear return facade with narrow loft windows and an exposed rear-side steel fire stair.
    for i in range(5):
        floor=0 if i==0 else first+(i-1)*pitch
        yy=floor+1.65
        for zz in [-2.8,.2,2.65]:
            box(-3.474,yy,zz,.055,1.55,1.23,'charcoal');box(-3.513,yy,zz,.026,1.35,1.02,'glass_light')
        if i<4:
            nxt=first if i==0 else floor+pitch
            # Straight-run stair rotates by alternating direction; broad landings outside rear wall.
            z0,z1=(-4.25,-.75) if i%2==0 else (-.75,-4.25)
            stair_flight(4.09,z0,z1,floor,nxt,1.07,18,'metal')
            door_z=-4.40 if i%2 else -.60
            box(4.08,nxt,door_z,1.32,.13,1.12,'metal')
            box(3.475,nxt+1.08,door_z,.05,2.16,.84,'charcoal')
            box(3.51,nxt+1.10,door_z,.025,1.96,.66,'metal')
            beam((3.55,nxt+.92,door_z+.24),(3.55,nxt+1.24,door_z+.24),.024,'charcoal')
            rail((3.44,nxt,-4.86 if i%2 else -.13),(4.74,nxt,-4.86 if i%2 else -.13),1.02,4,'charcoal')
            for zz in [-4.95,-.10]:beam((4.70,floor,zz),(4.70,nxt,zz),.050,'charcoal')
        ac(2.63,yy-.55,-5.30,.87,front=False)
    box(3.475,1.10,-4.22,.05,2.15,.88,'charcoal');box(3.51,1.12,-4.22,.025,1.94,.70,'metal')
    # Pronounced roof setback and low screened terrace, not a flat identical top.
    box(0,H+.10,-.3,7.18,.20,9.93,'concrete');parapet(7.18,9.93,H+.20,z=-.3,mat='brick',ph=.66)
    box(.12,H+1.57,-2.08,4.43,2.74,4.16,'plaster');box(.12,H+3.01,-2.08,4.63,.15,4.37,'concrete')
    window(.05,H+1.48,.025,2.58,1.79,3)
    sign(6,0,H+.75,4.85,4.57,.56)
    for x in [-2.8,2.8]:planter(x,H+.21,3.91,1.15)
    # Cylindrical rooftop water tank and legs silhouette, deliberately different from A's HVAC bank.
    for xx in [-1.0,.4]:beam((xx,H+2.95,-2.4),(xx,H+3.65,-2.4),.08,'charcoal')
    beam((-.30,H+3.45,-2.4),(-.30,H+4.60,-2.4),.86,'metal',16)
    beam((-.30,H+4.61,-2.4),(-.30,H+4.71,-2.4),.64,'concrete',16)
    ac(2.40,H+.69,1.34,1.07);ac(2.40,H+.69,2.58,1.07)
    beam((-3.57,.18,-4.89),(-3.57,H+.59,-4.89),.055,'metal')
    # Rear horizontal window slits and exhaust duct with a rain hood.
    for i in range(1,5):box(-.92,first+(i-1)*pitch+1.7,-5.116,2.67,.72,.025,'glass')
    beam((1.55,.9,-5.38),(1.55,H+1.11,-5.38),.19,'metal',10);box(1.55,H+1.15,-5.38,.65,.16,.65,'charcoal')

building_a() if ARGS.asset=='a' else building_b()
# Center the final footprint envelope, all elevations remain on the local ground plane.
xmin=min(p[0] for p in V);xmax=max(p[0] for p in V);ymin=min(p[1] for p in V);ymax=max(p[1] for p in V);zmin=min(p[2] for p in V)
center=((xmin+xmax)/2,(ymin+ymax)/2,zmin)
V=[(p[0]-center[0],p[1]-center[1],p[2]-center[2]) for p in V]
mesh=bpy.data.meshes.new(SLUG);mesh.from_pydata(V,[],F);mesh.update()
obj=bpy.data.objects.new(SLUG,mesh);bpy.context.collection.objects.link(obj)
for m in MATS.values():mesh.materials.append(m)
for p,mi in zip(mesh.polygons,MI):p.material_index=mi
uv=mesh.uv_layers.new(name='UVMap')
for p,coords in zip(mesh.polygons,UV):
    for k,loopidx in enumerate(p.loop_indices):uv.data[loopidx].uv=coords[k%len(coords)]
# Recalculate outward face normals for every disconnected closed detail and open facade panel.
bpy.context.view_layer.objects.active=obj;obj.select_set(True)
bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.normals_make_consistent(inside=False);bpy.ops.object.mode_set(mode='OBJECT')
mesh.validate(verbose=True);mesh.update();mesh.calc_loop_triangles()
obj['asset_role']='independent scenery, not collision-ready';obj['front_axis_gltf']='+Z';obj['units']='metres';obj['source']='Original geometry and fictional signs; reference photos not embedded.'
scene=bpy.context.scene;scene.unit_settings.system='METRIC';scene.unit_settings.scale_length=1
asset_path=OUT/(SLUG+'.glb')
bpy.ops.export_scene.gltf(filepath=str(asset_path),export_format='GLB',use_selection=True,export_yup=True,export_apply=True,export_cameras=False,export_lights=False,export_extras=True,export_materials='EXPORT',export_texcoords=True,export_normals=True)
# Rendering helpers: actual asset, ground and lighting excluded from GLB.
def aim(o,p):o.rotation_euler=(Vector(p)-o.location).to_track_quat('-Z','Y').to_euler()
def render_preview():
    scene.render.engine='CYCLES';scene.cycles.samples=64;scene.cycles.use_denoising=False;scene.render.threads_mode='FIXED';scene.render.threads=2
    scene.render.resolution_x=900;scene.render.resolution_y=1000;scene.render.resolution_percentage=100
    scene.world.color=(.75,.79,.82);scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.73,.78,.83,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.65
    scene.view_settings.view_transform='AgX'
    bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.02));plane=bpy.context.object;plane.name='preview_ground';plane.data.materials.append(MATS['cream'])
    ld=bpy.data.lights.new('daylight','AREA');lo=bpy.data.objects.new('daylight',ld);bpy.context.collection.objects.link(lo);lo.location=(-12,-18,36);ld.energy=5500;ld.size=16;aim(lo,(0,0,10))
    sd=bpy.data.lights.new('sun','SUN');so=bpy.data.objects.new('sun',sd);bpy.context.collection.objects.link(so);so.rotation_euler=(math.radians(23),math.radians(-32),math.radians(-24));sd.energy=2.0;sd.angle=.10
    cd=bpy.data.cameras.new('review_camera');cam=bpy.data.objects.new('review_camera',cd);bpy.context.collection.objects.link(cam);scene.camera=cam;cd.type='ORTHO'
    hh=max(p[2] for p in V)
    configs={'front':((0,-46,hh*.52),(0,0,hh*.49),hh*1.16),'oblique':((31,-42,hh*1.11),(0,0,hh*.46),hh*1.34),'roof':((24,-31,hh*1.8),(0,0,hh*.60),hh*1.27)}
    for label,(loc,target,scale) in configs.items():
        cam.location=loc;aim(cam,target);cd.ortho_scale=scale;scene.render.filepath=str(DOC/(SLUG+'-'+label+'.png'));bpy.ops.render.render(write_still=True)
    if ARGS.authoring:bpy.ops.wm.save_as_mainfile(filepath=str(OUT/(SLUG+'-authoring.blend')))
if not ARGS.no_render:render_preview()
# Real second-scene reimport of the exported binary, independent of source mesh datablock.
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(asset_path))
imp=[o for o in bpy.context.scene.objects if o.type=='MESH']
coords=[o.matrix_world@v.co for o in imp for v in o.data.vertices]
mins=[min(v[i] for v in coords) for i in range(3)];maxs=[max(v[i] for v in coords) for i in range(3)]
for o in imp:o.data.calc_loop_triangles()
raw=asset_path.read_bytes();magic,version,total=struct.unpack_from('<4sII',raw);length,typ=struct.unpack_from('<II',raw,12);g=json.loads(raw[20:20+length])
primitives=[p for m in g.get('meshes',[]) for p in m['primitives']]
verts=sum(g['accessors'][p['attributes']['POSITION']]['count'] for p in primitives);tri=sum(g['accessors'][p['indices']]['count']//3 for p in primitives)
textures=[]
from PIL import Image
bin_start=28+length
for i,im in enumerate(g.get('images',[])):
    bv=g['bufferViews'][im['bufferView']]; start=bin_start+bv.get('byteOffset',0); payload=raw[start:start+bv['byteLength']]
    width,height=Image.open(io.BytesIO(payload)).size
    textures.append({'image_index':i,'width':width,'height':height,'mime_type':im.get('mimeType'),'embedded_buffer_view':im.get('bufferView'),'bytes':len(payload)})
manifest={
 'id':SLUG,'asset_version':1,'style':'original Dogenzaka-inspired mixed-use, not a measured replica','floors':6 if ARGS.asset=='a' else 5,
 'path':str(asset_path.relative_to(ROOT)),'sha256':hashlib.sha256(raw).hexdigest(),'bytes':len(raw),'triangles':tri,'vertices':verts,'meshes':len(g.get('meshes',[])),'primitives':len(primitives),'materials':len(g.get('materials',[])),'texture_count':len(textures),'textures':textures,
 'coordinates':{'units':'m','up':'+Y','front':'+Z','ground_y':0,'origin':'bottom centre of complete geometry footprint envelope','gltf_bounds_min':[round(mins[0],5),round(mins[2],5),round(-maxs[1],5)],'gltf_bounds_max':[round(maxs[0],5),round(maxs[2],5),round(-mins[1],5)],'dimensions_m':{'width':round(maxs[0]-mins[0],5),'height':round(maxs[2]-mins[2],5),'depth':round(maxs[1]-mins[1],5)}},
 'dimensions_provenance':'All dimensions inferred for original game art. Source listing confirms six storeys only for the Odawaraya reference. No survey or floor plan used; rear, roof and stairs are authored design assumptions.',
 'import_validation':{'software':bpy.app.version_string,'status':'passed','actual_imported_objects':len(imp),'mesh_vertices_after_blender_welding':sum(len(o.data.vertices) for o in imp),'triangles_after_import':sum(len(o.data.loop_triangles) for o in imp),'all_uv':all(bool(o.data.uv_layers) for o in imp),'finite_coordinates':all(math.isfinite(c) for v in coords for c in v),'ground_error_m':abs(mins[2]),'external_image_uris':[im['uri'] for im in g.get('images',[]) if 'uri' in im],'glb_header_bytes_match':total==len(raw)},
 'lod':'LOD0 browser-ready; no separate LOD yet. One joined mesh with material primitives; no interior rooms or collision mesh.','generator':str(Path(__file__).relative_to(ROOT)),
 'renders':[str((DOC/(SLUG+'-'+view+'.png')).relative_to(ROOT)) for view in ['front','oblique','roof']] if not ARGS.no_render else [],
 'known_limitations':['Opaque stylized glazing for stable real-time sorting; no interiors.','Stair and rail geometry is visual scenery, not code-compliant navigation/collision.','Rear facades, service equipment and roof are inferred original design.','Signs are original fictional names; no relationship with real businesses.','Only isolated Blender import/render tested here; game placement, WebGL integration, Windows performance and full build are parent review work.'],
 'source_reference_urls':['https://www.oasis-estate.jp/building/36007','https://birusaku.jp/detail/detail.php/60526772/','https://en.office-navi.jp/building/02006111/'],
 'copyright':'All mesh geometry and signage atlas newly generated. Reference photos are link-only and not redistributed or used as textures.'}
(DOC/(SLUG+'-manifest.json')).write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
print('ASSET_MANIFEST '+json.dumps(manifest,ensure_ascii=False))

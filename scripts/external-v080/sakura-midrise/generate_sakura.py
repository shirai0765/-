#!/usr/bin/env python3
"""Original Sakuragaoka-inspired game architecture. Blender 4.3+.
Run: blender --background --factory-startup --python scripts/external-v080/sakura-midrise/generate_sakura.py -- --asset residential [--no-render] [--save-blend]
All geometry is authored in metres, Blender Z-up/front -Y; glTF export converts to Y-up/front +Z.
No downloaded imagery, assets, or external textures are used.
"""
import bpy, math, json, sys, argparse, struct, hashlib
from pathlib import Path
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[3]
OUT=ROOT/'public/models/external-v080/sakura-midrise'
DOC=ROOT/'docs/external/dot/sakura-midrise'
argv=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
p=argparse.ArgumentParser();p.add_argument('--asset',choices=['residential','office','all'],default='all');p.add_argument('--no-render',action='store_true');p.add_argument('--save-blend',action='store_true');p.add_argument('--samples',type=int,default=48);p.add_argument('--render-only',action='store_true');args=p.parse_args(argv)
OUT.mkdir(parents=True,exist_ok=True);DOC.mkdir(parents=True,exist_ok=True)

# Restrained, texture-free physically based palette. Colors are linear RGB.
PALETTE={
 'mineral_plaster':((.64,.625,.57),.85,0),
 'charcoal_tile':((.115,.135,.14),.74,0),
 'silver_metal':((.32,.38,.4),.40,.62),
 'deep_glazing':((.055,.105,.125),.23,.18),
 'frosted_glazing':((.35,.49,.49),.43,.05),
 'warm_wood':((.26,.145,.075),.77,0),
 'planted_green':((.12,.22,.10),.90,0),
 'roof_membrane':((.255,.275,.265),.91,0),
}
G={};M={}

def point(x,f,h):return (x,-f,h)
def box(name,x,f,h,w,d,t,mat,omit=()):
    # Outward faces; omitted faces are known invisible contact/interior faces.
    X=x;Y=-f;Z=h;a=w/2;b=d/2;c=t/2
    vv=[(X-a,Y-b,Z-c),(X+a,Y-b,Z-c),(X+a,Y+b,Z-c),(X-a,Y+b,Z-c),(X-a,Y-b,Z+c),(X+a,Y-b,Z+c),(X+a,Y+b,Z+c),(X-a,Y+b,Z+c)]
    ff={'bottom':(0,3,2,1),'top':(4,5,6,7),'front':(0,1,5,4),'right':(1,2,6,5),'back':(2,3,7,6),'left':(3,0,4,7)}
    verts,faces=G.setdefault(mat,([],[]));n=len(verts);verts.extend(vv);faces.extend(tuple(n+i for i in v) for k,v in ff.items() if k not in omit)

def prism(name,poly,h0,h1,mat):
    # polygon is counterclockwise in Blender XY after conversion.
    v=[point(x,f,h0) for x,f in poly]+[point(x,f,h1) for x,f in poly];n=len(poly)
    verts,faces=G.setdefault(mat,([],[]));b=len(verts);verts.extend(v)
    # Recalculate once when building material meshes, so winding is robust.
    faces.append(tuple(b+i for i in reversed(range(n))));faces.append(tuple(b+n+i for i in range(n)))
    faces.extend((b+i,b+(i+1)%n,b+(i+1)%n+n,b+i+n) for i in range(n))

def cyl(name,x,f,h,r,depth,mat,sides=10):
    poly=[(x+r*math.cos(i*2*math.pi/sides),f+r*math.sin(i*2*math.pi/sides)) for i in range(sides)]
    prism(name,poly,h-depth/2,h+depth/2,mat)

def beam(name,a,b,width,mat):
    av=Vector(point(*a));bv=Vector(point(*b));d=bv-av
    u=d.normalized().cross(Vector((0,0,1)))
    if u.length<.01:u=d.normalized().cross(Vector((1,0,0)))
    u.normalize();v=d.normalized().cross(u).normalized();u*=width/2;v*=width/2
    pts=[tuple(c+sx*u+sy*v) for c in [av,bv] for sx,sy in [(-1,-1),(1,-1),(1,1),(-1,1)]]
    verts,faces=G.setdefault(mat,([],[]));n=len(verts);verts.extend(pts);faces.extend(tuple(n+i for i in f) for f in [(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)])

def window(name,x,f,h,w,t=1.95,mat='deep_glazing'):
    # Back glazing sits 10cm behind frame; no coplanar decal/window planes.
    box(name+'_glass',x,f,h,w,.06,t,mat,('back',))
    for q in [-1,1]:box(name+'_jamb',x+q*w/2,f+.065,h,.055,.12,t+.12,'silver_metal',('back',))
    for q in [-1,1]:box(name+'_edge',x,f+.065,h+q*t/2,w,.12,.06,'silver_metal',('back',))
    box(name+'_meeting',x,f+.07,h,.06,.12,t,'silver_metal',('back',))

def side_window(x,f,h,w,t,side=1):
    box('side_glass',x,f,h,.06,w,t,'deep_glazing')
    for q in [-1,1]:box('side_jamb',x+side*.06,f+q*w/2,h,.13,.06,t+.08,'silver_metal')
    for q in [-1,1]:box('side_edge',x+side*.06,f,h+q*t/2,.13,w,.06,'silver_metal')

def planter(x,f,w=2.0,d=.65,h=.55):
    box('planter',x,f,h/2,w,d,h,'mineral_plaster',('bottom',))
    box('soil',x,f,h+.005,w-.15,d-.15,.03,'roof_membrane',('bottom',))
    for i in range(max(2,int(w/.45))):
        xx=x-w/2+.28+i*(w-.55)/max(1,int(w/.45)-1)
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=1,location=point(xx,f,h+.23))
        o=bpy.context.object;o.name='rounded_shrub';o.scale=(.34,.28,.31);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(M['planted_green'])

def sign(text,x,f,h,size,material='mineral_plaster'):
    curve=bpy.data.curves.new('fictional_sign','FONT');curve.body=text;curve.align_x='CENTER';curve.align_y='CENTER';curve.size=size;curve.extrude=0;curve.resolution_u=2
    o=bpy.data.objects.new('fictional_'+text,curve);bpy.context.collection.objects.link(o);o.location=point(x,f,h);o.rotation_euler=(math.pi/2,0,0);o.data.materials.append(M[material]);bpy.context.view_layer.objects.active=o;o.select_set(True);bpy.ops.object.convert(target='MESH');o.select_set(False)

def ac(x,f,h,width=.8):
    box('condenser',x,f,h,width,.42,.55,'mineral_plaster',('back','bottom'))
    box('fan_dark',x,f+.217,h,width*.55,.025,.40,'charcoal_tile',('back',))
    for z in [-.14,0,.14]:box('fan_grille',x,f+.235,h+z,width*.65,.025,.022,'silver_metal',('back',))

def roof_equipment(x,f,h):
    box('hvac',x,f,h+.46,1.85,1.30,.9,'mineral_plaster',('bottom',))
    for xx in [-.47,.47]:
        cyl('fan',x+xx,f,h+.924,.36,.04,'charcoal_tile',12)
        for k in [-.22,0,.22]:box('fan_top_grille',x+xx+k,f,h+.95,.035,.66,.035,'silver_metal',('bottom',))
    box('hvac_duct',x+1.3,f,h+.4,.9,.55,.65,'silver_metal',('bottom',))

def residential():
    # Six balcony floors over a separate communal ground level; 7 floors total.
    box('ground_pad',0,0,.06,13.8,11.4,.12,'roof_membrane',('bottom',))
    box('ground_rear',0,-1.60,1.76,13,6.7,3.40,'charcoal_tile',('bottom','top'))
    # Recessed entrance/lobby and separate bicycle screen, not retail storefronts.
    box('lobby_rear',-.55,2.34,1.57,5.9,.18,3.0,'warm_wood',('back','bottom','top'))
    window('entry',-1.10,2.48,1.37,2.10,2.50)
    box('entry_handle',-.77,2.62,1.34,.045,.06,.62,'silver_metal')
    box('mailboxes',1.78,2.51,1.26,1.08,.11,1.13,'silver_metal',('back',))
    for k in range(4):box('mail_slot',1.78,2.576,.87+k*.24,.8,.022,.035,'charcoal_tile',('back',))
    box('entry_canopy',-.7,3.74,3.02,6.55,3.0,.20,'mineral_plaster',('back',))
    box('canopy_trim',-.7,5.26,2.99,6.55,.09,.21,'charcoal_tile',('back',))
    for x in [-3.90,2.60]:box('pilotis',x,4.70,1.66,.32,.32,3.10,'mineral_plaster',('bottom','top'))
    box('bike_screen_rear',4.8,3.0,1.35,2.8,.16,2.45,'deep_glazing',('back',))
    for k in range(13):box('bike_screen_slat',3.42+k*.22,4.24,1.46,.055,.08,2.7,'warm_wood',('bottom',))
    for x in [-5.63,5.73]:planter(x,4.60,1.45,1.05,.59)
    box('name_plaque',-5.50,5.13,1.48,1.48,.16,.7,'charcoal_tile',('back',))
    sign('HANA',-5.5,5.218,1.49,.25)
    # Original stepped use of material: dark lower privacy panels / pale upper panels.
    start=3.36;floorh=2.95;roof=start+6*floorh
    box('rear_wall',0,-4.75,(roof+3.34)/2,13,.24,roof-3.34,'mineral_plaster',('front','bottom','top'))
    for sx in [-1,1]:box('side_wall',sx*6.38,-.6,(roof+3.34)/2,.24,8.12,roof-3.34,'mineral_plaster',('bottom','top'))
    # Left common stair/vertical service spine, visually distinct from residences.
    box('common_spine',-5.48,3.73,(roof+3.36)/2,1.72,1.35,roof-3.36,'charcoal_tile',('bottom','top'))
    for k in range(6):
        h=start+k*floorh
        box('slab',0,.15,h,13.18,10.66,.23,'mineral_plaster',('bottom',) if k==0 else ())
        box('apartment_front_wall',.97,3.37,h+1.42,10.7,.18,2.78,'mineral_plaster',('back','top','bottom'))
        for bi,x in enumerate([-2.63,.92,4.47]):
            window('sliding_balcony',x,3.515,h+1.36,2.42,2.24)
            # Small AC sits in recess beside each sliding doorway.
            ac(x-1.34,4.12,h+.44,.58)
            # Opaque or frosted proxy avoids expensive transparent sorting.
            railmat='charcoal_tile' if k<2 else 'frosted_glazing'
            box('privacy_panel',x,5.30,h+.67,3.35,.10,.91,railmat,('bottom',))
            box('balcony_top_rail',x,5.34,h+1.18,3.47,.055,.055,'silver_metal')
            for xx in [x-1.70,x,x+1.70]:box('balcony_rail_post',xx,5.34,h+.71,.045,.055,1.0,'silver_metal')
            if k>=2:
                for xx in [x-.85,x+.85]:box('balcony_mullion',xx,5.365,h+.71,.035,.045,.99,'silver_metal')
            # Individual apartment separator and service drainage chase.
            if bi<2:box('balcony_divider',x+1.76,4.41,h+1.27,.08,1.60,2.31,'mineral_plaster',('bottom',))
        # Structural outer returns meet the backing wall and the next soffit.
        # Keep internal dividers/rail openings unchanged; only close accidental end seams.
        end_back,end_front=3.42,5.47
        end_bottom=h+.07
        next_soffit=(h+floorh-.115) if k<5 else (roof+.06-.115)
        end_top=next_soffit+.005  # 5 mm overlap avoids floating-point hairline cracks.
        for x in [-4.40,6.24]:
            box('balcony_end',x,(end_back+end_front)/2,(end_bottom+end_top)/2,
                .16,end_front-end_back,end_top-end_bottom,'mineral_plaster',('bottom','top'))
        window('common_landing',-5.48,4.416,h+1.60,.73,1.55,'frosted_glazing')
        box('common_landing_visor',-5.48,4.60,h+2.5,1.12,.5,.09,'mineral_plaster',('back',))
        # Two side windows per side; quieter party-wall elevations.
        for side in [-1,1]:
            for f in [-2.6,.6]:side_window(side*6.53,f,h+1.59,1.0,1.22,side)
        for x in [-4,-.7,2.6,5.2]:
            # Rear utility windows have a deliberate smaller aspect ratio.
            box('rear_window',x,-4.91,h+1.57,1.25,.05,1.05,'deep_glazing',('front',))
            box('rear_sill',x,-5.015,h+1.03,1.41,.27,.10,'mineral_plaster',('front',))
    for x in [-4.42,6.10]:box('downpipe',x,5.08,(3.5+roof)/2,.075,.075,roof-3.5,'silver_metal')
    # Roof parapet and off-centre service headhouse; not a decorative flat cap.
    box('roof',0,.15,roof+.06,13.45,10.90,.23,'mineral_plaster')
    box('roof_surface',.5,-.05,roof+.185,11.9,9.4,.04,'roof_membrane',('bottom',))
    for f in [-5.22,5.48]:box('roof_parapet',0,f,roof+.50,13.4,.15,.8,'mineral_plaster',('bottom',))
    # Side outer faces align with the roof slab: join at its top instead of overlapping.
    # This removes only duplicate buried wall volume; parapet tops and silhouette stay fixed.
    roof_slab_top=roof+.06+.23/2
    side_parapet_top=roof+.50+.8/2
    for x in [-6.65,6.65]:
        box('roof_parapet',x,.13,(roof_slab_top+side_parapet_top)/2,.15,10.7,
            side_parapet_top-roof_slab_top,'mineral_plaster',('bottom',))
    box('stair_headhouse',-4.75,-2.8,roof+1.32,2.75,3.6,2.54,'mineral_plaster',('bottom',))
    box('stair_cap',-4.75,-2.8,roof+2.65,2.95,3.8,.15,'charcoal_tile',('bottom',))
    window('roof_access',-4.75,-.97,roof+1.20,1.05,2.1)
    roof_equipment(2.5,-2.55,roof+.24)
    box('maintenance_path',-.65,-1.2,roof+.223,3.75,6.0,.035,'mineral_plaster',('bottom',))
    return {'floors':7,'roof_m':roof,'label':'HANA COURT','base_name':'sakura-residential','concept':'Seven-storey original apartment building with deep divided balconies and a communal entry/bicycle bay.'}

def office():
    # Five-storey compact office: a chamfered corner and a stepped roof terrace.
    box('base',0,0,.06,11.9,10.6,.12,'roof_membrane',('bottom',))
    # Main mass includes a 45 degree chamfer on the street-facing right corner.
    poly=[(-5.55,-4.85),(5.55,-4.85),(5.55,2.50),(3.95,4.10),(-5.55,4.10)]
    # lower shell: side/rear masonry plus glass-front ground-floor shared lobby
    box('ground_rear',0,-2.46,1.88,11.1,4.78,3.55,'charcoal_tile',('bottom','top'))
    box('ground_left',-5.43,1.02,1.88,.24,7.05,3.55,'charcoal_tile',('bottom','top'))
    box('lobby_wood',-3.8,2.85,1.63,3.1,.17,3.1,'warm_wood',('back','top','bottom'))
    window('lobby_door',-3.7,3.0,1.40,1.86,2.54)
    box('door_pull',-3.35,3.15,1.43,.04,.06,.70,'silver_metal')
    window('shared_ground_window',.10,4.00,1.60,3.85,2.77)
    box('entry_canopy',-3.72,4.21,3.28,3.55,2.0,.20,'mineral_plaster',('back',))
    box('entry_name',-3.72,5.235,3.23,3.55,.06,.28,'charcoal_tile',('back',))
    sign('KOHANA WORKS',-3.72,5.27,3.23,.185)
    box('entry_pillar',-5.35,4.15,1.70,.32,.32,3.26,'mineral_plaster',('bottom','top'))
    box('lobby_pillar',2.2,3.99,1.74,.3,.32,3.37,'mineral_plaster',('bottom','top'))
    # Continuous recessed head/spandrel closes the shared lobby envelope.
    box('ground_front_head',-.79,3.93,3.33,9.48,.20,.66,'charcoal_tile',('back','top'))
    box('ground_entry_pier',-2.29,3.93,1.66,.86,.24,3.18,'charcoal_tile',('back','bottom','top'))
    window('ground_corner_link',3.13,4.0,1.6,1.53,2.77)
    side_window(5.57,1.24,1.6,2.49,2.77,1)
    box('ground_side_head',5.45,1.24,3.34,.22,2.72,.65,'charcoal_tile',('left','top'))
    # Chamfered ground display glazing and columns.
    a=(4.09,4.0);b=(5.45,2.64)
    beam('diagonal_glazing',(a[0],a[1],1.7),(b[0],b[1],1.7),.1,'deep_glazing')
    # vertical glazing panel along diagonal, generated as a thin prism
    prism('corner_glass',[(3.93,4.035),(5.49,2.475),(5.54,2.525),(3.98,4.085)],.2,3.32,'deep_glazing')
    prism('ground_chamfer_head',[(3.91,4.01),(5.46,2.46),(5.57,2.57),(4.02,4.12)],3.3,3.66,'charcoal_tile')
    for t in [0,.5,1]:box('corner_mullion',a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,1.71,.06,.06,3.0,'silver_metal')
    planter(3.22,4.74,1.28,.62,.5)
    # Four upper storeys; top storey set back from street for an outdoor common terrace.
    base=3.72;fh=3.20;roof=base+4*fh
    for k in range(4):
        z=base+k*fh;front=4.10 if k<3 else 2.45
        prism('office_floor',poly,z-.11,z+.11,'mineral_plaster')
        box('rear_wall',0,-4.77,z+1.55,11.1,.24,3.08,'mineral_plaster',('front','top','bottom'))
        box('left_solid_core',-4.56,-.33,z+1.55,1.98,8.65 if k<3 else 5.85,3.08,'mineral_plaster',('bottom','top'))
        box('front_spandrel',.20 if k<3 else .90,front,z+.38,7.58 if k<3 else 8.98,.19,.56,'mineral_plaster',('back','bottom','top'))
        box('front_lintel',.20 if k<3 else .90,front,z+2.92,7.58 if k<3 else 8.98,.20,.36,'mineral_plaster',('back','bottom','top'))
        for x in ([-2.29,.21,2.71] if k<3 else [-2.06,.96,3.98]):window('ribbon_window',x,front+.015,z+1.65,2.38 if k<3 else 2.90,2.16)
        if k<3:
            chamfer=[(3.91,4.01),(5.46,2.46),(5.57,2.57),(4.02,4.12)]
            prism('chamfer_spandrel',chamfer,z+.1,z+.66,'mineral_plaster')
            prism('chamfer_lintel',chamfer,z+2.74,z+3.1,'mineral_plaster')
            prism('chamfer_glazing',chamfer,z+.67,z+2.73,'deep_glazing')
            for t in [0,.5,1]:box('chamfer_mullion',3.99+1.51*t,4.11-1.51*t,z+1.68,.065,.065,2.1,'silver_metal')
        # Recessed dark vertical stair slot in the pale left pier.
        window('stair_slot',-4.63,front+.13,z+1.65,.61,2.15,'frosted_glazing')
        # Narrow projecting coping replaces apartment balconies.
        box('horizontal_brow',.2 if k<3 else .9,front+.19,z+2.85,7.6 if k<3 else 9.0,.5,.10,'silver_metal',('back',))
        # Side elevation strip glazing, with masonry fins and opening proportions.
        box('side_spandrel',5.44,-1.2,z+.40,.22,6.80,.6,'mineral_plaster',('left',))
        box('side_lintel',5.44,-1.2,z+2.92,.22,6.80,.34,'mineral_plaster',('left',))
        for f in [-3.48,-1.14,1.20]:side_window(5.57,f,z+1.66,2.13,2.10,1)
        for f in [-4.6,-2.31,.02,2.32]:box('side_fin',5.55,f,z+1.61,.55,.12,2.97,'mineral_plaster',('left','bottom','top'))
        for x in [-2.7,.3,3.3]:box('rear_window',x,-4.92,z+1.57,1.5,.06,1.72,'deep_glazing',('front',))
    # Third floor slab extends to make the fifth-floor common terrace.
    tz=base+3*fh
    prism('terrace_paving',[(-5.3,2.52),(5.15,2.52),(3.87,3.99),(-5.3,3.99)],tz+.12,tz+.18,'roof_membrane')
    box('terrace_rail',-.66,4.02,tz+.76,9.22,.08,1.1,'frosted_glazing',('bottom',))
    box('terrace_rail_cap',-.66,4.02,tz+1.33,9.25,.065,.055,'silver_metal')
    for x in [-4.9,-2.75,-.5,1.75,3.95]:box('terrace_post',x,4.04,tz+.77,.05,.06,1.18,'silver_metal')
    prism('terrace_corner_rail',[(3.90,3.98),(5.31,2.57),(5.37,2.63),(3.96,4.04)],tz+.22,tz+1.29,'frosted_glazing')
    beam('terrace_corner_cap',(3.94,4.02,tz+1.32),(5.35,2.61,tz+1.32),.055,'silver_metal')
    # Small terrace planters offset from front rail; foliage is low-poly geometry.
    for x in [-3.7,2.8]:
        box('terrace_planter',x,3.33,tz+.43,1.35,.55,.53,'mineral_plaster',('bottom',))
        for xx in [-.43,0,.43]:
            bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=.32,location=point(x+xx,3.33,tz+.82));o=bpy.context.object;o.name='terrace_shrub';o.scale=(1,.7,.75);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(M['planted_green'])
    box('roof',0,-1.12,roof+.08,11.35,7.85,.24,'mineral_plaster')
    box('roof_deck',0,-1.12,roof+.22,10.8,7.3,.04,'roof_membrane',('bottom',))
    for f in [-4.96,2.72]:box('roof_parapet',0,f,roof+.5,11.3,.14,.76,'mineral_plaster',('bottom',))
    for x in [-5.60,5.60]:box('roof_parapet',x,-1.13,roof+.5,.14,7.60,.76,'mineral_plaster',('bottom',))
    box('headhouse',-3.9,-2.98,roof+1.20,2.7,3.3,2.1,'mineral_plaster',('bottom',))
    box('headhouse_cap',-3.9,-2.98,roof+2.3,2.88,3.48,.12,'silver_metal')
    window('roof_door',-3.9,-1.29,roof+1.23,.98,1.88)
    roof_equipment(2.15,-2.4,roof+.25)
    # Lower service door and AC tucked onto the back to distinguish the working side.
    box('rear_service_door',3.7,-4.89,1.28,1.17,.08,2.25,'silver_metal',('front',))
    return {'floors':5,'roof_m':roof,'label':'KOHANA WORKS','base_name':'sakura-office','concept':'Five-storey original small office with ribbon glazing, a recessed shared lobby and a setback common terrace.'}

def reset():
    bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
    for d in list(bpy.data.materials):bpy.data.materials.remove(d)
    # Remove orphan geometry so --asset all reproduces standalone names and bytes.
    for d in list(bpy.data.meshes):bpy.data.meshes.remove(d)
    for d in list(bpy.data.curves):bpy.data.curves.remove(d)
    G.clear();M.clear()
    for name,(color,rough,metal) in PALETTE.items():
        m=bpy.data.materials.new(name);m.use_nodes=True;m.diffuse_color=(*color,1)
        bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*color,1);bs.inputs['Roughness'].default_value=rough;bs.inputs['Metallic'].default_value=metal
        # Opaque coated glazing is intentional for dense-city performance.
        if 'glazing' in name:bs.inputs['Coat Weight'].default_value=.3
        M[name]=m
    bpy.context.scene.unit_settings.system='METRIC';bpy.context.scene.unit_settings.scale_length=1

def finish_geometry(label):
    import bmesh
    for name,(verts,faces) in G.items():
        mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update()
        bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(mesh);bm.free()
        mesh.validate(verbose=True)
        o=bpy.data.objects.new(label+'_'+name,mesh);bpy.context.collection.objects.link(o);mesh.materials.append(M[name])
    # Collapse all objects by material: one mesh and one primitive per used material.
    for mat in list(M.values()):
        objects=[o for o in bpy.context.scene.objects if o.type=='MESH' and len(o.data.materials)==1 and o.data.materials[0]==mat]
        if not objects:continue
        bpy.ops.object.select_all(action='DESELECT')
        for o in objects:o.select_set(True)
        bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join();o=bpy.context.object
        bpy.context.scene.cursor.location=(0,0,0);bpy.ops.object.origin_set(type='ORIGIN_CURSOR');bpy.ops.object.transform_apply(location=True,rotation=True,scale=True);o.name=label+'_'+mat.name
        # UVs are generated, though no textures are required. Box projection supports later authoring.
        if not o.data.uv_layers:o.data.uv_layers.new(name='UVMap')
        uv=o.data.uv_layers.active.data
        for poly in o.data.polygons:
            axis=max(range(3),key=lambda i:abs(poly.normal[i]));axes=[i for i in range(3) if i!=axis]
            for li in poly.loop_indices:
                co=o.data.vertices[o.data.loops[li].vertex_index].co;uv[li].uv=(co[axes[0]]*.25,co[axes[1]]*.25)
        tri=o.modifiers.new('explicit_triangulation','TRIANGULATE');bpy.ops.object.modifier_apply(modifier=tri.name)
    bpy.ops.object.select_all(action='DESELECT')
    for o in bpy.context.scene.objects:
        if o.type=='MESH':o.select_set(True)

def glb_stats(path):
    raw=path.read_bytes();magic,version,total=struct.unpack_from('<4sII',raw,0);n,typ=struct.unpack_from('<I4s',raw,12);j=json.loads(raw[20:20+n])
    # Material objects must be baked: accessor bounds equal world bounds only with identity nodes.
    assert all(not any(k in n for k in ['matrix','translation','rotation','scale']) for n in j.get('nodes',[])), 'Unexpected node transform: compute world bounds before reporting'
    positions=[];tri=0;verts=0;primitive_count=0
    for mesh in j.get('meshes',[]):
        for pr in mesh['primitives']:
            primitive_count+=1;a=j['accessors'][pr['attributes']['POSITION']];verts+=a['count'];positions.append((a['min'],a['max']))
            tri+=j['accessors'][pr['indices']]['count']//3
    mn=[min(p[0][i] for p in positions) for i in range(3)];mx=[max(p[1][i] for p in positions) for i in range(3)]
    return {'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'vertices':verts,'triangles':tri,'materials':len(j.get('materials',[])),'primitives':primitive_count,'meshes':len(j.get('meshes',[])),'textures':len(j.get('textures',[])),'images':len(j.get('images',[])),'texture_dimensions':[],'texture_bytes':0,'bounds_m':{'min':mn,'max':mx},'dimensions_m':[round(mx[i]-mn[i],5) for i in range(3)],'external_uris':[v['uri'] for k in ['buffers','images'] for v in j.get(k,[]) if 'uri' in v],'gltf_version':j['asset']['version']}

def render_views(base_name,height):
    preview_source_hash=hashlib.sha256((OUT/(base_name+'.glb')).read_bytes()).hexdigest()
    scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=args.samples;scene.cycles.use_denoising=False;scene.render.threads_mode='FIXED';scene.render.threads=2
    scene.render.resolution_x=1056;scene.render.resolution_y=1056;scene.render.resolution_percentage=100
    scene.world.color=(.72,.78,.85)
    scene.world.use_nodes=True;scene.world.node_tree.nodes.get('Background').inputs[0].default_value=(.72,.78,.85,1);scene.world.node_tree.nodes.get('Background').inputs[1].default_value=.65
    bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.035));ground=bpy.context.object;ground.name='PREVIEW_ONLY_GROUND';g=bpy.data.materials.new('PREVIEW_ONLY_GROUND');g.diffuse_color=(.59,.625,.62,1);ground.data.materials.append(g)
    bpy.ops.object.light_add(type='AREA',location=(-17,-23,36));light=bpy.context.object;light.data.energy=2500;light.data.shape='DISK';light.data.size=18;light.rotation_euler=((Vector((0,0,8))-light.location).to_track_quat('-Z','Y').to_euler())
    bpy.ops.object.light_add(type='SUN',location=(10,-10,30));sun=bpy.context.object;sun.data.energy=2.0;sun.data.angle=.16;sun.rotation_euler=(math.radians(24),math.radians(-24),math.radians(-32))
    bpy.ops.object.camera_add();cam=bpy.context.object;scene.camera=cam;cam.data.type='ORTHO';cam.data.lens=55
    scene.view_settings.view_transform='AgX';scene.render.image_settings.file_format='PNG';scene.render.film_transparent=False
    views={'front':((0,-48,height*.56),(0,0,height*.48),height*1.23),'oblique':((30,-40,height*1.07),(0,0,height*.46),height*1.42),'roof':((24,-27,height*2.2),(0,0,height*.55),height*1.40)}
    for v,(loc,target,scale) in views.items():
        cam.location=loc;cam.rotation_euler=(Vector(target)-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.ortho_scale=scale;scene.render.filepath=str(OUT/f'{base_name}-{v}.png');bpy.ops.render.render(write_still=True)
    preview_report={'asset':base_name,'rendered_glb_sha256':preview_source_hash,'engine':'Cycles CPU','samples':args.samples,'resolution':[1056,1056],'rendered_after_actual_glb_import':True,'views':{v:{'camera_blender_z_up':list(loc),'target_blender_z_up':list(target),'ortho_scale_m':scale,'png':base_name+'-'+v+'.png','sha256':hashlib.sha256((OUT/(base_name+'-'+v+'.png')).read_bytes()).hexdigest()} for v,(loc,target,scale) in views.items()}}
    (OUT/(base_name+'.previews.json')).write_text(json.dumps(preview_report,indent=2)+'\n')

def validate_import(path):
    bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
    bpy.ops.import_scene.gltf(filepath=str(path))
    obs=[o for o in bpy.context.scene.objects if o.type=='MESH'];pts=[o.matrix_world@v.co for o in obs for v in o.data.vertices]
    bounds={'min':[min(v[i] for v in pts) for i in range(3)],'max':[max(v[i] for v in pts) for i in range(3)]}
    return {'tool':'Blender '+bpy.app.version_string,'actual_import_succeeded':True,'mesh_objects':len(obs),'mesh_vertices':sum(len(o.data.vertices) for o in obs),'mesh_triangles':sum(len(o.data.polygons) for o in obs),'blender_z_up_bounds_m':bounds,'finite_vertices':all(math.isfinite(c) for v in pts for c in v),'zero_area_triangles':sum(p.area<1e-10 for o in obs for p in o.data.polygons),'ground_z_zero':abs(bounds['min'][2])<1e-5,'note':'Blender importer maps glTF +Y up to Blender +Z up. Exported glTF bounds are measured separately; authored -Y front maps to glTF +Z front.'}

def build(kind):
    reset();info=(residential if kind=='residential' else office)();finish_geometry(info['base_name']);path=OUT/(info['base_name']+'.glb')
    if args.save_blend:bpy.ops.wm.save_as_mainfile(filepath=str(OUT/(info['base_name']+'.blend')))
    bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_yup=True,export_apply=True,export_texcoords=True,export_normals=True,export_materials='EXPORT',export_cameras=False,export_lights=False,export_extras=False,export_animations=False)
    stats=glb_stats(path)
    validation=validate_import(path)
    if not args.no_render:render_views(info['base_name'],stats['dimensions_m'][1])
    manifest={'asset':info['base_name'],'display_name':info['label'],'version':'D01.3' if kind=='residential' else 'D01.1','authoring':'Original procedural Blender geometry; no copied models or image textures.','units':'metres','up_axis':'+Y','front_axis':'+Z','ground_y_m':0,'origin':'Bottom center of the model footprint; all mesh node origins at [0,0,0].','floors':info['floors'],'design':info['concept'],'dimensions_status':'All model dimensions are author estimates for a fictional synthesis, not a survey or measurements of the referenced properties.','lod':'LOD0 only, already lightweight; no decimation fallback supplied.','geometry':stats,'import_validation':validation,'reference_document':'docs/external/dot/sakura-midrise/references.md','generator':'scripts/external-v080/sakura-midrise/generate_sakura.py','previews':[info['base_name']+'-'+v+'.png' for v in ['front','oblique','roof']],'preview_note':'Original geometry rendered with studio sky/sun and ground plane. Preview ground, camera, lighting are excluded from GLB.','limitations':['Conceptual Sakuragaoka building, not a reconstruction or exact footprint.','Reference photos do not establish rear elevations, roof services, dimensions or interior layouts. Those are invented plausibly.','Glazing uses opaque PBR color and coating to avoid transparency sorting and overdraw. No interior rooms.','Connected structural pieces may intersect; hidden faces are selectively omitted but not a boolean watertight solid.','Generated UVs are box-projected and untextured; no baked AO, lightmap or image textures.','No navigation/collision mesh, lot placement, street slopes or scene integration supplied.','GLB and Blender import validated; final application, Windows GPU and WebGL performance remain integration checks.'],'scope':'Only new external assets, scripts and documentation. Existing models, src, game data and city placements unchanged.'}
    (OUT/(info['base_name']+'.manifest.json')).write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
    print('SAKURA_RESULT '+json.dumps({'asset':info['base_name'],**stats,'validation':validation}))
for kind in (['residential','office'] if args.asset=='all' else [args.asset]):
    if args.render_only:
        name='sakura-'+kind;path=OUT/(name+'.glb');validate_import(path);render_views(name,glb_stats(path)['dimensions_m'][1])
    else:build(kind)

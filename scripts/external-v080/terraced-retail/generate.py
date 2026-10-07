#!/usr/bin/env python3
"""Reproducible original terraced retail/office asset. Blender 4.3+, no external assets.
blender -b -t 2 --python scripts/external-v080/terraced-retail/generate.py -- --render
Coordinates authored here are glTF: X right, Y up, Z front, metres.
"""
import bpy, bmesh, math, json, struct, hashlib, argparse, sys, random
from pathlib import Path
from collections import defaultdict
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[3]
OUT=ROOT/'public/models/external-v080/terraced-retail'
DOC=ROOT/'docs/external/dot/terraced-retail'
OUT.mkdir(parents=True,exist_ok=True); DOC.mkdir(parents=True,exist_ok=True)
args=argparse.ArgumentParser(); args.add_argument('--render',action='store_true');args.add_argument('--lod-only',action='store_true');args.add_argument('--preview-only',action='store_true');args.add_argument('--views',nargs='+',choices=['front','oblique','roof']);args=args.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
random.seed(804)
PALETTE={
 'porcelain':((0.79,0.78,0.735,1),0.04,0.63),
 'stone':((0.36,0.365,0.35,1),0.0,0.9),
 'joint':((0.29,0.315,0.30,1),0.05,0.75),
 'aluminium':((0.53,0.57,0.58,1),0.72,0.32),
 'charcoal':((0.075,0.092,0.096,1),0.32,0.48),
 'glass_blue':((0.095,0.205,0.265,1),0.48,0.19),
 'glass_light':((0.19,0.31,0.355,1),0.34,0.24),
 'glass_sage':((0.215,0.325,0.305,1),0.16,0.27),
 'wood':((0.285,0.195,0.118,1),0.0,0.8),
 'leaf_dark':((0.055,0.13,0.061,1),0.0,0.93),
 'leaf_light':((0.13,0.23,0.077,1),0.0,0.95),
 'warm_light':((0.91,0.71,0.39,1),0.1,0.46),
 'accent':((0.38,0.115,0.058,1),0.1,0.62),
}
MATS={};G={};lod=0

def reset(level):
 global MATS,G,lod
 lod=level;G=defaultdict(lambda:[[],[]])
 bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
 for x in list(bpy.data.meshes):
  if x.users==0:bpy.data.meshes.remove(x)
 MATS={}
 for name,(color,metal,rough) in PALETTE.items():
  m=bpy.data.materials.new(name);m.diffuse_color=color;m.use_nodes=True
  b=m.node_tree.nodes.get('Principled BSDF');b.inputs['Base Color'].default_value=color;b.inputs['Metallic'].default_value=metal;b.inputs['Roughness'].default_value=rough
  if name=='warm_light':b.inputs['Emission Color'].default_value=color;b.inputs['Emission Strength'].default_value=0.35
  MATS[name]=m
 bpy.context.scene.unit_settings.system='METRIC';bpy.context.scene.unit_settings.scale_length=1

def xyz(p):return (p[0],-p[2],p[1])
def poly(v,f,mat):
 vs,fs=G[mat];n=len(vs);vs.extend(xyz(p) for p in v);fs.extend(tuple(n+i for i in face) for face in f)
def box(x0,x1,y0,y1,z0,z1,mat='porcelain'):
 if min(x1-x0,y1-y0,z1-z0)<=0:return
 v=[(x0,y0,z0),(x1,y0,z0),(x1,y1,z0),(x0,y1,z0),(x0,y0,z1),(x1,y0,z1),(x1,y1,z1),(x0,y1,z1)]
 poly(v,[(0,3,2,1),(4,5,6,7),(0,4,7,3),(1,2,6,5),(0,1,5,4),(3,7,6,2)],mat)
def pane(x0,x1,y0,y1,z0,z1,mat,side='front'):
 if side=='front':v=[(x0,y0,z1),(x1,y0,z1),(x1,y1,z1),(x0,y1,z1)]
 elif side=='back':v=[(x1,y0,z0),(x0,y0,z0),(x0,y1,z0),(x1,y1,z0)]
 elif side=='right':v=[(x1,y0,z1),(x1,y0,z0),(x1,y1,z0),(x1,y1,z1)]
 else:v=[(x0,y0,z0),(x0,y0,z1),(x0,y1,z1),(x0,y1,z0)]
 poly(v,[(0,1,2,3)],mat)
def beam(a,b,width,mat='aluminium',depth=None):
 a=Vector(a);b=Vector(b);d=(b-a).normalized();axis=Vector((0,1,0))
 if abs(d.dot(axis))>.99:axis=Vector((1,0,0))
 u=d.cross(axis).normalized()*width/2;v=d.cross(u).normalized()*(depth or width)/2
 pts=[a-u-v,a+u-v,a+u+v,a-u+v,b-u-v,b+u-v,b+u+v,b-u+v]
 poly(pts,[(0,3,2,1),(4,5,6,7),(0,4,7,3),(1,2,6,5),(0,1,5,4),(3,7,6,2)],mat)
def cylinder(x,y,z,r,h,mat='wood',n=8):
 vs=[(x+math.cos(a*math.tau/n)*r,y+dy,z+math.sin(a*math.tau/n)*r) for dy in [0,h] for a in range(n)]
 faces=[tuple(range(n-1,-1,-1)),tuple(range(n,n*2))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
 # X,Y,Z right handed; reversed polygon due clockwise viewed above
 poly(vs,faces,mat)
def foliage(x,y,z,rx,ry,rz,mat='leaf_dark'):
 # Low-poly uneven elliptic canopy: fully closed with outward flat normals.
 n=8 if not lod else 6;v=[(x,y-ry,z),(x,y+ry,z)]
 for k in [0,1]:
  yy=y+(-.4 if k==0 else .35)*ry
  for i in range(n):
   a=i*math.tau/n;rr=1+0.12*math.sin(i*3.7+k)
   v.append((x+math.cos(a)*rx*rr,yy,z+math.sin(a)*rz*rr))
 f=[]
 for i in range(n):
  j=(i+1)%n
  f.extend([(0,2+i,2+j),(2+i,2+n+i,2+n+j,2+j),(1,2+n+j,2+n+i)])
 poly(v,f,mat)
def tree(x,y,z,s=1):
 cylinder(x,y,z,.115*s,2.2*s)
 if not lod:
  for dx,dz in [(.7,.25),(-.5,-.5),(.15,-.7)]:beam((x,y+1.4*s,z),(x+dx*s,y+3*s,z+dz*s),.07*s,'wood')
 foliage(x,y+3.1*s,z,1.4*s,1.35*s,1.2*s)
 if not lod:
  foliage(x-.65*s,y+3.5*s,z+.2*s,.85*s,.95*s,.85*s,'leaf_light')
  foliage(x+.65*s,y+2.8*s,z-.3*s,.9*s,.9*s,.9*s,'leaf_light')
def planter(x0,x1,y,z0,z1,trees=False):
 box(x0,x1,y,y+.55,z0,z1,'stone');box(x0+.1,x1-.1,y+.54,y+.6,z0+.1,z1-.1,'leaf_dark')
 length=x1-x0
 if not lod:
  for i in range(max(1,int(length/1.2))):
   x=x0+.5+(length-1)*(i/max(1,int(length/1.2)-1));foliage(x,y+.92,(z0+z1)/2,.63,.43,(z1-z0)*.45,'leaf_light' if i%3==0 else 'leaf_dark')
 if trees:
  for x in [x0+1.2,x1-1.2] if length>5 else [(x0+x1)/2]:tree(x,y+.55,(z0+z1)/2,.82)
def rail(a,b,h=1.15):
 # Opaque thin frosted/sage glass avoids alpha sorting. Narrow bars reinforce scale.
 a=Vector(a);b=Vector(b);d=b-a
 if abs(d.x)>abs(d.z):box(min(a.x,b.x),max(a.x,b.x),a.y+.10,a.y+h,a.z-.035,a.z+.035,'glass_sage')
 else:box(a.x-.035,a.x+.035,a.y+.1,a.y+h,min(a.z,b.z),max(a.z,b.z),'glass_sage')
 beam(a+Vector((0,h,0)),b+Vector((0,h,0)),.06,'aluminium')
 for i in range(int(d.length/2.8)+1):
  p=a+d*(i/max(1,int(d.length/2.8)));beam(p,p+Vector((0,h,0)),.055,'aluminium')
def stairs(a,b,width=2.8):
 a=Vector(a);b=Vector(b);d=b-a;rise=d.y;n=max(2,int(abs(rise)/.18));flat=Vector((d.x,0,d.z));side=flat.normalized().cross(Vector((0,1,0)))*width/2
 # Each tread is a prism with no coplanar overlap between adjacent steps.
 for i in range(n):
  p=a+flat*i/n; q=a+flat*(i+1)/n;hi=a.y+rise*(i+1)/n;lo=a.y+rise*i/n-.17
  vv=[p-side,p+side,q+side,q-side]
  poly([(v.x,lo,v.z) for v in vv]+[(v.x,hi,v.z) for v in vv],[(0,3,2,1),(4,5,6,7),(0,4,7,3),(1,2,6,5),(0,1,5,4),(3,7,6,2)],'stone')
 for sidev in [side,-side]:
  beam(a+sidev+Vector((0,1.12,0)),b+sidev+Vector((0,1.12,0)),.07,'aluminium')
  beam(a+sidev-Vector((0,.13,0))+(d/n if a.y<1 else Vector((0,0,0))),b+sidev-Vector((0,.13,0)),.16,'charcoal',.36)
  if not lod:
   for i in range(6):
    p=a+d*i/5+sidev;beam(p,p+Vector((0,1.12,0)),.05,'aluminium')
def white_volume(x0,x1,y0,y1,z0,z1,seams=True):
 box(x0,x1,y0,y1,z0,z1)
 if not lod and seams:
  for x in frange(x0+3.3,x1,3.3):
   box(x-.01,x+.01,y0+.05,y1-.05,z1+.001,z1+.008,'joint')
  for z in frange(z0+3.3,z1,3.3):
   box(x0-.008,x0-.001,y0+.05,y1-.05,z-.01,z+.01,'joint')
   box(x1+.001,x1+.008,y0+.05,y1-.05,z-.01,z+.01,'joint')
  for y in frange(y0+4.7,y1,4.7):
   box(x0+.03,x1-.03,y-.008,y+.008,z1+.001,z1+.007,'joint')
   box(x1+.001,x1+.007,y-.008,y+.008,z0+.03,z1-.03,'joint')
  # Thin cap and underside reveal retain hierarchy rather than oversized outlines.
  box(x0,x1,y0,y0+.085,z1+.009,z1+.027,'aluminium')
def frange(a,b,d):
 while a<b-.05:yield a;a+=d

def front_glass(x0,x1,y0,y1,z,step=2.2):
 for i,x in enumerate(frange(x0,x1,step)):
  xx=min(x1,x+step);pane(x+.04,xx-.04,y0+.04,y1-.04,z-.08,z,'glass_light' if i%5==1 else 'glass_sage')
  if not lod:box(x-.035,x+.035,y0,y1,z,z+.08,'charcoal')
 box(x0,x1,y0,y0+.08,z,z+.08,'charcoal');box(x0,x1,y1-.08,y1,z,z+.08,'charcoal')
def terrace(x0,x1,y,z0,z1,front=True,right=False,left=False):
 box(x0,x1,y-.22,y,z0,z1,'stone');box(x0+.10,x1-.1,y,y+.04,z0+.1,z1-.1,'wood')
 if not lod:
  for z in frange(z0+.6,z1,.6):box(x0+.15,x1-.15,y+.040,y+.045,z-.012,z+.012,'joint')
 if front:rail((x0+.12,y,z1-.12),(x1-.12,y,z1-.12))
 if right:rail((x1-.12,y,z0+.12),(x1-.12,y,z1-.12))
 if left:rail((x0+.12,y,z0+.12),(x0+.12,y,z1-.12))
def text_front(body,x,y,z,size,mat='charcoal'):
 if lod and size<1:return
 curve=bpy.data.curves.new('Fictional '+body,'FONT');curve.body=body;curve.align_x='CENTER';curve.size=size;curve.extrude=.012;curve.bevel_depth=0;curve.resolution_u=3
 o=bpy.data.objects.new('Fictional '+body,curve);bpy.context.collection.objects.link(o);o.location=xyz((x,y,z));o.rotation_euler=(math.pi/2,0,0);o.data.materials.append(MATS[mat])
 bpy.context.view_layer.objects.active=o;o.select_set(True);bpy.ops.object.convert(target='MESH');o.select_set(False)
 # Insert mesh into consolidated groups.
 polyobj=o
 vs=[tuple(o.matrix_world@v.co) for v in o.data.vertices];gg=G[mat];n=len(gg[0]);gg[0].extend(vs);gg[1].extend(tuple(n+i for i in p.vertices) for p in o.data.polygons)
 bpy.data.objects.remove(o,do_unlink=True)

def build(level=0):
 reset(level)
 # Base is exactly ground Y=0; all geometry kept within a bottom-centered 60 x 50m footprint.
 box(-30,30,0,.18,-25,25,'stone')
 # Recessed ground-floor shops with an open central pedestrian passage.
 for x0,x1 in [(-29.5,-3.4),(3.4,29.5)]:
  box(x0,x1,.18,6.95,-24.5,21.75,'charcoal')
  front_glass(x0+.3,x1-.3,.4,6.4,22.35,2.3)
  # Shop transom, ground door frames and slender support piers.
  box(x0,x1,4.7,4.9,22.38,22.50,'aluminium')
  for x in frange(x0+.4,x1,6.0):box(x,x+.38,.18,7.05,21.9,23.2,'porcelain')
  for x in frange(x0+2.1,x1-2,5.8):
   box(x-.9,x+.9,.2,3.4,22.36,22.43,'glass_blue')
   if not lod:
    for xx in [x-.92,x,x+.92]:box(xx-.025,xx+.025,.2,3.45,22.44,22.51,'aluminium')
    for xx in [x-.16,x+.16]:box(xx-.025,xx+.025,1.2,1.85,22.5,22.58,'aluminium')
 # Walk-through arcade has visible soffit, recessed entrances, ceiling light slots and paired columns.
 box(-3.4,3.4,6.5,7.0,-25,25,'porcelain')
 for z in [-19,-9,1,11,21]:
  for x in [-3.22,3.22]:box(x-.14,x+.14,.18,6.5,z-.18,z+.18,'porcelain')
  if not lod:box(-2.4,2.4,6.43,6.49,z-.10,z+.10,'warm_light')
 box(-3.4,3.4,.18,.21,-25,25,'stone')
 # Podium core sits behind outdoor terrace slots. It is intentionally not a simulated interior.
 box(-26.9,26.9,7,46.8,-23.8,16.7,'charcoal')
 for ya,yb in [(12,17),(17,22),(30,35),(37,42),(42,46.8)]:front_glass(-27,27,ya+.12,yb-.12,16.91,2.45)
 # Interlocking blank ceramic-clad volumes; these make the characteristic silhouette.
 for v in [(-30,9,7,17,16.9,25), (9,30,7,12,7,22),
           (9,11.25,7,12,22,25),(17.2,30,7,12,22,25),(11.25,17.2,10.6,12,22,25),
           (-26.6,-21,7,22,-25,16.9),(-30,-26.6,7,17,-25,16.9),
           (-30,-26.6,17,22,-25,10.4),(-26.65,6,22,37,15,25),(-30,-26.65,22,37,18.5,25),
           (-30,-26.65,25.4,37,15,18.5),
           (9,26.25,17,30,7,21.7),(26.25,30,17,30,7,11.45),
           (26.25,30,17,30,18,21.7),(26.25,30,20.6,30,11.45,18),
           (4,25.85,35,46.8,6,19.7),(25.85,28,35,46.8,6,7.4),
           (25.85,28,35,46.8,15.5,19.7),(25.85,28,38.6,46.8,7.4,15.5),
           (-28,-3,22,46.8,-25,-7),(-22,29,7,30,-25,-18),
           (26.7,29.8,12,27,-18,7),(26.7,28,32,46.8,-18,6),
           (-3,27,34,46.8,-25,-20)]:white_volume(*v)
 # White structural columns visible inside deliberately deep slots.
 for x in [-28,-15,-1]:box(x-.24,x+.24,17,22,22.55,23.10)
 for x in [12,25.5]:box(x-.24,x+.24,30,35,18.6,19.15)
 # The outdoors is a sequence of terraces and circulation, not a regular balcony stack.
 terrace(-29.8,8.8,17,17.1,24.85,True,False,True)
 terrace(9.3,29.8,12,17.2,24.85,True,True)
 terrace(9,29.8,17,21.85,24.85,True,True)
 terrace(9.2,29.8,30,8.5,21.55,True,True)
 terrace(-29.8,3.8,37,17,24.85,True,False,True)
 # Secondary side terrace and recessed side glazing complete the whole asset.
 terrace(26.95,29.8,27,-17.8,7,False,True)
 for z in frange(-17.7,6.8,2.3):
  pane(26.94,27.02,27.15,31.85,z,z+2.15,'glass_sage','right')
  if not lod:box(27.02,27.12,27.1,31.9,z-.03,z+.03,'aluminium')
 for z in [-13,-3]:
  box(28.5,29.4,27,27.55,z-2.2,z+2.2,'stone')
  if not lod:foliage(28.95,28.05,z,.4,.65,1.8,'leaf_dark')
 # Upper publicly readable rooftop deck wraps the office tower.
 terrace(-28,28,46.8,7.1,21,True,True,True)
 terrace(20.1,28,46.8,-23.8,7.1,False,True)
 terrace(-28,-20.1,46.8,-23.8,7.1,False,False,True)
 stairs((24.2,.2,23.55),(12.7,7,23.55),2.35)
 stairs((28.4,12,23),(28.4,17,13),2.4)
 stairs((-28.35,17,23.1),(-28.35,22,12.0),2.5)
 stairs((28.3,30,19.9),(28.3,35,9.0),2.4)
 stairs((-24.4,37,23.2),(-10.0,42,23.2),2.7)
 # Recessed stair portals and connected landings; no flight terminates in open air.
 box(11.25,14.25,6.85,7,22.1,24.85,'stone');front_glass(11.3,17.1,7.05,10.5,22.11,1.45)
 box(26.94,29.85,16.85,17,11.45,14.55,'stone');pane(26.94,26.96,17.05,20.45,11.5,14.5,'glass_sage','right')
 box(26.94,29.8,34.85,35,7.4,10.6,'stone');pane(26.94,26.96,35.05,38.45,7.45,10.55,'glass_sage','right')
 rail((29.72,35,7.45),(29.72,35,10.55))
 terrace(-29.8,-26.65,22,10.4,13.5,False,False,True)
 for z in [10.8,13.1]:box(-29.4,-29.15,17,21.78,z-.12,z+.12,'porcelain')
 pane(-26.97,-26.93,22.05,25.4,10.5,13.4,'glass_sage','left')
 box(-11.45,-8.55,41.78,42,16.88,24.55,'stone');box(-11.4,-8.6,42,42.045,16.92,24.50,'wood')
 for z in [17.5,21.0]:box(-8.95,-8.7,37,41.78,z-.14,z+.14,'porcelain')
 rail((-8.62,42,16.97),(-8.62,42,24.47));rail((-11.38,42,16.97),(-11.38,42,21.75));rail((-11.38,42,24.47),(-8.62,42,24.47))
 front_glass(-11.4,-8.6,42.05,45.4,16.97,1.4)
 # A light pergola and stepped gathering platform on the roof create roof detail at aerial scales.
 for x in [-15,-6,3]:box(x-.09,x+.09,46.8,49.5,10.9,11.08,'charcoal')
 beam((-15,49.5,11), (3,49.5,11),.16,'charcoal')
 if not lod:
  for x in frange(-15,3,.6):box(x-.05,x+.05,49.5,49.62,7.9,12.7,'wood')
 for i in range(3):box(-2,10,46.82,46.82+(3-i)*.24,9.0+i*.55,9.55+i*.55,'wood')
 # Planters and modest trees, using authored geometry, not third-party billboard textures.
 for p in [(-25,-18,17,23.2,24.25,True),(-12,-5,17,23.2,24.25,False),
           (16,23,12,23.1,24.25,False),(13,22,30,19.7,20.95,True),
           (-27,-19,37,23.1,24.25,False),(-7,1.8,37,23.1,24.25,True),
           (-25,-16,46.84,18.8,20.35,True),(-9,-1,46.84,18.8,20.35,True),
           (7,15,46.84,18.8,20.35,True),(22,26.6,46.84,13,14.4,True)]:planter(*p)
 for x in [-24,-5,14]:
  box(x-2.3,x+2.3,46.84,47.25,17.4,18.25,'porcelain');box(x-2.35,x+2.35,47.25,47.33,17.35,18.3,'wood')
 # Side/rear street interfaces differentiate views and avoid empty unarticulated back walls.
 for sx in [-1,1]:
  xx=29.65*sx
  for z in frange(-21,17,3.4):
   box(xx-.05,xx+.05,.55,5.65,z,z+2.8,'glass_sage')
   if not lod:box(xx-.07,xx+.07,.25,6.7,z-.11,z+.11,'aluminium')
 # Narrow green facade panel on the service side, plus two louvred service doors.
 box(-29.98,-29.72,8,20,-20,-8,'leaf_dark')
 if not lod:
  for y in frange(8.2,20,.7):box(-30.03,-29.98,y,y+.05,-20,-8,'leaf_light')
 for x in [-15,14]:
  box(x-2.4,x+2.4,.25,4.0,-24.85,-24.7,'charcoal')
  if not lod:
   for y in frange(.5,3.9,.25):box(x-2.3,x+2.3,y,y+.06,-24.92,-24.85,'aluminium')
 # Setback blue glass office tower: nine tall storeys with alternating light reflections.
 tx0,tx1,tz0,tz1=-20,20,-22.8,7.0
 box(tx0,tx1,46.8,88.2,tz0,tz1,'glass_blue')
 # Individual facade panes + metal mullions read at both mid-distance and close inspection.
 for side in ['front','back','left','right']:
  amin,amax=(tx0,tx1) if side in ['front','back'] else (tz0,tz1)
  n=round((amax-amin)/2.22); step=(amax-amin)/n
  for fl in range(9):
   y0=46.8+fl*4.6;y1=y0+4.6
   for i in range(n):
    p=amin+i*step;q=p+step;mat='glass_light' if (i+fl*2)%9 in [0,1] else 'glass_blue'
    if side=='front':pane(p+.045,q-.045,y0+.14,y1-.30,tz1+.015,tz1+.05,mat,'front')
    elif side=='back':pane(p+.045,q-.045,y0+.14,y1-.30,tz0-.05,tz0-.015,mat,'back')
    elif side=='left':pane(tx0-.05,tx0-.015,y0+.14,y1-.30,p+.045,q-.045,mat,'left')
    else:pane(tx1+.015,tx1+.05,y0+.14,y1-.30,p+.045,q-.045,mat,'right')
   if side=='front':box(tx0,tx1,y1-.17,y1-.04,tz1+.05,tz1+.15,'aluminium')
   elif side=='back':box(tx0,tx1,y1-.17,y1-.04,tz0-.15,tz0-.05,'aluminium')
   elif side=='left':box(tx0-.15,tx0-.05,y1-.17,y1-.04,tz0,tz1,'aluminium')
   else:box(tx1+.05,tx1+.15,y1-.17,y1-.04,tz0,tz1,'aluminium')
  for i in range(n+1):
   p=amin+i*step
   if side=='front':box(p-.035,p+.035,46.8,89.2,tz1+.055,tz1+.19,'aluminium')
   elif side=='back':box(p-.035,p+.035,46.8,89.2,tz0-.19,tz0-.055,'aluminium')
   elif side=='left':box(tx0-.19,tx0-.055,46.8,89.2,p-.035,p+.035,'aluminium')
   else:box(tx1+.055,tx1+.19,46.8,89.2,p-.035,p+.035,'aluminium')
 # Roof crown, inset mechanical enclosure, realistic simplified AC units, no hidden interiors.
 box(-20.1,20.1,88.15,88.35,-22.9,7.1,'aluminium')
 for x0,x1,z0,z1 in [(-20.1,20.1,6.8,7.1),(-20.1,20.1,-22.9,-22.6),(-20.1,-19.8,-22.6,6.8),(19.8,20.1,-22.6,6.8)]:box(x0,x1,88.35,89.2,z0,z1,'glass_blue')
 box(-13,13,88.35,89.8,-18,-7,'charcoal')
 if not lod:
  for y in frange(88.5,89.8,.22):box(-13.04,13.04,y,y+.07,-6.99,-6.94,'aluminium')
 for x in [-13,-5,3,11]:
  box(x,x+5,88.35,89.45,-2,3,'stone')
  if not lod:
   for xx in [x+1.3,x+3.7]:
    cylinder(xx,89.45,.5,.87,.075,'charcoal',12)
    for a in range(3):
     ang=a*math.tau/3;beam((xx,89.53,.5),(xx+math.cos(ang)*.7,89.53,.5+math.sin(ang)*.7),.10,'aluminium')
 # Fictional identity is dimensional geometry, never a real logo or a copied image.
 text_front('MORI',-13.5,10.9,25.06,2.30,'charcoal')
 text_front('T E R R A C E',-13.5,9.6,25.06,.65,'charcoal')
 text_front('MORI',17.1,40.9,19.75,1.45,'charcoal')
 for word,x in [('FORM',-21.4),('KASA',-10.1),('NOVA',10.2),('MORI',21.1)]:
  box(x-2.6,x+2.6,5.45,6.17,22.45,22.57,'charcoal');text_front(word,x,5.61,22.61,.48,'warm_light')
 # Slim signs/wayfinding accent identifies roof and arcade without a texture atlas.
 box(4.2,5.0,.18,4.9,23.1,23.45,'accent')
 text_front('01',4.61,3.68,23.49,.43,'warm_light')
 # Create one object per material: a small, stable primitive/draw-call budget.
 objs=[]
 for mat,(vs,fs) in G.items():
  me=bpy.data.meshes.new(mat+'_geometry');me.from_pydata(vs,[],fs);me.materials.append(MATS[mat]);me.update()
  bm=bmesh.new();bm.from_mesh(me);bmesh.ops.triangulate(bm,faces=list(bm.faces));bad=[f for f in bm.faces if f.calc_area()<1e-10]
  if bad:bmesh.ops.delete(bm,geom=bad,context='FACES')
  bm.to_mesh(me);bm.free();me.update()
  ob=bpy.data.objects.new('MORI_'+mat,me);bpy.context.collection.objects.link(ob);objs.append(ob)
  # Explicit normal consistency on disjoint closed component meshes.
  bpy.context.view_layer.objects.active=ob;ob.select_set(True)
  bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.normals_make_consistent(inside=False);bpy.ops.object.mode_set(mode='OBJECT');ob.select_set(False)
  if not me.uv_layers:me.uv_layers.new(name='UVMap')
  # Deterministic planar UVs; materials are texture-free and need no image resource.
  uv=me.uv_layers.active.data
  for p in me.polygons:
   normal=p.normal;axis=max(range(3),key=lambda k:abs(normal[k]));axes=[k for k in range(3) if k!=axis]
   for li in p.loop_indices:
    co=me.vertices[me.loops[li].vertex_index].co;uv[li].uv=(co[axes[0]]*.2,co[axes[1]]*.2)
 # Final normalization: true horizontal bounds centred at the common origin, ground exactly zero.
 coords=[v.co for o in objs for v in o.data.vertices];cx=(min(v.x for v in coords)+max(v.x for v in coords))/2;cy=(min(v.y for v in coords)+max(v.y for v in coords))/2
 for o in objs:
  for v in o.data.vertices:v.co.x-=cx;v.co.y-=cy
  bm=bmesh.new();bm.from_mesh(o.data);bad=[f for f in bm.faces if ((f.verts[1].co-f.verts[0].co).cross(f.verts[2].co-f.verts[0].co)).length*.5<1e-6]
  if bad:bmesh.ops.delete(bm,geom=bad,context='FACES')
  bm.to_mesh(o.data);bm.free();o.data.update()
 return objs

def glb_stats(path):
 data=path.read_bytes();magic,version,length=struct.unpack_from('<4sII',data);ln,typ=struct.unpack_from('<II',data,12);g=json.loads(data[20:20+ln]);verts=tri=prims=0
 lo=[1e20]*3;hi=[-1e20]*3
 for mesh in g.get('meshes',[]):
  for p in mesh['primitives']:
   prims+=1;a=g['accessors'][p['attributes']['POSITION']];verts+=a['count'];tri+=(g['accessors'][p['indices']]['count']//3)
   for i in range(3):lo[i]=min(lo[i],a['min'][i]);hi[i]=max(hi[i],a['max'][i])
 return {'file':str(path.relative_to(ROOT)),'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'triangles':tri,'vertices':verts,'materials':len(g.get('materials',[])),'meshPrimitives':prims,'meshes':len(g.get('meshes',[])),'nodes':len(g.get('nodes',[])),'textureCount':len(g.get('textures',[])),'imageCount':len(g.get('images',[])),'textureDimensions':[],'externalUris':[x['uri'] for x in g.get('images',[])+g.get('buffers',[]) if 'uri' in x],'boundsMin':lo,'boundsMax':hi,'dimensionsMetres':[hi[i]-lo[i] for i in range(3)],'glbHeaderValid':magic==b'glTF' and version==2 and length==len(data)}

def export(level):
 objs=build(level);name='terraced-retail.glb' if level==0 else 'terraced-retail-lod1.glb';p=OUT/name
 bpy.ops.object.select_all(action='DESELECT')
 for o in objs:o.select_set(True)
 bpy.ops.export_scene.gltf(filepath=str(p),export_format='GLB',use_selection=True,export_yup=True,export_apply=True,export_normals=True,export_texcoords=True,export_materials='EXPORT',export_cameras=False,export_lights=False,export_extras=False)
 return glb_stats(p)

def inspect_import(path):
 bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
 bpy.ops.import_scene.gltf(filepath=str(path));obs=[o for o in bpy.context.scene.objects if o.type=='MESH'];points=[o.matrix_world@Vector(c) for o in obs for c in o.bound_box]
 lo=[min(v[i] for v in points) for i in range(3)];hi=[max(v[i] for v in points) for i in range(3)]
 bad=sum(not math.isfinite(c) for o in obs for v in o.data.vertices for c in v.co)
 zero=sum(p.area<1e-10 for o in obs for p in o.data.polygons)
 return {'tool':'Blender '+bpy.app.version_string,'success':bool(obs),'meshObjects':len(obs),'nonFiniteVertexComponents':bad,'zeroAreaFaces':zero,'blenderBoundsMin':lo,'blenderBoundsMax':hi,'convertedGltfBoundsMin':[lo[0],lo[2],-hi[1]],'convertedGltfBoundsMax':[hi[0],hi[2],-lo[1]],'groundY':lo[2],'positiveYUp':True,'frontAxis':'+Z','notes':'Actual exported GLB imported into a new cleared Blender scene. Blender uses Z up; importer converts glTF Y up to Blender Z up.'}

def render_previews():
 scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.use_denoising=False;scene.cycles.device='CPU';scene.render.threads_mode='FIXED';scene.render.threads=2
 scene.render.resolution_x=1080;scene.render.resolution_y=1080;scene.render.resolution_percentage=100
 scene.world.color=(.75,.78,.83);scene.view_settings.view_transform='AgX';scene.render.image_settings.file_format='PNG'
 w=scene.world;w.use_nodes=True;w.node_tree.nodes['Background'].inputs[0].default_value=(.72,.79,.88,1);w.node_tree.nodes['Background'].inputs[1].default_value=.7
 bpy.ops.mesh.primitive_plane_add(size=800,location=(0,0,-.035));ground=bpy.context.object;ground.name='PREVIEW_ONLY_ground';m=bpy.data.materials.new('PREVIEW_ONLY_ground');m.diffuse_color=(.72,.74,.71,1);ground.data.materials.append(m)
 bpy.ops.object.light_add(type='AREA',location=(65,-75,145));light=bpy.context.object;light.data.energy=110000;light.data.shape='DISK';light.data.size=80;light.rotation_euler=(Vector((0,0,40))-light.location).to_track_quat('-Z','Y').to_euler()
 bpy.ops.object.light_add(type='SUN',location=(0,0,120));sun=bpy.context.object;sun.data.energy=1.7;sun.data.angle=math.radians(18);sun.rotation_euler=(math.radians(24),math.radians(-29),math.radians(-34))
 bpy.ops.object.camera_add();cam=bpy.context.object;scene.camera=cam;cam.data.type='ORTHO';cam.data.lens=48;cam.data.clip_end=1000
 views=[('front',(0,45,190),(0,43,0),105),('oblique',(135,105,155),(0,42,0),122),('roof',(105,175,125),(0,43,0),128)]
 for name,eye,target,scale in views:
  if args.views and name not in args.views:continue
  cam.location=xyz(eye);cam.rotation_euler=(Vector(xyz(target))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.ortho_scale=scale;scene.render.filepath=str(OUT/(name+'.png'));bpy.ops.render.render(write_still=True)

if args.preview_only:
 inspect_import(OUT/'terraced-retail.glb');render_previews();sys.exit(0)
stats=[]
if not args.lod_only:stats.append(export(0))
stats.append(export(1))
for stat in stats:stat['importCheck']=inspect_import(ROOT/stat['file'])
manifest={'schemaVersion':1,'assetId':'terraced-retail','displayName':'MORI TERRACE','description':'Original Shibuya PARCO-inspired terraced retail podium and setback office tower. Fictional signage and authored geometry; not a survey model or exact replica.','units':'metres','coordinateSystem':{'up':'+Y','front':'+Z','groundY':0,'origin':'Exact horizontal bounding-box centre at ground Y=0; nominal footprint 60 m × 50 m','authoring':'Blender native Z-up, via an explicit right-handed coordinate transform; glTF exporter Y-up conversion enabled.'},'inferredDesignDimensions':{'nominalWidthMetres':60,'nominalDepthMetres':50,'heightMetres':89.8,'podiumRoofMetres':46.8,'towerStoreys':9,'commercialLevelsApproximate':10,'status':'All asset dimensions and facade bay spacing are inferred design choices, not measured dimensions of the referenced building. Small facade seams protrude a few centimetres beyond nominal bounds.'},'sourceBuildingFacts':{'aboveGroundStoreys':19,'basementStoreys':3,'source':'https://www.takenaka.co.jp/design/works/shibuya-parco-hulic-building/','usage':'Reference metadata only; original asset proportions intentionally simplified.'},'geometryFeatures':['Interlocking pale podium masses and genuine recessed terrace slots','Open central ground arcade and recessed shopfront doors','Illustrative exterior stair flights and slender handrails','Setback nine-storey glass office tower with mullions and spandrels','Planter trees, wooden terrace decks, bench-planters and pergola','Roof crown, screened mechanical enclosure and simplified rooftop HVAC'],'materialPolicy':{'physicallyBased':True,'glass':'Opaque tinted reflective approximation for browser performance; no alpha-sorting dependency, no interior transmission','textures':'None. All surface colours, signs and vegetation are original geometry/materials.','uvs':'Deterministic planar UVs provided; no photo-derived texture atlases.'},'lods':stats,'reproduce':'blender -b -t 2 --python scripts/external-v080/terraced-retail/generate.py -- --render','previewMethod':'CPU Cycles renders of the re-imported full-detail GLB; preview-only floor, camera and lighting are not exported.','knownLimitations':['Reference photographs are dated 2021, not a claim about the present tenant mix.','This is an original inspired design, not exact PARCO geometry; inferred dimensions must not be used as survey data.','No enterable interiors, basement, collision or navigation mesh. Stair circulation is an illustrative exterior feature and has not been certified traversable.','Opaque glass is intentionally optimized; physically transparent glazing requires integration work.','Small intersecting architectural solids remain where columns, cladding, mullions or planter foliage meet; hidden core/intersection faces are not all boolean-unioned.','LOD1 removes fine seams, deck joints, foliage clusters, hardware and small text; it is an optional independently loaded GLB, without automatic LOD extensions.','No application integration, street placement, global tests, production build or deployment was performed.'],'referencesDocument':'docs/external/dot/terraced-retail/references.md','generatedWith':'Blender '+bpy.app.version_string}
(DOC/'manifest.json').write_text(json.dumps(manifest,indent=2,ensure_ascii=False)+'\n')
if args.render and not args.lod_only:
 inspect_import(OUT/'terraced-retail.glb');render_previews()
print('TERRACED_RETAIL_COMPLETE '+json.dumps([{'file':s['file'],'triangles':s['triangles'],'vertices':s['vertices'],'bytes':s['bytes'],'materials':s['materials'],'bounds':s['dimensionsMetres']} for s in stats]))

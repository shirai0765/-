"""Blender Cycles presentation renders and editable asset scenes.

blender -b -t 4 --python scripts/render-architecture.py -- --asset 109
Imported architecture is preserved; presentation ground/lights have separate names.
"""
import argparse
import math
import sys
from pathlib import Path
import bpy
from mathutils import Vector

parser = argparse.ArgumentParser()
parser.add_argument('--asset', choices=['109', 'cafe', 'qfront'], required=True)
parser.add_argument('--output', type=Path, default=Path('/workspace/shared/shibuya-artifacts/architecture'))
parser.add_argument('--samples', type=int, default=64)
parser.add_argument('--width', type=int, default=1600)
args = parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.import_scene.gltf(filepath=str(args.output / f'{args.asset}.glb'))
scene = bpy.context.scene
mesh_objects = [o for o in scene.objects if o.type == 'MESH']
assert mesh_objects, 'GLB import contains no architecture'
corners = [o.matrix_world @ Vector(c) for o in mesh_objects for c in o.bound_box]
minimum = Vector([min(v[i] for v in corners) for i in range(3)])
maximum = Vector([max(v[i] for v in corners) for i in range(3)])
center = (minimum + maximum) / 2
size = maximum - minimum
height = size.z
scale = max(size)

world = bpy.data.worlds.new('Presentation — soft daylight')
scene.world = world
world.use_nodes = True
world.node_tree.nodes['Background'].inputs[0].default_value = (.65, .73, .82, 1)
world.node_tree.nodes['Background'].inputs[1].default_value = .5

def area(name, location, target, energy, diameter, color):
    data = bpy.data.lights.new(name, 'AREA'); data.energy = energy; data.shape = 'DISK'; data.size = diameter; data.color = color
    obj = bpy.data.objects.new(name, data); scene.collection.objects.link(obj); obj.location = location
    obj.rotation_euler = (Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()
    return obj

sun_data = bpy.data.lights.new('Presentation — afternoon sun', 'SUN')
sun_data.energy = 2.3; sun_data.angle = math.radians(12)
sun = bpy.data.objects.new(sun_data.name, sun_data); scene.collection.objects.link(sun)
sun.rotation_euler = (math.radians(28), math.radians(-32), math.radians(-28))
area('Presentation — front softbox', (scale*.8,-scale*.85,height*.9), center, scale**2*40, scale*.8, (1,.90,.79))
area('Presentation — cool sky fill', (-scale,scale*.25,height*.8), center, scale**2*14, scale, (.74,.85,1))

bpy.ops.mesh.primitive_plane_add(size=scale*200, location=(center.x, center.y, minimum.z-.03))
ground = bpy.context.object; ground.name = 'Presentation — neutral concrete ground'
material = bpy.data.materials.new('Presentation — fine concrete'); material.use_nodes = True
nodes = material.node_tree.nodes; links = material.node_tree.links
bsdf = nodes.get('Principled BSDF'); bsdf.inputs['Base Color'].default_value = (.26,.285,.30,1); bsdf.inputs['Roughness'].default_value = .88
noise = nodes.new('ShaderNodeTexNoise'); noise.inputs['Scale'].default_value = 140
bump = nodes.new('ShaderNodeBump'); bump.inputs['Strength'].default_value = .15; bump.inputs['Distance'].default_value = .025
links.new(noise.outputs['Fac'],bump.inputs['Height']); links.new(bump.outputs['Normal'],bsdf.inputs['Normal'])
ground.data.materials.append(material)

cam_data = bpy.data.cameras.new('Presentation camera'); camera = bpy.data.objects.new(cam_data.name,cam_data)
scene.collection.objects.link(camera); scene.camera = camera
cam_data.lens = 55; cam_data.clip_end = scale*250
def camera_at(location, target):
    camera.location = location; camera.rotation_euler = (Vector(target)-camera.location).to_track_quat('-Z','Y').to_euler()

scene.render.engine = 'CYCLES'; scene.cycles.device = 'CPU'; scene.cycles.samples = args.samples
scene.cycles.use_denoising = False  # Managed Blender build lacks OpenImageDenoise support.
scene.render.threads_mode = 'FIXED'; scene.render.threads = 4
scene.render.resolution_x = args.width; scene.render.resolution_y = round(args.width*.875); scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'; scene.render.film_transparent = False
scene.view_settings.view_transform = 'AgX'
scene['provenance'] = 'Authored photo-guided approximate exterior study. Not a scan or measured survey. Presentation lights/ground added in Blender.'
scene.unit_settings.system = 'METRIC'
if args.asset != 'cafe':
    camera_at((center.x+scale*.82,center.y-scale*2.0,minimum.z+height*.68),(center.x,center.y,minimum.z+height*.47))
else:
    camera_at((center.x+scale*.98,center.y-scale*1.75,minimum.z+height*1.18),(center.x,center.y,minimum.z+height*.42))
bpy.ops.wm.save_as_mainfile(filepath=str(args.output / f'{args.asset}.blend'))
scene.render.filepath = str(args.output / f'{args.asset}-hero.png'); bpy.ops.render.render(write_still=True)
if args.asset != 'cafe':
    camera_at((center.x-scale*.5,minimum.y-scale*1.0,minimum.z+2.2),(center.x,minimum.y+2,minimum.z+height*.21))
else:
    camera_at((center.x-scale*.25,minimum.y-scale*1.22,minimum.z+2.0),(center.x,minimum.y+1,minimum.z+height*.40))
cam_data.lens=48
scene.render.filepath = str(args.output / f'{args.asset}-street.png'); bpy.ops.render.render(write_still=True)
print('ARCHITECTURE_RENDERED',args.asset,'meshes',len(mesh_objects),'bounds',list(minimum),list(maximum),flush=True)

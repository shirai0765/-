"""Blender-only daylight presentation of unchanged official Shibuya geometry.
blender --background real-shibuya.blend --threads 4 --python scripts/render-real-shibuya.py -- --test
"""
import argparse,hashlib,json,math,pathlib,sys
import bpy
from mathutils import Vector
args=argparse.ArgumentParser();args.add_argument('--test',action='store_true');args.add_argument('--camera',choices=['overview','109'],default='overview');args.add_argument('--save-only',action='store_true');options=args.parse_args(sys.argv[sys.argv.index('--')+1:]if'--'in sys.argv else[])
ROOT=pathlib.Path('/workspace/shared/shibuya-artifacts/blender-polish/real-shibuya');ROOT.mkdir(parents=True,exist_ok=True)
scene=bpy.context.scene
source_meshes=[obj for obj in scene.objects if obj.type=='MESH']
assert len(source_meshes)==112,f'Unexpected original model mesh count: {len(source_meshes)}'
original_images={image.name:hashlib.sha256(image.packed_file.data).hexdigest()for image in bpy.data.images if image.packed_file}
assert len(original_images)==92
# Capture source shape, transform and source pixel-container fingerprints before presentation changes.
def geometry_hash():
 digest=hashlib.sha256()
 for obj in sorted(source_meshes,key=lambda item:item.name):
  digest.update(obj.name.encode());digest.update(str(tuple(value for row in obj.matrix_world for value in row)).encode())
  for v in obj.data.vertices:digest.update(str(tuple(v.co)).encode())
  for p in obj.data.polygons:digest.update(str(tuple(p.vertices)).encode())
 return digest.hexdigest()
geometry_before=geometry_hash()
buildings=bpy.data.objects['Official_PLATEAU_Shibuya_2025'];ground=bpy.data.objects['GSI_seamless_aerial_flat_ground']
ground_materials={m for obj in ground.children_recursive if obj.type=='MESH' for m in obj.data.materials if m}
building_materials={m for obj in buildings.children_recursive if obj.type=='MESH' for m in obj.data.materials if m}
for material in building_materials-ground_materials:
 if not material.use_nodes:continue
 nodes=material.node_tree.nodes;links=material.node_tree.links
 principled=next((node for node in nodes if node.type=='BSDF_PRINCIPLED'),None)
 output=next(node for node in nodes if node.type=='OUTPUT_MATERIAL')
 if principled is None:continue
 principled.inputs['Metallic'].default_value=0;principled.inputs['Roughness'].default_value=1
 principled.inputs['Specular IOR Level'].default_value=.12
 # Captured photographic shading is primarily self-lit. A small diffuse share adds
 # gentle physical form without putting the already shaded facade into a second deep shadow.
 emission=nodes.new('ShaderNodeEmission');emission.name='Photograph_colour_preserved';emission.inputs['Strength'].default_value=1.05
 colour=principled.inputs['Base Color']
 if colour.is_linked:links.new(colour.links[0].from_socket,emission.inputs['Color'])
 else:emission.inputs['Color'].default_value=colour.default_value
 mix=nodes.new('ShaderNodeMixShader');mix.name='Baked_photo_with_gentle_daylight';mix.inputs[0].default_value=.82
 links.new(principled.outputs['BSDF'],mix.inputs[1]);links.new(emission.outputs['Emission'],mix.inputs[2]);links.new(mix.outputs[0],output.inputs['Surface'])
 material['presentation']='82% photograph emission / 18% neutral diffuse; original packed image bytes unchanged'
# GSI ground is already an unlit photograph: preserve its original material and elevation.
world=bpy.data.worlds.new('Soft_neutral_daylight');world.use_nodes=True;world.node_tree.nodes['Background'].inputs['Color'].default_value=(.72,.79,.84,1);world.node_tree.nodes['Background'].inputs['Strength'].default_value=.65;scene.world=world
sun_data=bpy.data.lights.new('Soft_daylight_sun','SUN');sun_data.energy=1.25;sun_data.angle=math.radians(12);sun=bpy.data.objects.new('Soft_daylight_sun',sun_data);scene.collection.objects.link(sun);sun.rotation_euler=(math.radians(25),math.radians(-20),math.radians(-35))
def camera(name,position,target,ortho=None):
 data=bpy.data.cameras.new(name);obj=bpy.data.objects.new(name,data);scene.collection.objects.link(obj);obj.location=position;obj.rotation_euler=(Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler();data.clip_start=.1;data.clip_end=6000
 if ortho:data.type='ORTHO';data.ortho_scale=ortho
 else:data.lens=38
 return obj
overview=camera('Daylight_entire_real_Shibuya',(950,-1200,1100),(0,0,55),1540)
close=camera('Daylight_actual_109',(-90,80,105),(-170,4,28))
scene.camera=overview if options.camera=='overview'else close
scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=16 if options.test else 32;scene.cycles.use_denoising=False;scene.cycles.max_bounces=3;scene.cycles.diffuse_bounces=1;scene.cycles.glossy_bounces=1
scene.render.threads_mode='FIXED';scene.render.threads=4;scene.render.resolution_x=720 if options.test else 1600;scene.render.resolution_y=540 if options.test else 1200;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG';scene.render.film_transparent=False
scene.view_settings.view_transform='Standard';scene.view_settings.look='None';scene.view_settings.exposure=.05;scene.view_settings.gamma=1
for obj in source_meshes:assert not obj.hide_render and not obj.hide_viewport
assert geometry_hash()==geometry_before
assert all(hashlib.sha256(bpy.data.images[name].packed_file.data).hexdigest()==digest for name,digest in original_images.items())
scene['daylight_presentation']='Photo-preserving emission/diffuse mix; geometry and original texture bytes unchanged.'
scene['flat_ground_limitation']='GSI imagery is on the existing flat approximation. Gaps at uphill building bases are retained, not covered.'
scene['source_geometry_sha256']=geometry_before
scene.render.filepath=str(ROOT/(('test-'if options.test else'daylight-')+options.camera+'.png'))
# Save the polished scene independently of the original deliverable.
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'daylight.blend'),compress=True)
manifest={'source':'/workspace/shared/shibuya-artifacts/real-shibuya.blend','meshes':len(source_meshes),'buildingMeshes':len([o for o in buildings.children_recursive if o.type=='MESH']),'groundMeshes':len([o for o in ground.children_recursive if o.type=='MESH']),'packedImages':len(original_images),'originalImageBytesUnchanged':True,'geometrySha256':geometry_before,'geometryUnchanged':True,'threads':4,'samples':scene.cycles.samples,'camera':scene.camera.name,'groundElevationUnchanged':True,'groundLimitation':scene['flat_ground_limitation']}
(ROOT/'presentation-checks.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
print('PRESENTATION_READY',json.dumps(manifest),flush=True)
if not options.save_only:bpy.ops.render.render(write_still=True)

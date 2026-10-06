"""Run: blender --background --python scripts/prepare-real-blender.py
Import the actual georeferenced model without changing its physical dimensions.
"""
import bpy,json,pathlib,math
from mathutils import Euler,Vector
root=pathlib.Path('/workspace/shared/shibuya-artifacts')
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(root/'real-shibuya.glb'))
scene=bpy.context.scene;scene.unit_settings.system='METRIC';scene.unit_settings.scale_length=1
scene['source']='東京都・国土交通省 Project PLATEAU 渋谷区建築物2025 + 地理院タイル シームレス空中写真'
scene['coordinates']='Local east/north/up after Blender glTF import; origin 139.7006E 35.6595N ellipsoid height50m. OriginalGLB X-east Y-up Z-south.'
scene['terrain']='Raw aerial photo tiles on a flat approximation; no terrain elevation mesh.'
scene['license_references']='https://www.mlit.go.jp/plateau/site-policy/ ; https://www.gsi.go.jp/kikakuchousei/kikakuchousei40182.html'
text=bpy.data.texts.new('READ_ME_SOURCES.txt');text.write('Actual Shibuya model, not the fictional gameplay map.\n'+scene['source']+'\n'+scene['coordinates']+'\n'+scene['terrain']+'\n'+scene['license_references']+'\nSee real-shibuya-glb-qa.json and source manifests for acquisition records.\n')
# Embedded GLB images are packed to keep the .blend portable.
bpy.ops.file.pack_all()
bpy.ops.object.select_all(action='DESELECT')
for screen in bpy.data.screens:
 for area in screen.areas:
  if area.type=='VIEW_3D':
   space=area.spaces.active;space.clip_end=5000;space.shading.type='SOLID';space.shading.color_type='TEXTURE';space.region_3d.view_distance=850;space.region_3d.view_location=Vector((-20,0,30));space.region_3d.view_rotation=Euler((math.radians(58),0,math.radians(30)),'XYZ').to_quaternion()
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(root/'real-shibuya.blend'),compress=True)
print(json.dumps({'objects':len(scene.objects),'meshes':len(bpy.data.meshes),'images':len(bpy.data.images),'blendBytes':(root/'real-shibuya.blend').stat().st_size}))

# Reopen the saved file: verify persisted textures and glTF Y-up -> Blender Z-up axes.
bpy.ops.wm.open_mainfile(filepath=str(root/'real-shibuya.blend'))
buildings=bpy.data.objects.get('Official_PLATEAU_Shibuya_2025');assert buildings is not None
points=[obj.matrix_world@vertex.co for obj in buildings.children_recursive if obj.type=='MESH' for vertex in obj.data.vertices]
minimum=[min(v[i]for v in points)for i in range(3)];maximum=[max(v[i]for v in points)for i in range(3)]
qa=json.loads((root/'real-shibuya-glb-qa.json').read_text());gmin=qa['bounds']['min'];gmax=qa['bounds']['max'];expected_min=[gmin[0],-gmax[2],gmin[1]];expected_max=[gmax[0],-gmin[2],gmax[1]]
assert max(abs(a-b)for a,b in zip(minimum+maximum,expected_min+expected_max))<.05
packed=sum(1 for image in bpy.data.images if image.packed_file is not None);assert packed>=92
result={'status':'passed','reopenedSavedFile':True,'buildingBoundsBlenderZUp':{'min':minimum,'max':maximum},'packedImages':packed,'sceneObjects':len(bpy.context.scene.objects),'blendBytes':(root/'real-shibuya.blend').stat().st_size}
(root/'real-shibuya-blender-qa.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))

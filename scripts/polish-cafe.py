"""Blender geometry/PBR refinement of the authored café; no source asset overwrite.

blender -b -t 2 --python scripts/polish-cafe.py -- [--input path.glb] [--output directory]
Blender coordinates: Z up, front -Y. glTF output: Y up, front +Z.
Photographic rationale: docs/cafe-photo-study.md. Unmeasured details remain authored.
"""
import argparse
import hashlib
import json
import math
import sys
from pathlib import Path
import bpy
import bmesh
from mathutils import Matrix, Vector

parser = argparse.ArgumentParser()
parser.add_argument('--input', type=Path, default=Path('/workspace/shared/shibuya-artifacts/architecture/cafe.glb'))
parser.add_argument('--output', type=Path, default=Path('/workspace/shared/shibuya-artifacts/blender-polish/cafe'))
parser.add_argument('--showcase-only', action='store_true', help='Preserve existing game GLB/BLEND byte-for-byte; update display optics only')
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
args.output.mkdir(parents=True, exist_ok=True)
protected_game = {}
if args.showcase_only:
    for filename in ('cafe-polished.glb', 'cafe-game.blend'):
        protected_game[filename] = (args.output / filename).read_bytes()
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.import_scene.gltf(filepath=str(args.input))
scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'
scene.unit_settings.scale_length = 1
labels = ['stone_plinth', 'grey_plaster', 'vertical_oak', 'charcoal_metal', 'bronze_frames', 'black_canvas', 'glazing', 'horizontal_oak', 'brass', 'porcelain', 'menu', 'warm_light', 'green_medallion', 'medallion_graphic', 'replaceable_wordmark', 'soil', 'foliage']
material_map = {}
for i, label in enumerate(labels):
    material = bpy.data.materials.get(f'Material_{i}')
    if material is None:
        raise RuntimeError('Unexpected input material layout; inspect the new source GLB before polishing.')
    material.name = 'Cafe_' + label
    material_map[label] = material

def principled(material):
    return next(n for n in material.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')

def bounds(obj):
    coords = [obj.matrix_world @ Vector(c) for c in obj.bound_box]
    return Vector([min(v[i] for v in coords) for i in range(3)]), Vector([max(v[i] for v in coords) for i in range(3)])

def all_bounds():
    coords = [o.matrix_world @ Vector(c) for o in scene.objects if o.type == 'MESH' for c in o.bound_box]
    return [[min(v[i] for v in coords) for i in range(3)], [max(v[i] for v in coords) for i in range(3)]]

# Bake the source root transform once, preserving its pavement origin and dimensions.
for obj in list(scene.objects):
    if obj.type == 'MESH':
        world = obj.matrix_world.copy()
        obj.parent = None
        obj.data.transform(world)
        obj.matrix_world = Matrix.Identity(4)
for obj in list(scene.objects):
    if obj.type != 'MESH':
        bpy.data.objects.remove(obj, do_unlink=True)
original_bounds = all_bounds()

# Connected components are useful architectural parts; no guessed mesh-name UUIDs.
for obj in list(scene.objects):
    if obj.type != 'MESH':
        continue
    bm = bmesh.new(); bm.from_mesh(obj.data)
    bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=0.000005)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(obj.data); bm.free(); obj.data.update()
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True); bpy.context.view_layer.objects.active = obj
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.separate(type='LOOSE'); bpy.ops.object.mode_set(mode='OBJECT')

changes = []
counters = {'counter_parts_lowered': 0, 'chairs_rescaled_parts': 0, 'beveled_parts': 0, 'solidified_panes': 0, 'awning_ends': 0}
# PBR values export directly; existing image-based wood/lettering UVs remain intact.
settings = {
    'stone_plinth': (0, .76), 'grey_plaster': (0, .86),
    'vertical_oak': (0, .47), 'horizontal_oak': (0, .39),
    'charcoal_metal': (.65, .34), 'bronze_frames': (.76, .30),
    'black_canvas': (0, .96), 'brass': (.82, .29), 'porcelain': (0, .25),
    'green_medallion': (.12, .42), 'foliage': (0, .81),
}
for label, (metal, rough) in settings.items():
    node = principled(material_map[label]); node.inputs['Metallic'].default_value = metal; node.inputs['Roughness'].default_value = rough
# Neutral/very slightly cool dielectric: physical display version, not tinted metallic glass.
glass_node = principled(material_map['glazing'])
glass_node.inputs['Base Color'].default_value = (.94, .98, .97, 1)
glass_node.inputs['Metallic'].default_value = 0
glass_node.inputs['Roughness'].default_value = .01
glass_node.inputs['IOR'].default_value = 1.45
glass_node.inputs['Alpha'].default_value = 1
glass_node.inputs['Transmission Weight'].default_value = 1
warm_node = principled(material_map['warm_light'])
warm_node.inputs['Base Color'].default_value = (1, .9, .71, 1)
warm_node.inputs['Emission Color'].default_value = (1, .73, .43, 1)
warm_node.inputs['Emission Strength'].default_value = 1.15
# Avoid double-sided opaque surfaces; optical panes have real thickness below.
for label, mat in material_map.items():
    mat.use_backface_culling = label not in ('glazing', 'menu', 'medallion_graphic', 'replaceable_wordmark')

chair_centers = [-3.36, -2.24, -1.36, -.24]
wordmark_objects = []
for obj in list(scene.objects):
    if obj.type != 'MESH':
        continue
    material = obj.data.materials[0]
    label = material.name.removeprefix('Cafe_')
    low, high = bounds(obj); center = (low + high) / 2; size = high - low
    obj.name = f'cafe_{label}'
    if label == 'replaceable_wordmark':
        obj.name = 'SIGN_REPLACEABLE_WORDMARK'
        obj['role'] = 'optional static lettering; omitted from game GLB'
        obj['dynamic_sign_source_y'] = 3.47
        wordmark_objects.append(obj)
        continue
    if label == 'medallion_graphic':
        obj.name = 'SIGN_FICTIONAL_HOSHI_MEDALLION'
    # Customer service counter lowered 197.5 mm; shelves and wall menu stay where they were.
    if center.y > 1.45 and size.x > 3 and label in ('vertical_oak', 'horizontal_oak') and high.z < 1.35:
        for v in obj.data.vertices:
            if label == 'vertical_oak':
                v.co.z = .17 + (v.co.z - .17) * (.8225 / 1.02)
            else:
                v.co.z -= .1975
        counters['counter_parts_lowered'] += 1
    elif center.y > 1.45 and low.z >= 1.27 and high.z < 1.85 and label in ('glazing', 'bronze_frames', 'charcoal_metal', 'brass', 'porcelain'):
        for v in obj.data.vertices: v.co.z -= .1975
        counters['counter_parts_lowered'] += 1
    # Widen the 360 mm chair seats/backrests to about 420 mm, keeping the original 460 mm seat height.
    if center.y < -.45 and high.z < 1.1 and label in ('vertical_oak', 'horizontal_oak', 'charcoal_metal'):
        nearest = min(chair_centers, key=lambda x: abs(x - center.x))
        if abs(center.x - nearest) < .19 and size.x < .42:
            for v in obj.data.vertices:
                v.co.x = nearest + (v.co.x - nearest) * (7 / 6)
            counters['chairs_rescaled_parts'] += 1
    # Thin real glazing shell avoids an implausible zero-thickness transmission plane.
    if label == 'glazing' and min(size) < .0001:
        mod = obj.modifiers.new('6 mm architectural glazing', 'SOLIDIFY'); mod.thickness = .006; mod.offset = 0
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.modifier_apply(modifier=mod.name)
        counters['solidified_panes'] += 1
    # Chamfers are geometry, survive glTF, and catch grazing light without excessive subdivisions.
    bevel_width = .0018 if label in ('bronze_frames', 'brass') else .0025 if label == 'charcoal_metal' else .006 if label == 'stone_plinth' else .004 if label in ('vertical_oak', 'horizontal_oak') else 0
    if bevel_width and len(obj.data.polygons) > 3:
        bpy.context.view_layer.objects.active = obj
        mod = obj.modifiers.new('Real edge radius', 'BEVEL'); mod.width = bevel_width; mod.segments = 2; mod.limit_method = 'ANGLE'; mod.angle_limit = math.radians(48); mod.affect = 'EDGES'; mod.use_clamp_overlap = True
        bpy.ops.object.modifier_apply(modifier=mod.name)
        counters['beveled_parts'] += 1
        # Area-weighted normals preserve flat metal/wood faces while softening the new bevels.
        for polygon in obj.data.polygons: polygon.use_smooth = True
        normal = obj.modifiers.new('Face weighted normals', 'WEIGHTED_NORMAL'); normal.keep_sharp = True; normal.weight = 45
        bpy.ops.object.modifier_apply(modifier=normal.name)
    obj.data.update()

# A folded awning needs closed end cheeks and a round stitched front edge, not a thick slab.
fabric = material_map['black_canvas']
for x in (-3.81, 3.81):
    mesh = bpy.data.meshes.new('awning side profile')
    # Blender -Y is street/front; all vertices stay inside the existing silhouette.
    verts = [(x, -.11, 3.09), (x, -.70, 3.02), (x, -.70, 2.90)]
    mesh.from_pydata(verts, [], [(0, 1, 2)]); mesh.materials.append(fabric)
    obj = bpy.data.objects.new('awning_folded_end', mesh); scene.collection.objects.link(obj)
    shell = obj.modifiers.new('Canvas edge thickness', 'SOLIDIFY'); shell.thickness = .004
    bpy.context.view_layer.objects.active = obj; bpy.ops.object.modifier_apply(modifier=shell.name)
    counters['awning_ends'] += 1

# Keep the per-material batching, but the static name remains a separately removable object.
for material in list(material_map.values()):
    objects = [o for o in scene.objects if o.type == 'MESH' and o.data.materials and o.data.materials[0] == material]
    if not objects: continue
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects: o.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    if len(objects) > 1: bpy.ops.object.join()
    obj = bpy.context.object
    if material == material_map['replaceable_wordmark']: obj.name = 'SIGN_REPLACEABLE_WORDMARK'
    elif material == material_map['medallion_graphic']: obj.name = 'SIGN_FICTIONAL_HOSHI_MEDALLION'
    else: obj.name = material.name

for image in bpy.data.images:
    if image.size[0] > 0 and not image.packed_file: image.pack()
scene['asset'] = 'HOSHI COFFEE — Blender geometry polish'
scene['provenance'] = 'Authored reusable café. Ginza 2022 photographs guide storefront; Reserve observations guide restrained materials. Not a measured branch replica.'
scene['source_glb_sha256'] = hashlib.sha256(args.input.read_bytes()).hexdigest()
scene['front_axis'] = '-Y in Blender; +Z in glTF'
scene['wordmark_game_variant'] = 'SIGN_REPLACEABLE_WORDMARK excluded from cafe-polished.glb'
scene['glass_showcase'] = '6 mm geometry; IOR 1.45; transmission 1; roughness .01'
scene['glass_game'] = 'Same shell; core PBR alpha .08; metallic 0; roughness .07; transmission 0 for lower render-pass cost'


def metrics():
    meshes = [o for o in scene.objects if o.type == 'MESH']
    triangles = 0
    for o in meshes: o.data.calc_loop_triangles(); triangles += len(o.data.loop_triangles)
    return {'meshes': len(meshes), 'triangles': triangles, 'materials': len({m.name for o in meshes for m in o.data.materials}), 'bounds_blender_z_up': all_bounds()}

report = metrics()
assert report['triangles'] <= 45000, report
assert report['materials'] <= 20, report
for lohi in (0, 1):
    for axis in range(3): assert abs(report['bounds_blender_z_up'][lohi][axis] - original_bounds[lohi][axis]) < .015, (original_bounds, report)
# Save the inspection/master scene with actual dielectric glass and optional static lettering.
bpy.ops.wm.save_as_mainfile(filepath=str(args.output / 'cafe-polished.blend'))
export_options = dict(export_format='GLB', export_yup=True, export_apply=True, export_extras=True, export_materials='EXPORT', export_image_format='AUTO', export_texcoords=True, export_normals=True, export_cameras=False, export_lights=False)
bpy.ops.export_scene.gltf(filepath=str(args.output / 'cafe.glb'), **export_options)
if not args.showcase_only:
    # Cheap game variant: no static name, no transmission framebuffer pass for repeated shops.
    wordmark = bpy.data.objects.get('SIGN_REPLACEABLE_WORDMARK')
    bpy.ops.object.select_all(action='SELECT')
    if wordmark: wordmark.select_set(False)
    glass_node.inputs['Transmission Weight'].default_value = 0
    glass_node.inputs['Roughness'].default_value = .07
    glass_node.inputs['Alpha'].default_value = .08
    glass_node.inputs['Base Color'].default_value = (.88, .94, .92, 1)
    bpy.ops.export_scene.gltf(filepath=str(args.output / 'cafe-polished.glb'), use_selection=True, **export_options)
    # Keep a ready-to-inspect game scene as well, with the showcase master left unchanged on disk.
    if wordmark: wordmark.hide_render = True; wordmark.hide_set(True)
    bpy.ops.wm.save_as_mainfile(filepath=str(args.output / 'cafe-game.blend'))
report.update({'source': str(args.input), 'source_sha256': scene['source_glb_sha256'], 'changes': counters, 'showcase_glb': 'cafe.glb', 'game_glb': 'cafe-polished.glb', 'game_wordmark': False, 'showcase_wordmark': True, 'glass': {'showcase': {'transmission': 1, 'ior': 1.45, 'roughness': .01}, 'game': {'transmission': 0, 'alpha': .08, 'metallic': 0}}, 'notes': ['No source TypeScript or original GLB modified.', 'No presentation lights or ground included.', 'Counter top lowered 197.5 mm to about 1.08 m; chair width about .42 m; unmeasured authored adjustments.']})
for name in ('cafe.glb', 'cafe-polished.glb', 'cafe-polished.blend', 'cafe-game.blend'):
    path = args.output / name; report[name] = {'bytes': path.stat().st_size, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()}
(args.output / 'info.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
for filename, expected in protected_game.items():
    assert (args.output / filename).read_bytes() == expected, 'Game asset changed during showcase-only update'
print('CAFE_POLISHED', json.dumps(report), flush=True)

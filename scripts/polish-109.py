"""Finish the existing photo-guided 109 / fictional 108 assets inside Blender.

No rendering, source edits, surveyed-dimension claims, or invented architectural
features. Real-metre chamfers and normal corrections are applied to mesh data;
subtle metal roughness is a packed image that survives glTF export.

Reproduce (Vite running for the first command):
  python3 scripts/export-architecture.py --asset 109 --fictional \
    --output /workspace/shared/shibuya-artifacts/blender-polish/inputs
  blender -b --threads 2 --python scripts/polish-109.py -- --variant both

The original architecture/109.glb and .blend are never overwritten. Output .blend
files retain the finished meshes, semantic object names and packed textures.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import sys
import time

import bpy
import bmesh
import numpy as np
from mathutils import Vector

parser = argparse.ArgumentParser()
parser.add_argument('--variant', choices=['109', '108', 'both'], default='both')
parser.add_argument('--input', type=Path, default=Path('/workspace/shared/shibuya-artifacts/architecture/109.glb'))
parser.add_argument('--game-input', type=Path, default=Path('/workspace/shared/shibuya-artifacts/blender-polish/inputs/108.glb'))
parser.add_argument('--output', type=Path, default=Path('/workspace/shared/shibuya-artifacts/blender-polish/109'))
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
args.output.mkdir(parents=True, exist_ok=True)

# widths are metres, not a screen-space effect. One segment is a small physical
# chamfer, avoiding subdivision of entire walls or decorative polygon inflation.
BEVEL_WIDTHS = {
    'light_grey_enamelled_wing_panels': .018,
    'street_level_stone_and_roof_concrete': .012,
    'anodised_aluminium_edges': .0025,
    'entrance_golden_steel_truss': .002,
    'black_metal_shopfront': .004,
    'blue_grey_retail_glazing': .001,
    'glass_reflection_variation': .001,
}


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def triangles(objects):
    total = 0
    for obj in objects:
        obj.data.calc_loop_triangles()
        total += len(obj.data.loop_triangles)
    return total


def bounds(objects):
    coords = [obj.matrix_world @ Vector(p) for obj in objects for p in obj.bound_box]
    return {'min': [min(v[i] for v in coords) for i in range(3)],
            'max': [max(v[i] for v in coords) for i in range(3)]}


def activate(obj):
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def tidy_mesh(obj):
    """Restore shared vertices from the original GLB's unindexed triangles.

    Retain all texture seams. Only coplanar face diagonals are dissolved, before
    chamfering the actual architectural edges. No decimation or displacement.
    """
    before = len(obj.data.vertices)
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=0.000002)
    bmesh.ops.dissolve_degenerate(bm, dist=0.0000001, edges=list(bm.edges))
    bmesh.ops.dissolve_limit(bm, angle_limit=0.00001, use_dissolve_boundaries=False,
                            verts=list(bm.verts), edges=list(bm.edges), delimit={'UV', 'MATERIAL'})
    bm.normal_update()
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.update()
    return before, len(obj.data.vertices)


def finish_edges(obj, width):
    activate(obj)
    modifier = obj.modifiers.new('Applied physical chamfer %.1f mm' % (width * 1000), 'BEVEL')
    modifier.width = width
    modifier.segments = 1
    modifier.limit_method = 'ANGLE'
    modifier.angle_limit = math.radians(35)
    modifier.use_clamp_overlap = True
    modifier.harden_normals = True
    modifier.affect = 'EDGES'
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    # Harden normal transitions on very sharp corners, preserving smoothly lit
    # circular truss bars and the little chamfer glint along aluminium profiles.
    angle = math.radians(78 if obj.name.startswith('entrance_golden') else 65)
    obj.data.set_sharp_from_angle(angle=angle)
    normals = obj.modifiers.new('Applied weighted architectural normals', 'WEIGHTED_NORMAL')
    normals.keep_sharp = True
    normals.weight = 50
    normals.mode = 'FACE_AREA_WITH_ANGLE'
    bpy.ops.object.modifier_apply(modifier=normals.name)
    obj['physical_chamfer_metres'] = width
    obj['finish_method'] = 'weld coplanar mesh; applied one-segment bevel; applied weighted normals'


def separate_sign_digits(objects, variant):
    sign = next((o for o in objects if o.name.startswith('raised_magenta_crown_numerals')), None)
    if not sign: raise RuntimeError('Expected separately material-batched crown numerals')
    activate(sign)
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.separate(type='LOOSE'); bpy.ops.object.mode_set(mode='OBJECT')
    pieces = list(bpy.context.selected_objects)
    # Sorting by true world-space geometry centre works despite inherited origin.
    pieces.sort(key=lambda o: sum((o.matrix_world @ v.co).x for v in o.data.vertices) / len(o.data.vertices))
    if len(pieces) != 3:
        raise RuntimeError('Crown sign must have exactly three editable digits, found %s' % len(pieces))
    for obj, digit in zip(pieces, variant):
        obj.name = 'SIGN_DIGIT_%s_%s' % (variant, digit)
        obj.data.name = obj.name + '_mesh'
        obj['brand_variant'] = variant
        obj['editable_sign_component'] = True
    return pieces


def roughness_image(output):
    """Original linear PBR data, not a photograph or a node-only noise effect."""
    size = 512
    y, x = np.mgrid[0:size, 0:size]
    col, row = np.floor(x / size * 32), np.floor(y / size * 40)
    # Modest panel-to-panel variation and slightly rougher joints; no large
    # fake corrosion or prominent streaking absent from the photo evidence.
    panel = ((col * 17 + row * 11 + col * row * 3) % 13) / 12
    near_joint = ((x / size * 32) % 1 < .018) | ((y / size * 40) % 1 < .023)
    brush = np.sin(x * 1.31 + y * .027) * .006 + np.sin(x * .17 + y * .011) * .004
    value = np.where(near_joint, .60, .405 + panel * .060 + brush).astype(np.float32)
    rgba = np.ones((size, size, 4), dtype=np.float32)
    rgba[:, :, :3] = value[:, :, None]
    image = bpy.data.images.new('109_authored_panel_roughness_LINEAR', width=size, height=size, alpha=False)
    image.colorspace_settings.name = 'Non-Color'
    image.pixels.foreach_set(rgba.ravel())
    path = output / 'materials' / 'aluminium-panel-roughness.png'
    path.parent.mkdir(parents=True, exist_ok=True)
    image.filepath_raw = str(path); image.file_format = 'PNG'; image.save(); image.pack()
    return image


def panel_normal_image(output):
    """Portable tangent normals for a restrained, inferred 1.2 mm panel reveal.

    The photo establishes the panel grid, not a measured groove profile. Keep
    the relief shallow and aligned with the existing 32 by 40 albedo layout.
    """
    size = 2048
    y, x = np.mgrid[0:size, 0:size].astype(np.float32)
    fx, fy = (x / size * 32) % 1, (y / size * 40) % 1
    dx = np.minimum(fx, 1 - fx) * (math.pi * 10.53 / 32)
    dy = np.minimum(fy, 1 - fy) * (40.6 / 40)
    height = -.0012 * np.exp(-(dx / .016) ** 2) - .0012 * np.exp(-(dy / .014) ** 2)
    hy, hx = np.gradient(height, 40.6 / size, math.pi * 10.53 / size)
    normal = np.stack((-hx, -hy, np.ones_like(height)), axis=2)
    normal /= np.linalg.norm(normal, axis=2)[:, :, None]
    rgba = np.ones((size, size, 4), dtype=np.float32)
    rgba[:, :, :3] = normal * .5 + .5
    image = bpy.data.images.new('109_authored_panel_normal_TANGENT', width=size, height=size, alpha=False)
    image.colorspace_settings.name = 'Non-Color'; image.pixels.foreach_set(rgba.ravel())
    path = output / 'materials' / 'aluminium-panel-normal.png'
    path.parent.mkdir(parents=True, exist_ok=True)
    image.filepath_raw = str(path); image.file_format = 'PNG'; image.save(); image.pack()
    return image


def tune_materials(output):
    image = roughness_image(output)
    normal_image = panel_normal_image(output)
    changed = []
    for mat in bpy.data.materials:
        if not mat.use_nodes: continue
        p = next((n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None)
        if not p: continue
        if mat.name.startswith(('109_brushed_aluminium_panel_grid', 'crown_scaled_aluminium_panels')):
            p.inputs['Metallic'].default_value = .52
            p.inputs['Roughness'].default_value = .44
            node = mat.node_tree.nodes.new('ShaderNodeTexImage')
            node.name = 'Portable glTF roughness image'; node.label = 'Applied PBR: subtle aluminium variation'; node.image = image
            base = next((n for n in mat.node_tree.nodes if n.type == 'TEX_IMAGE' and n != node), None)
            if base and base.inputs['Vector'].is_linked:
                mat.node_tree.links.new(base.inputs['Vector'].links[0].from_socket, node.inputs['Vector'])
            mat.node_tree.links.new(node.outputs['Color'], p.inputs['Roughness'])
            normal_texture = mat.node_tree.nodes.new('ShaderNodeTexImage'); normal_texture.image = normal_image
            normal_texture.name = 'Portable glTF panel normal image'
            normal_map = mat.node_tree.nodes.new('ShaderNodeNormalMap'); normal_map.inputs['Strength'].default_value = 1.0
            if base and base.inputs['Vector'].is_linked:
                mat.node_tree.links.new(base.inputs['Vector'].links[0].from_socket, normal_texture.inputs['Vector'])
            mat.node_tree.links.new(normal_texture.outputs['Color'], normal_map.inputs['Color'])
            mat.node_tree.links.new(normal_map.outputs['Normal'], p.inputs['Normal'])
            mat['pbr_finish'] = 'Linear roughness and tangent normal images packed and glTF-portable; metallic 0.52; inferred shallow 1.2 mm panel reveal'
            changed.append(mat.name)
        elif mat.name == 'anodised_aluminium_edges':
            p.inputs['Roughness'].default_value = .32; p.inputs['Metallic'].default_value = .68
            changed.append(mat.name)
        elif mat.name == 'entrance_golden_steel_truss':
            p.inputs['Roughness'].default_value = .29; p.inputs['Metallic'].default_value = .77
            changed.append(mat.name)
        elif mat.name in ('blue_grey_retail_glazing', 'glass_reflection_variation'):
            p.inputs['Roughness'].default_value = .18
            changed.append(mat.name)
        elif mat.name == 'inner_crown_steel_liner':
            p.inputs['Roughness'].default_value = .60
            changed.append(mat.name)
    return changed


def check_glb(path):
    """Verify portable texture channels and budgets in the actual exported GLB."""
    import struct
    data = path.read_bytes()
    length, kind = struct.unpack_from('<II', data, 12)
    if kind != 0x4e4f534a: raise RuntimeError('Missing glTF JSON chunk')
    gltf = json.loads(data[20:20 + length])
    count = 0
    for mesh in gltf.get('meshes', []):
        for p in mesh['primitives']:
            count += gltf['accessors'][p['indices']]['count'] // 3 if 'indices' in p else gltf['accessors'][p['attributes']['POSITION']]['count'] // 3
    mapped = [m.get('name') for m in gltf.get('materials', []) if 'metallicRoughnessTexture' in m.get('pbrMetallicRoughness', {})]
    normal_mapped = [m.get('name') for m in gltf.get('materials', []) if 'normalTexture' in m]
    if not any(n and n.startswith('109_brushed_aluminium') for n in normal_mapped):
        raise RuntimeError('Panel normal image did not survive GLB export')
    if count > 65000: raise RuntimeError('Preferred 65,000 triangle cap exceeded: %s' % count)
    if not any(n and n.startswith('109_brushed_aluminium') for n in mapped):
        raise RuntimeError('Metal roughness image did not survive GLB export')
    return {'triangles': count, 'meshes': len(gltf.get('meshes', [])), 'materials': len(gltf.get('materials', [])),
            'images': len(gltf.get('images', [])), 'roughnessMappedMaterials': mapped, 'normalMappedMaterials': normal_mapped,
            'extensionsUsed': gltf.get('extensionsUsed', []), 'bytes': len(data)}


def process(variant, source):
    if not source.exists(): raise FileNotFoundError(source)
    input_hash = sha(source)
    start = time.time()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(source))
    objects = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    baseline_bounds = bounds(objects)
    baseline_triangles = triangles(objects)
    report = []
    for obj in objects:
        old_vertices, new_vertices = tidy_mesh(obj)
        bevel_width = BEVEL_WIDTHS.get(obj.name)
        if bevel_width:
            finish_edges(obj, bevel_width)
        elif obj.name.startswith(('109_brushed_aluminium', 'crown_scaled_aluminium', 'inner_crown')):
            # Preserve the true curved shell; no artificial subdivision.
            for polygon in obj.data.polygons: polygon.use_smooth = True
            obj.data.set_sharp_from_angle(angle=math.radians(45))
        obj.data.validate(verbose=False)
        obj.data.update()
        report.append({'object': obj.name, 'inputVertices': old_vertices, 'weldedVertices': new_vertices,
                       'chamferMetres': bevel_width or 0})
    separate_sign_digits(objects, variant)
    changed_materials = tune_materials(args.output)
    objects = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    after_bounds = bounds(objects)
    after_triangles = triangles(objects)
    drift = max(abs(baseline_bounds[k][i] - after_bounds[k][i]) for k in ('min', 'max') for i in range(3))
    if drift > .03: raise RuntimeError('Unexpected footprint drift: %s metres' % drift)
    if after_triangles > 65000: raise RuntimeError('Triangle cap exceeded before export')
    roots = [o for o in bpy.context.scene.objects if o.parent is None]
    for root in roots:
        root['blender_polished'] = True; root['blender_version'] = bpy.app.version_string
        root['polish_script'] = 'scripts/polish-109.py'; root['source_glb_sha256'] = input_hash
        root['brand_variant'] = variant
        root['finish_scope'] = 'physical bevels, corrected normals, portable PBR roughness and shallow panel normals; no invented architecture'
    scene = bpy.context.scene
    scene.unit_settings.system = 'METRIC'; scene.unit_settings.scale_length = 1
    scene.world = bpy.data.worlds.new('Neutral workbench world')
    scene.world.color = (.14, .14, .14)
    scene['readme'] = 'Photo-guided source asset polished in Blender. Z-up here, glTF export Y-up. No presentation ground/cameras/lights in asset export.'
    scene['reference'] = 'Dick Thomas Johnson, Shibuya Scramble Square SHIBUYA109, 2020-01-02, CC BY 2.0; see docs/photo-references.md'
    scene['brand_variant'] = variant
    scene['polish_geometry_rules'] = json.dumps(BEVEL_WIDTHS)
    for image in bpy.data.images:
        if image.type != 'RENDER_RESULT' and not image.packed_file:
            try: image.pack()
            except RuntimeError: pass
    stem = '109' if variant == '109' else '108-polished'
    blend_path = args.output / (stem + '.blend')
    glb_path = args.output / (stem + '.glb')
    bpy.ops.wm.save_as_mainfile(filepath=str(blend_path))
    bpy.ops.export_scene.gltf(filepath=str(glb_path), export_format='GLB', export_yup=True,
                             export_apply=True, export_normals=True, export_tangents=False,
                             export_materials='EXPORT', export_extras=True, export_cameras=False,
                             export_lights=False, export_animations=False)
    portable = check_glb(glb_path)
    if sha(source) != input_hash: raise RuntimeError('Source was unexpectedly modified')
    result = {'variant': variant, 'source': str(source), 'sourceSHA256': input_hash,
              'blend': str(blend_path), 'glb': str(glb_path), 'glbSHA256': sha(glb_path),
              'baselineTriangles': baseline_triangles, 'finishedTriangles': after_triangles,
              'boundsBlenderZUpBefore': baseline_bounds, 'boundsBlenderZUpAfter': after_bounds,
              'maximumBoundsDriftMetres': drift, 'materialChanges': changed_materials,
              'geometryOperations': report, 'export': portable, 'elapsedSeconds': round(time.time() - start, 2),
              'rendersPerformed': False,
              'limitations': ['Dimensions remain source-model estimates', 'No new unseen architectural details', 'No source photographs baked onto facades']}
    (args.output / (stem + '-quality.json')).write_text(json.dumps(result, ensure_ascii=False, indent=2))
    print('POLISH109_RESULT=' + json.dumps(result, ensure_ascii=False), flush=True)
    return result


results = []
for variant in (['109', '108'] if args.variant == 'both' else [args.variant]):
    results.append(process(variant, args.input if variant == '109' else args.game_input))
(args.output / 'polish-manifest.json').write_text(json.dumps({'script': 'scripts/polish-109.py', 'blender': bpy.app.version_string, 'assets': results}, ensure_ascii=False, indent=2))

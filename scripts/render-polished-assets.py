"""Render original and Blender-edited geometry with one locked daylight rig.

blender -b -t 4 --python scripts/render-polished-assets.py -- --asset cafe
Use --draft for small lighting checks; final PNGs must be at least 1600 px wide.
The original 0.3.0 files and the polished model files are read-only inputs.
"""
import argparse
import hashlib
import json
import math
import sys
from pathlib import Path
import bpy
from mathutils import Vector

ROOT = Path('/workspace/shared/shibuya-artifacts')
parser = argparse.ArgumentParser()
parser.add_argument('--asset', choices=['109', 'cafe'], required=True)
parser.add_argument('--before', type=Path)
parser.add_argument('--after', type=Path)
parser.add_argument('--output', type=Path)
parser.add_argument('--views', nargs='+', choices=['hero', 'detail', 'roof'], default=['hero', 'detail'])
parser.add_argument('--variants', nargs='+', choices=['before', 'after'], default=['before', 'after'])
parser.add_argument('--width', type=int, default=1600)
parser.add_argument('--samples', type=int, default=64)
parser.add_argument('--draft', action='store_true')
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
if not args.draft and args.width < 1600:
    parser.error('Final comparison renders require --width >= 1600; use --draft for tests.')
before = args.before or ROOT / 'architecture' / f'{args.asset}.glb'
after = args.after or ROOT / 'blender-polish' / args.asset / ('109.blend' if args.asset == '109' else 'cafe-polished.blend')
out = args.output or ROOT / 'blender-polish' / args.asset / ('comparison-draft' if args.draft else 'comparison')
out.mkdir(parents=True, exist_ok=True)
assert before.is_file(), f'Before model missing: {before}'
if 'after' in args.variants:
    assert after.is_file(), f'After model missing: {after}'

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def load_model(path):
    if path.suffix.lower() == '.blend':
        bpy.ops.wm.open_mainfile(filepath=str(path))
    else:
        bpy.ops.wm.read_factory_settings(use_empty=True)
        bpy.ops.import_scene.gltf(filepath=str(path))
    bpy.context.preferences.filepaths.save_version = 0
    # Strip any prior presentation, never the authored model's structural ground.
    for obj in list(bpy.context.scene.objects):
        if obj.type in {'LIGHT', 'CAMERA'} or obj.name.startswith(('Presentation —', 'Comparison —')):
            bpy.data.objects.remove(obj, do_unlink=True)
    bpy.context.view_layer.update()
    meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH' and not o.hide_render]
    assert meshes, f'No visible model mesh in {path}'
    return meshes

def bounds(meshes):
    corners = [o.matrix_world @ Vector(c) for o in meshes for c in o.bound_box]
    return Vector([min(v[i] for v in corners) for i in range(3)]), Vector([max(v[i] for v in corners) for i in range(3)])

def model_stats(meshes):
    stats = {'meshObjects': len(meshes), 'evaluatedVertices': 0, 'evaluatedTriangles': 0, 'modifiers': {}}
    graph = bpy.context.evaluated_depsgraph_get()
    for obj in meshes:
        for modifier in obj.modifiers:
            stats['modifiers'][modifier.type] = stats['modifiers'].get(modifier.type, 0) + 1
        evaluated = obj.evaluated_get(graph)
        mesh = evaluated.to_mesh()
        mesh.calc_loop_triangles()
        stats['evaluatedVertices'] += len(mesh.vertices)
        stats['evaluatedTriangles'] += len(mesh.loop_triangles)
        evaluated.to_mesh_clear()
    low, high = bounds(meshes)
    stats['boundsBlenderZUp'] = {'min': list(low), 'max': list(high)}
    return stats

low, high = bounds(load_model(before))
size = high - low
center = (low + high) / 2
extent = max(size)
height = size.z
hero = {'location': [center.x + extent * .72, center.y - extent * 2.1, low.z + height * .70],
        'target': [center.x, center.y, low.z + height * .48], 'lens': 55}
if args.asset == 'cafe':
    hero = {'location': [center.x + extent * .68, center.y - extent * 1.92, low.z + height * .97],
            'target': [center.x, center.y, low.z + height * .45], 'lens': 55}
    detail = {'location': [center.x + size.x * .29, low.y - 5.9, low.z + 1.65],
              'target': [center.x + size.x * .19, low.y + 1.2, low.z + 1.72], 'lens': 55}
else:
    detail = {'location': [center.x + 10, low.y - 20, low.z + 5.0],
              'target': [center.x + 1, low.y + 4.5, low.z + 4.0], 'lens': 65}
roof = {'location': [center.x + extent * .70, center.y - extent * .90, high.z + extent * .80],
        'target': [center.x, center.y, high.z - height * .17], 'lens': 55}
rig = {
    'version': 1, 'asset': args.asset, 'baselineSHA256': sha(before),
    'coordinateSystem': 'Blender Z-up; model front -Y',
    'baselineBounds': {'min': list(low), 'max': list(high)},
    'cameras': {'hero': hero, 'detail': detail, 'roof': roof},
    'lighting': {'worldColorLinear': [.74, .76, .79], 'worldStrength': .65,
                 'sunEnergy': 1.65, 'sunAngleDegrees': 5,
                 'sunColor': [1, .985, .96], 'frontAreaPowerPerExtentSquared': 8,
                 'frontAreaColor': [1, .985, .96],
                 'cafeInteriorAreaWatts': 240 if args.asset == 'cafe' else 0},
    'colorManagement': {'viewTransform': 'AgX', 'look': 'AgX - Medium Low Contrast', 'exposure': .2, 'gamma': 1},
    'groundColorLinear': [.31, .32, .33],
    'render': {'engine': 'CYCLES', 'device': 'CPU', 'threads': 4,
               'width': args.width, 'height': round(args.width * .875), 'samples': args.samples,
               'adaptiveThreshold': .018, 'seed': 19, 'denoising': False, 'draft': args.draft},
    'fairComparison': 'Both variants share baseline-derived cameras, lighting, exposure, ground, seed and sampling. No material or geometry retouching in renderer.',
}
rig_json = json.dumps(rig, ensure_ascii=False, sort_keys=True, indent=2)
rig_hash = hashlib.sha256(rig_json.encode()).hexdigest()
(out / 'comparison-rig.json').write_text(rig_json)

def aim(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat('-Z', 'Y').to_euler()

def area(scene, name, location, target, power, diameter, color):
    data = bpy.data.lights.new(name, 'AREA')
    data.energy = power; data.shape = 'DISK'; data.size = diameter; data.color = color
    obj = bpy.data.objects.new(name, data); scene.collection.objects.link(obj); obj.location = location
    aim(obj, target)

def setup(scene):
    light = rig['lighting']
    world = bpy.data.worlds.new('Comparison — neutral daylight'); world.use_nodes = True; scene.world = world
    bg = world.node_tree.nodes['Background']
    bg.inputs[0].default_value = (*light['worldColorLinear'], 1); bg.inputs[1].default_value = light['worldStrength']
    sun_data = bpy.data.lights.new('Comparison — daylight sun', 'SUN')
    sun_data.energy = light['sunEnergy']; sun_data.angle = math.radians(light['sunAngleDegrees']); sun_data.color = light['sunColor']
    sun = bpy.data.objects.new(sun_data.name, sun_data); scene.collection.objects.link(sun)
    sun.location = (center.x - extent * 1.8, center.y - extent * 2, high.z + extent * 2)
    aim(sun, center)
    area(scene, 'Comparison — large neutral reflection',
         (center.x + extent * .8, center.y - extent * 1.2, high.z * .80), center,
         extent ** 2 * light['frontAreaPowerPerExtentSquared'], extent * 1.0, light['frontAreaColor'])
    if args.asset == 'cafe':
        ceiling = (center.x, high.y - size.y * .45, low.z + height * .87)
        area(scene, 'Comparison — identical cafe interior fill', ceiling,
             (ceiling[0], ceiling[1], low.z), light['cafeInteriorAreaWatts'], size.x * .52, (1, .93, .83))
    bpy.ops.mesh.primitive_plane_add(size=extent * 100, location=(center.x, center.y, low.z - .035))
    floor = bpy.context.object; floor.name = 'Comparison — neutral ground'
    mat = bpy.data.materials.new('Comparison — matte neutral concrete'); mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*rig['groundColorLinear'], 1); bsdf.inputs['Roughness'].default_value = .88
    floor.data.materials.append(mat)
    camera_data = bpy.data.cameras.new('Comparison — locked camera')
    camera = bpy.data.objects.new(camera_data.name, camera_data); scene.collection.objects.link(camera); scene.camera = camera
    camera_data.clip_start = .025; camera_data.clip_end = extent * 150
    camera_data.dof.use_dof = False
    scene.render.engine = 'CYCLES'; scene.cycles.device = 'CPU'; scene.cycles.samples = args.samples
    scene.cycles.use_denoising = False  # Installed Blender has no OpenImageDenoise.
    scene.cycles.use_adaptive_sampling = True; scene.cycles.adaptive_threshold = .018
    scene.cycles.adaptive_min_samples = min(16, args.samples); scene.cycles.seed = 19
    scene.cycles.use_animated_seed = False
    scene.cycles.max_bounces = 10; scene.cycles.diffuse_bounces = 4; scene.cycles.glossy_bounces = 4
    scene.cycles.transmission_bounces = 8; scene.cycles.transparent_max_bounces = 12
    scene.render.use_compositing = False; scene.render.use_sequencer = False
    scene.render.threads_mode = 'FIXED'; scene.render.threads = 4
    scene.render.resolution_x = args.width; scene.render.resolution_y = round(args.width * .875); scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'; scene.render.image_settings.color_mode = 'RGB'; scene.render.image_settings.color_depth = '8'
    scene.render.film_transparent = False; scene.render.use_stamp = False
    scene.view_settings.view_transform = 'AgX'; scene.view_settings.look = rig['colorManagement']['look']
    scene.view_settings.exposure = rig['colorManagement']['exposure']; scene.view_settings.gamma = 1
    scene.unit_settings.system = 'METRIC'
    scene['comparisonRigSHA256'] = rig_hash
    return camera

report = {'asset': args.asset, 'rigSHA256': rig_hash, 'draft': args.draft, 'variants': {}, 'renders': []}
previous_report = out / 'comparison-report.json'
if previous_report.is_file():
    previous = json.loads(previous_report.read_text())
    if previous.get('rigSHA256') == rig_hash:
        retained = [item for item in previous.get('renders', []) if item['variant'] not in args.variants]
        for item in retained:
            assert Path(item['file']).is_file() and sha(Path(item['file'])) == item['sha256'], 'Retained comparison image changed'
        report['renders'] = retained
        report['variants'] = {k: v for k, v in previous.get('variants', {}).items() if k not in args.variants}
for variant in args.variants:
    source = before if variant == 'before' else after
    source_hash = sha(source)
    meshes = load_model(source)
    report['variants'][variant] = {'source': str(source), 'sourceSHA256': source_hash, **model_stats(meshes)}
    scene = bpy.context.scene
    camera = setup(scene)
    for view in args.views:
        pose = rig['cameras'][view]
        camera.location = pose['location']; aim(camera, pose['target']); camera.data.lens = pose['lens']
        output = out / f'{args.asset}-{variant}-{view}.png'
        scene.render.filepath = str(output)
        bpy.ops.render.render(write_still=True)
        report['renders'].append({'variant': variant, 'view': view, 'file': str(output),
                                  'bytes': output.stat().st_size, 'sha256': sha(output), 'rigSHA256': rig_hash})
        (out / 'comparison-report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
        print('COMPARISON_RENDERED', variant, view, output, flush=True)
    assert sha(source) == source_hash, f'Input changed during rendering: {source}'
print('COMPARISON_COMPLETE', json.dumps({'asset': args.asset, 'renders': len(report['renders']), 'rigSHA256': rig_hash}), flush=True)

"""Read-only GLB architecture revision probes and close-up renders.

Uses actual imported GLB triangles, not the author's scene or object names.
All probe coordinates are glTF metres. Results must be reviewed visually;
these are targeted scenery checks, not a navigability or building-code test.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import sys

import bpy
from mathutils import Vector


def point(gltf):
    return Vector((gltf[0], -gltf[2], gltf[1]))


def unpoint(blender):
    return [blender[0], blender[2], -blender[1]]


def ray(scene, label, origin, direction, distance, expected_hit=True, expected_material=None):
    hit, location, normal, face, obj, matrix = scene.ray_cast(
        bpy.context.evaluated_depsgraph_get(), point(origin), point(direction), distance=distance)
    material = None
    if hit and obj.type == 'MESH' and 0 <= face < len(obj.data.polygons):
        i = obj.data.polygons[face].material_index
        material = obj.material_slots[i].material.name if i < len(obj.material_slots) else None
    success = bool(hit) == expected_hit
    if expected_material is not None:
        success = success and material == expected_material
    return {'label': label, 'origin_gltf': origin, 'direction_gltf': direction,
            'maximum_distance_m': distance, 'expected_hit': expected_hit,
            'expected_material': expected_material, 'hit': bool(hit),
            'location_gltf': unpoint(location) if hit else None,
            'normal_gltf': unpoint(normal) if hit else None,
            'material': material, 'passed': success}


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--asset', type=Path, required=True)
    p.add_argument('--sha256', required=True)
    p.add_argument('--kind', choices=['residential', 'dogenzaka-a'], required=True)
    p.add_argument('--output', type=Path, required=True)
    p.add_argument('--revision', choices=['previous', 'corrected'], required=True)
    p.add_argument('--no-render', action='store_true')
    a = p.parse_args(sys.argv[sys.argv.index('--')+1:])
    digest = hashlib.sha256(a.asset.read_bytes()).hexdigest()
    assert digest == a.sha256, 'Wrong input hash'
    a.output.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    status = bpy.ops.import_scene.gltf(filepath=str(a.asset.resolve()))
    assert 'FINISHED' in status
    scene = bpy.context.scene
    probes = []
    if a.kind == 'residential':
        for floor, y in enumerate([3.36,6.31,9.26,12.21,15.16,18.11], start=2):
            soffit = y+2.835 if floor < 7 else 21.005
            # Start left rays beyond the adjacent common-spine wall, so a
            # charcoal circulation face cannot produce a false positive.
            for side, x, sign in [('left',-4.58,1),('right',6.54,-1)]:
                probes.append(ray(scene, f'{floor}F_{side}_former_upper_gap',
                                  [x,soffit-.05,4.40], [sign,0,0], .35,
                                  expected_material='mineral_plaster'))
                probes.append(ray(scene, f'{floor}F_{side}_former_back_gap',
                                  [x,y+1.40,3.50], [sign,0,0], .35,
                                  expected_material='mineral_plaster'))
        views = {
            'right-balcony-junctions': ([12,11.4,12],[6.16,9.18,4.3],7.4),
            'left-balcony-junctions': ([-10,14.2,12],[-4.4,12.2,4.3],7.4),
            'upper-balcony-roof-junction': ([12,21.1,13],[6.20,20.05,4.3],5.1),
        }
    else:
        # The submitted and corrected A have the same recenter offsets:
        # authored x +=0.10 m; authored z +=0.2425 m in exported glTF space.
        for index, floor in enumerate([3.55,6.84,10.13,13.42,16.71], start=2):
            # Probe the lower door panel below the original window sill;
            # matching glass material alone cannot distinguish a window.
            probes.append(ray(scene, f'{index}F_tenant_door_lower_panel',
                              [1.15,floor+.43,4.5],[0,0,-1],.90,
                              expected_material='metal'))
            ac_y = floor+.95
            probes.append(ray(scene, f'{index}F_rear_outward_fan',
                              [.59,ac_y+.12,-5.70],[0,0,1],.60,
                              expected_material='charcoal'))
        for x in [2.41,3.51]:
            for z in [2.58,3.28,3.78]:
                probes.append(ray(scene, f'former_roof_flight_x{x}_z{z}',
                                  [x,19.90,z],[0,-1,0],2.90,expected_hit=False))
        views = {
            'rear-ac-outward': ([.7,12.1,-19],[.3,11.4,-5.15],11.0),
            'roof-stair-termination': ([12,22.4,14],[2.9,17.6,3.0],7.1),
            'tenant-door-circulation': ([9,12,14],[1.0,10.1,3.9],9.0),
        }
    result = {'asset':a.asset.name,'sha256':digest,'revision':a.revision,
              'kind':a.kind,'blender':bpy.app.version_string,'actual_import_status':list(status),
              'probe_count':len(probes),'probes_satisfying_corrected_expectation':sum(x['passed'] for x in probes),
              'all_corrected_expectations_pass':all(x['passed'] for x in probes),
              'probes':probes,'renders':[],
              'scope':'Targeted actual-mesh sample rays and close-up views only; no proof of navigable interior, physical collision clearance, egress compliance, or complete watertightness.'}
    report = a.output/'architecture-probes.json'
    if a.no_render and report.exists():
        previous=json.loads(report.read_text())
        if previous.get('sha256')==digest:
            result['renders']=[r for r in previous.get('renders',[])
                               if (a.output/r['file']).is_file()]
    report.write_text(json.dumps(result,indent=2)+'\n')
    if not a.no_render:
        scene.render.engine='CYCLES'
        scene.cycles.device='CPU';scene.cycles.samples=40;scene.cycles.use_denoising=False
        scene.render.resolution_x=900;scene.render.resolution_y=900;scene.render.resolution_percentage=100
        scene.render.image_settings.file_format='PNG';scene.view_settings.view_transform='AgX'
        world=bpy.data.worlds.new('QA_Architecture_World');world.use_nodes=True
        world.node_tree.nodes['Background'].inputs[0].default_value=(.72,.78,.86,1)
        world.node_tree.nodes['Background'].inputs[1].default_value=.8;scene.world=world
        sd=bpy.data.lights.new('QA_Architecture_Sun','SUN');sun=bpy.data.objects.new(sd.name,sd)
        scene.collection.objects.link(sun);sd.energy=2.2;sd.angle=math.radians(20)
        sun.rotation_euler=(math.radians(25),math.radians(-25),math.radians(-35))
        cd=bpy.data.cameras.new('QA_Architecture_Camera');cam=bpy.data.objects.new(cd.name,cd)
        scene.collection.objects.link(cam);scene.camera=cam;cd.type='ORTHO';cd.clip_end=300
        for label,(pos,target,scale) in views.items():
            cam.location=point(pos);cam.rotation_euler=(point(target)-cam.location).to_track_quat('-Z','Y').to_euler()
            cd.ortho_scale=scale
            scene.render.filepath=str((a.output/(label+'.png')).resolve())
            bpy.ops.render.render(write_still=True)
            result['renders'].append({'view':label,'file':label+'.png','size':[900,900]})
            report.write_text(json.dumps(result,indent=2)+'\n')
    result['source_hash_unchanged']=hashlib.sha256(a.asset.read_bytes()).hexdigest()==digest
    report.write_text(json.dumps(result,indent=2)+'\n')
    print('ARCHITECTURE_QA='+json.dumps({k:v for k,v in result.items() if k!='probes'}))
    if a.revision=='corrected' and not result['all_corrected_expectations_pass']:
        raise RuntimeError('One or more actual-mesh probes failed; inspect report, do not infer acceptance')


if __name__=='__main__':
    main()

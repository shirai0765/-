"""Actual Blender reimport, geometry checks, and independent review renders.

blender -b -t 2 --python-exit-code 1 --python validate_blender.py -- asset.glb output_dir --sha256 HASH
Render cameras assume the author's stated glTF front +Z (default) or -Z.
Blender import converts glTF Y-up to Blender Z-up; report includes both axes.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import sys
import time

import bpy
from mathutils import Vector


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("asset", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--sha256", required=True)
    parser.add_argument("--front", choices=("+Z", "-Z"), default="+Z")
    parser.add_argument("--size", type=int, default=640)
    parser.add_argument("--samples", type=int, default=24)
    parser.add_argument("--no-render", action="store_true")
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:])
    digest = hashlib.sha256(args.asset.read_bytes()).hexdigest()
    if digest != args.sha256:
        raise RuntimeError("Handoff SHA256 does not match bytes; validation stopped")
    args.output.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    start = time.monotonic()
    status = bpy.ops.import_scene.gltf(filepath=str(args.asset.resolve()))
    import_seconds = time.monotonic()-start
    if "FINISHED" not in status:
        raise RuntimeError(f"Blender import did not finish: {status}")
    imported = list(bpy.context.scene.objects)
    errors, warnings = [], []
    meshes = []
    points = []
    for obj in imported:
        if any(not math.isfinite(v) for row in obj.matrix_world for v in row):
            errors.append(f"Non-finite transform: {obj.name}")
        if obj.type != "MESH":
            continue
        mesh = obj.data
        mesh.calc_loop_triangles()
        degenerates = sum(t.area < 1e-10 for t in mesh.loop_triangles)
        invalid_normals = sum(not all(math.isfinite(v) for v in n.vector) or n.vector.length < .99 or n.vector.length > 1.01
                              for n in mesh.corner_normals)
        if invalid_normals:
            errors.append(f"{obj.name}: {invalid_normals} invalid/non-unit corner normals")
        if degenerates:
            warnings.append(f"{obj.name}: {degenerates} zero/near-zero area triangles")
        invalid_positions = sum(not all(math.isfinite(x) for x in v.co) for v in mesh.vertices)
        if invalid_positions:
            errors.append(f"{obj.name}: {invalid_positions} invalid positions")
        points.extend(obj.matrix_world @ v.co for v in mesh.vertices)
        meshes.append({"name": obj.name, "vertices": len(mesh.vertices), "triangles": len(mesh.loop_triangles),
                       "polygons": len(mesh.polygons), "material_slots": len(obj.material_slots),
                       "uv_layer_count": len(mesh.uv_layers), "degenerate_triangles": degenerates,
                       "invalid_normals": invalid_normals,
                       "negative_transform": obj.matrix_world.determinant() < 0})
    if not points:
        raise RuntimeError("No mesh geometry after import")
    lo = [min(p[i] for p in points) for i in range(3)]
    hi = [max(p[i] for p in points) for i in range(3)]
    gltf_lo = [lo[0], lo[2], -hi[1]]
    gltf_hi = [hi[0], hi[2], -lo[1]]
    if abs(gltf_lo[1]) > .001:
        errors.append(f"Reimported ground Y={gltf_lo[1]} is outside 1 mm tolerance")
    images = [{"name": im.name, "size": list(im.size), "packed": bool(im.packed_file),
               "source": im.source} for im in bpy.data.images]
    materials = [{"name": mat.name, "use_nodes": mat.use_nodes} for mat in bpy.data.materials]
    result = {"asset": args.asset.name, "sha256": digest, "blender_version": bpy.app.version_string,
              "actual_import_status": list(status), "import_seconds": round(import_seconds, 4),
              "passed": not errors, "errors": errors, "warnings": warnings,
              "mesh_objects": len(meshes), "vertices_after_import": sum(m["vertices"] for m in meshes),
              "triangles_after_import": sum(m["triangles"] for m in meshes),
              "world_bounds_blender_z_up_m": {"min": lo, "max": hi},
              "world_bounds_gltf_y_up_m": {"min": gltf_lo, "max": gltf_hi,
                                          "size": [gltf_hi[i]-gltf_lo[i] for i in range(3)]},
              "materials": materials, "images": images, "meshes": meshes, "renders": [],
              "visual_review": "Pending human/assistant pixel inspection; successful rendering alone is not visual approval."}
    report_path = args.output / "blender-report.json"
    report_path.write_text(json.dumps(result, indent=2) + "\n")
    if not args.no_render:
        scene = bpy.context.scene
        scene.render.engine = "CYCLES"
        scene.cycles.device = "CPU"
        scene.cycles.samples = args.samples
        # Portable across CPU Blender builds without OpenImageDenoise support.
        scene.cycles.use_denoising = False
        scene.render.resolution_x = args.size
        scene.render.resolution_y = args.size
        scene.render.resolution_percentage = 100
        scene.render.image_settings.file_format = "PNG"
        scene.render.film_transparent = False
        scene.view_settings.view_transform = "AgX"
        world = bpy.data.worlds.new("Independent_QA_World")
        world.use_nodes = True
        world.node_tree.nodes["Background"].inputs[0].default_value = (.72, .78, .86, 1)
        world.node_tree.nodes["Background"].inputs[1].default_value = .65
        scene.world = world
        center = Vector(((lo[0]+hi[0])/2, (lo[1]+hi[1])/2, (lo[2]+hi[2])/2))
        span = max(hi[i]-lo[i] for i in range(3))
        ground_mat = bpy.data.materials.new("Independent_QA_Ground")
        ground_mat.diffuse_color = (.27, .30, .32, 1)
        bpy.ops.mesh.primitive_plane_add(size=span*20, location=(center.x, center.y, lo[2]-.012))
        ground = bpy.context.object
        ground.name = "Independent_QA_Ground"
        ground.data.materials.append(ground_mat)
        sun_data = bpy.data.lights.new("Independent_QA_Sun", "SUN")
        sun_data.energy = 2.5
        sun_data.angle = math.radians(20)
        sun = bpy.data.objects.new(sun_data.name, sun_data)
        scene.collection.objects.link(sun)
        sun.rotation_euler = (math.radians(25), math.radians(-25), math.radians(-35))
        camera_data = bpy.data.cameras.new("Independent_QA_Camera")
        camera = bpy.data.objects.new(camera_data.name, camera_data)
        scene.collection.objects.link(camera)
        scene.camera = camera
        camera_data.type = "ORTHO"
        # glTF front +Z appears at Blender -Y after import.
        s = 1 if args.front == "+Z" else -1
        views = {"front": Vector((0, -s, .04)),
                 "three-quarter": Vector((1.0, -1.35*s, .8)),
                 "roof": Vector((.85, -1.0*s, 2.1))}
        bbox = [Vector((x, y, z)) for x in (lo[0], hi[0]) for y in (lo[1], hi[1]) for z in (lo[2], hi[2])]
        for view, direction in views.items():
            camera.location = center + direction.normalized() * span * 4
            camera.rotation_euler = (center-camera.location).to_track_quat("-Z", "Y").to_euler()
            # Fit the complete bounds to a square frame, including tall/narrow assets.
            rotation = camera.rotation_euler.to_matrix().transposed()
            local = [rotation @ (p-center) for p in bbox]
            camera_data.ortho_scale = max(max(v[i] for v in local)-min(v[i] for v in local) for i in (0, 1))*1.16
            camera_data.clip_end = span*20
            out = args.output / f"{view}.png"
            scene.render.filepath = str(out.resolve())
            t = time.monotonic()
            bpy.ops.render.render(write_still=True)
            result["renders"].append({"view": view, "file": out.name,
                                      "size": [args.size, args.size], "seconds": round(time.monotonic()-t, 3)})
            report_path.write_text(json.dumps(result, indent=2) + "\n")
    final_digest = hashlib.sha256(args.asset.read_bytes()).hexdigest()
    if final_digest != digest:
        result["errors"].append("Source GLB changed during validation; repeat on stable bytes")
        result["passed"] = False
    result["source_hash_unchanged_after_validation"] = final_digest == digest
    report_path.write_text(json.dumps(result, indent=2) + "\n")
    print("INDEPENDENT_QA_RESULT=" + json.dumps({k: v for k, v in result.items() if k not in ("meshes", "materials")}))
    if not result["passed"]:
        raise RuntimeError("Independent validation found errors; see report")


if __name__ == "__main__":
    main()

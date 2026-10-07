#!/usr/bin/env python3
"""Independent, dependency-free inspection of final GLB bytes (glTF 2.0).

Usage: python3 inspect_glb.py asset.glb --output report.json [--sha256 HEX]
Counts are measured from accessors, not copied from the author's manifest.
"""
import argparse
import base64
import hashlib
import json
import math
from pathlib import Path
import struct


def inspect(path):
    data = Path(path).read_bytes()
    if len(data) < 12:
        raise ValueError("Truncated GLB header")
    magic, version, declared = struct.unpack_from("<4sII", data)
    if magic != b"glTF" or version != 2 or declared != len(data):
        raise ValueError("GLB magic, version, or declared byte size is invalid")
    chunks = []
    offset = 12
    while offset < len(data):
        if offset + 8 > len(data):
            raise ValueError("Truncated chunk header")
        size, kind = struct.unpack_from("<I4s", data, offset)
        offset += 8
        if offset + size > len(data) or size % 4:
            raise ValueError("Invalid GLB chunk length/alignment")
        chunks.append((kind, data[offset:offset + size]))
        offset += size
    if not chunks or chunks[0][0] != b"JSON":
        raise ValueError("First GLB chunk is not JSON")
    doc = json.loads(chunks[0][1].rstrip(b" \x00"))
    bins = [body for kind, body in chunks if kind == b"BIN\x00"]
    errors, warnings = [], []
    buffers = []
    external_uris = []
    for i, b in enumerate(doc.get("buffers", [])):
        uri = b.get("uri")
        if uri and uri.startswith("data:"):
            body = base64.b64decode(uri.partition(",")[2])
        elif uri:
            external_uris.append({"type": "buffer", "index": i, "uri": uri})
            body = b""
        else:
            body = bins[0] if i == 0 and bins else b""
        if len(body) < b["byteLength"]:
            errors.append(f"Buffer {i} is shorter than byteLength")
        buffers.append(body)
    formats = {5120: "b", 5121: "B", 5122: "h", 5123: "H", 5125: "I", 5126: "f"}
    components = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4,
                  "MAT2": 4, "MAT3": 9, "MAT4": 16}

    def view_values(view_id, start, count, component_type, ncomp, stride=None):
        v = doc["bufferViews"][view_id]
        fmt = "<" + formats[component_type] * ncomp
        width = struct.calcsize(fmt)
        stride = stride or v.get("byteStride", width)
        if stride < width:
            raise ValueError("Accessor stride is smaller than its element")
        if start + (count - 1) * stride + width > v["byteLength"] and count:
            raise ValueError("Accessor overruns bufferView")
        raw = buffers[v.get("buffer", 0)]
        base = v.get("byteOffset", 0) + start
        return [struct.unpack_from(fmt, raw, base + i * stride) for i in range(count)]

    accessors = []
    for i, a in enumerate(doc.get("accessors", [])):
        n = components[a["type"]]
        vals = view_values(a["bufferView"], a.get("byteOffset", 0), a["count"],
                           a["componentType"], n) if "bufferView" in a else [(0,) * n] * a["count"]
        if "sparse" in a:
            s = a["sparse"]
            inds = view_values(s["indices"]["bufferView"], s["indices"].get("byteOffset", 0),
                               s["count"], s["indices"]["componentType"], 1)
            replacements = view_values(s["values"]["bufferView"], s["values"].get("byteOffset", 0),
                                       s["count"], a["componentType"], n)
            for ind, val in zip(inds, replacements):
                vals[ind[0]] = val
        if a.get("normalized") and a["componentType"] != 5126:
            bits = struct.calcsize(formats[a["componentType"]]) * 8
            signed = a["componentType"] in (5120, 5122)
            divisor = 2 ** (bits - int(signed)) - 1
            vals = [tuple(max(-1, x / divisor) for x in row) for row in vals]
        if any(not math.isfinite(x) for row in vals for x in row):
            errors.append(f"Accessor {i} contains non-finite numbers")
        accessors.append(vals)

    identity = [[float(i == j) for j in range(4)] for i in range(4)]

    def mul(a, b):
        return [[sum(a[i][k] * b[k][j] for k in range(4)) for j in range(4)] for i in range(4)]

    def matrix(node):
        if "matrix" in node:
            return [[node["matrix"][j * 4 + i] for j in range(4)] for i in range(4)]
        x, y, z, w = node.get("rotation", [0, 0, 0, 1])
        rot = [[1-2*y*y-2*z*z, 2*x*y-2*z*w, 2*x*z+2*y*w, 0],
               [2*x*y+2*z*w, 1-2*x*x-2*z*z, 2*y*z-2*x*w, 0],
               [2*x*z-2*y*w, 2*y*z+2*x*w, 1-2*x*x-2*y*y, 0], [0, 0, 0, 1]]
        scale = node.get("scale", [1, 1, 1])
        trans = node.get("translation", [0, 0, 0])
        for i in range(3):
            for j in range(3):
                rot[i][j] *= scale[j]
            rot[i][3] = trans[i]
        return rot

    meshes = []
    positions_by_mesh = []
    for mi, mesh in enumerate(doc.get("meshes", [])):
        stats = {"index": mi, "name": mesh.get("name"), "primitives": 0,
                 "vertices": 0, "triangles": 0, "degenerate_triangles": 0,
                 "normal_nonunit_count": 0, "normal_winding_disagreements": 0,
                 "uv_vertices": 0, "material_indices": []}
        positions = []
        for p in mesh["primitives"]:
            stats["primitives"] += 1
            attr = p.get("attributes", {})
            pos = accessors[attr["POSITION"]]
            positions.extend(pos)
            stats["vertices"] += len(pos)
            normals = None
            if "NORMAL" not in attr:
                warnings.append(f"Mesh {mi} primitive has no NORMAL accessor")
            else:
                normals = accessors[attr["NORMAL"]]
                stats["normal_nonunit_count"] += sum(abs(sum(v*v for v in row)-1) > .01 for row in normals)
                if len(normals) != len(pos):
                    errors.append(f"Mesh {mi}: NORMAL/POSITION count mismatch")
            if "TEXCOORD_0" in attr:
                stats["uv_vertices"] += len(accessors[attr["TEXCOORD_0"]])
            if "material" in p:
                stats["material_indices"].append(p["material"])
                if p["material"] >= len(doc.get("materials", [])):
                    errors.append(f"Mesh {mi}: invalid material index")
                else:
                    material = doc["materials"][p["material"]]
                    textures = [material.get(key) for key in ("normalTexture", "occlusionTexture", "emissiveTexture")]
                    textures += [material.get("pbrMetallicRoughness", {}).get(key)
                                 for key in ("baseColorTexture", "metallicRoughnessTexture")]
                    for tex in filter(None, textures):
                        channel = f"TEXCOORD_{tex.get('texCoord', 0)}"
                        if channel not in attr:
                            errors.append(f"Mesh {mi}: textured material missing {channel}")
            inds = [i[0] for i in accessors[p["indices"]]] if "indices" in p else list(range(len(pos)))
            if any(i < 0 or i >= len(pos) for i in inds):
                errors.append(f"Mesh {mi}: out-of-range vertex index")
                continue
            mode = p.get("mode", 4)
            if mode == 4:
                if len(inds) % 3:
                    errors.append(f"Mesh {mi}: triangle index count not divisible by 3")
                faces = [inds[k:k+3] for k in range(0, len(inds)-2, 3)]
            elif mode == 5:
                faces = [([inds[k+1], inds[k], inds[k+2]] if k % 2 else inds[k:k+3])
                         for k in range(len(inds)-2)]
            elif mode == 6:
                faces = [[inds[0], inds[k], inds[k+1]] for k in range(1, len(inds)-1)]
            else:
                warnings.append(f"Mesh {mi}: non-triangle primitive mode {mode}")
                faces = []
            stats["triangles"] += len(faces)
            for a, b, c in faces:
                u = [pos[b][j] - pos[a][j] for j in range(3)]
                v = [pos[c][j] - pos[a][j] for j in range(3)]
                cross = [u[1]*v[2]-u[2]*v[1], u[2]*v[0]-u[0]*v[2], u[0]*v[1]-u[1]*v[0]]
                if sum(c*c for c in cross) < 1e-18:
                    stats["degenerate_triangles"] += 1
                elif normals is not None and len(normals) == len(pos):
                    averaged = [normals[a][j] + normals[b][j] + normals[c][j] for j in range(3)]
                    if sum(cross[j] * averaged[j] for j in range(3)) < -1e-12:
                        stats["normal_winding_disagreements"] += 1
        meshes.append(stats)
        positions_by_mesh.append(positions)

    instances = []
    world_positions = []
    scene_index = doc.get("scene", 0)
    roots = doc.get("scenes", [{}])[scene_index].get("nodes", [])

    def visit(ni, parent, trail):
        if ni in trail:
            raise ValueError("Cyclic glTF node tree")
        node = doc["nodes"][ni]
        m = mul(parent, matrix(node))
        if any(not math.isfinite(x) for row in m for x in row):
            errors.append(f"Node {ni}: non-finite world transform")
        determinant = (m[0][0]*(m[1][1]*m[2][2]-m[1][2]*m[2][1])
                       -m[0][1]*(m[1][0]*m[2][2]-m[1][2]*m[2][0])
                       +m[0][2]*(m[1][0]*m[2][1]-m[1][1]*m[2][0]))
        if abs(determinant) < 1e-12:
            errors.append(f"Node {ni}: singular world transform")
        if determinant < 0:
            warnings.append(f"Node {ni}: negative determinant transform")
        if "mesh" in node:
            mi = node["mesh"]
            instances.append({"node": ni, "mesh": mi, "name": node.get("name")})
            for p in positions_by_mesh[mi]:
                world_positions.append([sum(m[i][j]*p[j] for j in range(3))+m[i][3] for i in range(3)])
        for child in node.get("children", []):
            visit(child, m, trail + [ni])

    for root in roots:
        visit(root, identity, [])
    bounds = None
    if world_positions:
        minimum = [min(p[i] for p in world_positions) for i in range(3)]
        maximum = [max(p[i] for p in world_positions) for i in range(3)]
        bounds = {"min": minimum, "max": maximum,
                  "size": [maximum[i]-minimum[i] for i in range(3)],
                  "center": [(maximum[i]+minimum[i])/2 for i in range(3)]}
        if abs(minimum[1]) > .001:
            errors.append(f"Ground is Y={minimum[1]:.8f}, outside 1 mm tolerance of zero")
    else:
        errors.append("Default scene has no mesh positions")
    images = []
    for i, im in enumerate(doc.get("images", [])):
        uri = im.get("uri")
        embedded = "bufferView" in im or bool(uri and uri.startswith("data:"))
        if uri and not uri.startswith("data:"):
            external_uris.append({"type": "image", "index": i, "uri": uri})
        raw = b""
        if "bufferView" in im:
            bv = doc["bufferViews"][im["bufferView"]]
            raw = buffers[bv.get("buffer", 0)][bv.get("byteOffset", 0):bv.get("byteOffset", 0)+bv["byteLength"]]
        elif uri and uri.startswith("data:"):
            raw = base64.b64decode(uri.partition(",")[2])
        dimensions = None
        if raw.startswith(b"\x89PNG\r\n\x1a\n"):
            dimensions = list(struct.unpack_from(">II", raw, 16))
        images.append({"index": i, "name": im.get("name"), "mimeType": im.get("mimeType"),
                       "embedded": embedded, "bytes": len(raw), "png_dimensions": dimensions})
    if external_uris:
        errors.append("GLB depends on external buffer/image URIs")
    if any(m["normal_nonunit_count"] for m in meshes):
        errors.append("Non-unit normals found")
    if any(m["degenerate_triangles"] for m in meshes):
        warnings.append("Zero-area/degenerate triangles found")
    if any(m["normal_winding_disagreements"] for m in meshes):
        warnings.append("Some averaged vertex normals oppose triangle winding")
    def total(key):
        return sum(m[key] for m in meshes)
    instanced = {key: sum(meshes[i["mesh"]][key] for i in instances)
                 for key in ("vertices", "triangles", "primitives")}
    return {"asset": Path(path).name, "sha256": hashlib.sha256(data).hexdigest(),
            "bytes": len(data), "gltf_asset": doc.get("asset"),
            "errors": errors, "warnings": warnings, "passed": not errors,
            "extensions_used": doc.get("extensionsUsed", []),
            "extensions_required": doc.get("extensionsRequired", []),
            "mesh_count": len(meshes), "mesh_instance_count": len(instances),
            "node_count": len(doc.get("nodes", [])), "material_count": len(doc.get("materials", [])),
            "texture_count": len(doc.get("textures", [])), "image_count": len(images),
            "vertices": total("vertices"), "triangles": total("triangles"),
            "primitives": total("primitives"), "degenerate_triangles": total("degenerate_triangles"),
            "normal_winding_disagreements": total("normal_winding_disagreements"),
            "scene_instanced_counts": instanced, "world_bounds_gltf_y_up_m": bounds,
            "external_uris": external_uris, "images": images, "meshes": meshes,
            "counting_note": "Vertices and triangles sum accessor counts per stored primitive; scene-instanced counts include repeated mesh nodes. Vertex seams may intentionally duplicate positions."}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("asset", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--sha256")
    args = parser.parse_args()
    result = inspect(args.asset)
    if args.sha256 and args.sha256.lower() != result["sha256"]:
        raise SystemExit("Input hash differs from author's stable handoff; refusing stale/partial validation")
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps({k: v for k, v in result.items() if k not in ("meshes", "images")}, indent=2))
    raise SystemExit(0 if result["passed"] else 1)


if __name__ == "__main__":
    main()

"""Focused validator tests; these do not test or build the application."""
import copy
import json
from pathlib import Path
import struct
import tempfile
import unittest

from inspect_glb import inspect


def fixture():
    raw = struct.pack("<18f3H", -1, 0, 0, 1, 0, 0, 0, 2, 0,
                      0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 2)
    doc = {"asset": {"version": "2.0"}, "scene": 0,
           "scenes": [{"nodes": [0]}], "nodes": [{"mesh": 0}],
           "meshes": [{"primitives": [{"attributes": {"POSITION": 0, "NORMAL": 1}, "indices": 2}]}],
           "buffers": [{"byteLength": len(raw)}],
           "bufferViews": [{"buffer": 0, "byteOffset": 0, "byteLength": 36},
                           {"buffer": 0, "byteOffset": 36, "byteLength": 36},
                           {"buffer": 0, "byteOffset": 72, "byteLength": 6}],
           "accessors": [{"bufferView": 0, "componentType": 5126, "count": 3, "type": "VEC3"},
                         {"bufferView": 1, "componentType": 5126, "count": 3, "type": "VEC3"},
                         {"bufferView": 2, "componentType": 5123, "count": 3, "type": "SCALAR"}]}
    return doc, raw


def serialize(doc, raw):
    j = json.dumps(doc).encode()
    j += b" " * (-len(j) % 4)
    raw += b"\x00" * (-len(raw) % 4)
    return (struct.pack("<4sII", b"glTF", 2, 12+8+len(j)+8+len(raw)) +
            struct.pack("<I4s", len(j), b"JSON") + j +
            struct.pack("<I4s", len(raw), b"BIN\x00") + raw)


class GLBInspectionTests(unittest.TestCase):
    def check(self, doc, raw):
        with tempfile.TemporaryDirectory() as temp:
            p = Path(temp) / "fixture.glb"
            p.write_bytes(serialize(doc, raw))
            return inspect(p)

    def test_valid_counts_and_bounds(self):
        report = self.check(*fixture())
        self.assertTrue(report["passed"])
        self.assertEqual((report["vertices"], report["triangles"], report["primitives"]), (3, 1, 1))
        self.assertEqual(report["world_bounds_gltf_y_up_m"]["size"], [2, 2, 0])

    def test_instancing_counts_world_transform(self):
        doc, raw = fixture()
        doc["nodes"].append({"mesh": 0, "translation": [4, 0, 0]})
        doc["scenes"][0]["nodes"].append(1)
        report = self.check(doc, raw)
        self.assertTrue(report["passed"])
        self.assertEqual(report["scene_instanced_counts"]["triangles"], 2)
        self.assertEqual(report["world_bounds_gltf_y_up_m"]["size"], [6, 2, 0])

    def test_ground_error(self):
        doc, raw = fixture()
        doc["nodes"][0]["translation"] = [0, .01, 0]
        report = self.check(doc, raw)
        self.assertFalse(report["passed"])
        self.assertIn("Ground", report["errors"][0])

    def test_external_image_error(self):
        doc, raw = fixture()
        doc["images"] = [{"uri": "https://example.invalid/texture.png"}]
        report = self.check(doc, raw)
        self.assertFalse(report["passed"])
        self.assertEqual(len(report["external_uris"]), 1)

    def test_nonfinite_and_nonunit_normals(self):
        doc, raw = fixture()
        raw = bytearray(raw)
        struct.pack_into("<f", raw, 36, float("nan"))
        struct.pack_into("<f", raw, 56, 2.0)
        report = self.check(doc, bytes(raw))
        self.assertFalse(report["passed"])
        self.assertTrue(any("non-finite" in e for e in report["errors"]))
        self.assertTrue(any("Non-unit" in e for e in report["errors"]))

    def test_invalid_index(self):
        doc, raw = fixture()
        raw = bytearray(raw)
        struct.pack_into("<H", raw, 72, 9)
        report = self.check(doc, bytes(raw))
        self.assertFalse(report["passed"])
        self.assertTrue(any("out-of-range" in e for e in report["errors"]))

    def test_degenerate_warning(self):
        doc, raw = fixture()
        raw = bytearray(raw)
        struct.pack_into("<H", raw, 76, 1)
        report = self.check(doc, bytes(raw))
        self.assertEqual(report["degenerate_triangles"], 1)
        self.assertTrue(report["warnings"])

    def test_normal_winding_disagreement(self):
        doc, raw = fixture()
        raw = bytearray(raw)
        for offset in (44, 56, 68):
            struct.pack_into("<f", raw, offset, -1.0)
        report = self.check(doc, bytes(raw))
        self.assertEqual(report["normal_winding_disagreements"], 1)
        self.assertTrue(any("oppose" in warning for warning in report["warnings"]))

    def test_textured_material_requires_uv(self):
        doc, raw = fixture()
        doc["materials"] = [{"pbrMetallicRoughness": {"baseColorTexture": {"index": 0}}}]
        doc["meshes"][0]["primitives"][0]["material"] = 0
        report = self.check(doc, raw)
        self.assertFalse(report["passed"])
        self.assertTrue(any("missing TEXCOORD_0" in error for error in report["errors"]))

    def test_singular_transform(self):
        doc, raw = fixture()
        doc["nodes"][0]["scale"] = [0, 1, 1]
        report = self.check(doc, raw)
        self.assertFalse(report["passed"])
        self.assertTrue(any("singular" in e for e in report["errors"]))

    def test_cyclic_nodes_rejected(self):
        doc, raw = fixture()
        doc["nodes"][0]["children"] = [0]
        with self.assertRaisesRegex(ValueError, "Cyclic"):
            self.check(doc, raw)


if __name__ == "__main__":
    unittest.main()

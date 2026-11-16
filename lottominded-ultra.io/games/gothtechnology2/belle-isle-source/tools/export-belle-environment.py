"""Non-destructive Blender 4.5+/5.x Belle Isle environment export.

Run with a .blend already open, for example:
  blender -b Belle_Isle_Environment.blend --python tools/export-belle-environment.py -- \
    --output game/output/belle-blender/belle-environment.glb

Mark source MESH objects with custom properties:
  belle_export = True, belle_role = 'rock' | 'bridge' | 'shore' | 'tree' | 'foliage' | 'prop'
Alternatively, place them in the BELLE_EXPORT collection and set belle_role.

Sources are never modified or saved. Blender creates LOD0/1/2 staging copies and
separate simplified rock collision proxies, then exports uncompressed GLB.
The game must explicitly select one LOD and exclude collider nodes from rendering.
"""
import argparse
import json
import math
import re
import sys
from pathlib import Path

try:
    import bpy
except ImportError:
    raise SystemExit("Run through Blender, not system Python: blender -b file.blend --python ...")

ROLES = {"rock", "bridge", "shore", "tree", "foliage", "waterbed", "prop"}
ROCK_COLLIDER_TRIANGLES = 600


def parse_args():
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", required=True, help="Stage to an ignored output folder, not game/public")
    parser.add_argument("--lod1", type=float, default=.52)
    parser.add_argument("--lod2", type=float, default=.24)
    return parser.parse_args(args)


def mesh_triangles(mesh):
    # glTF triangulates faces on export; no deprecated Blender loop-calculation API.
    return sum(max(0, len(face.vertices) - 2) for face in mesh.polygons)


def apply_modifier(obj, modifier):
    bpy.ops.object.select_all(action="DESELECT")
    obj.hide_set(False)
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=modifier.name)


def make_variant(source, name, role, stage, depsgraph, lod=None, collider=False, ratio=1.0):
    evaluated = source.evaluated_get(depsgraph)
    mesh = bpy.data.meshes.new_from_object(
        evaluated, preserve_all_data_layers=True, depsgraph=depsgraph)
    if mesh is None or mesh_triangles(mesh) == 0:
        raise ValueError(f"{source.name}: empty evaluated mesh. Apply/Realize GScatter or Geometry Nodes instances before export")
    obj = bpy.data.objects.new(name, mesh)
    stage.objects.link(obj)
    obj.matrix_world = source.matrix_world.copy()
    obj["belle_role"] = role
    if collider:
        obj["belle_collision"] = True
        mesh.materials.clear()  # Colliders never need high-resolution material maps.
        planar = obj.modifiers.new("PLANAR_COLLIDER", "DECIMATE")
        planar.decimate_type = "DISSOLVE"
        planar.angle_limit = math.radians(12)
        apply_modifier(obj, planar)
        if mesh_triangles(obj.data) > ROCK_COLLIDER_TRIANGLES:
            extra = obj.modifiers.new("BOUNDED_COLLIDER", "DECIMATE")
            extra.decimate_type = "COLLAPSE"
            extra.ratio = max(.01, ROCK_COLLIDER_TRIANGLES / mesh_triangles(obj.data))
            apply_modifier(obj, extra)
    else:
        obj["belle_lod"] = lod
        if ratio < 1 and mesh_triangles(mesh) > 24:
            decimate = obj.modifiers.new(f"LOD{lod}_COLLAPSE", "DECIMATE")
            decimate.decimate_type = "COLLAPSE"
            decimate.ratio = ratio
            apply_modifier(obj, decimate)
    return obj


def source_list():
    tagged = []
    for obj in bpy.data.objects:
        if obj.type != "MESH":
            continue
        if obj.get("belle_export") or any(col.name == "BELLE_EXPORT" for col in obj.users_collection):
            role = obj.get("belle_role")
            if role not in ROLES:
                raise ValueError(f"{obj.name}: belle_role must be one of {sorted(ROLES)}")
            tagged.append((obj, role))
    return sorted(tagged, key=lambda item: item[0].name)


def main():
    args = parse_args()
    if not (0 < args.lod2 <= args.lod1 < 1):
        raise ValueError("Expected 0 < lod2 <= lod1 < 1")
    sources = source_list()
    if not sources:
        raise ValueError("No tagged mesh objects; set belle_export=True and belle_role, or use BELLE_EXPORT collection")
    out = Path(args.output).expanduser().resolve()
    # Avoid accidental publication of unreviewed generated assets.
    if "/game/public/" in out.as_posix():
        raise ValueError("Export to game/output first; never write directly to game/public")
    out.parent.mkdir(parents=True, exist_ok=True)
    scene = bpy.context.scene
    stage = bpy.data.collections.new("BELLE_GLTF_STAGE_TEMP")
    scene.collection.children.link(stage)
    depsgraph = bpy.context.evaluated_depsgraph_get()
    records = []
    used = set()
    for source, role in sources:
        base = re.sub(r"[^A-Za-z0-9_]", "_", source.get("belle_asset_name", source.name))
        if not base or re.search(r"__(?:LOD[012]|COLLIDER)$", base) or base in used:
            raise ValueError(f"Duplicate/invalid Belle asset name after sanitization: {base!r}")
        used.add(base)
        variants = []
        for level, ratio in [(0, 1.0), (1, args.lod1), (2, args.lod2)]:
            variants.append(make_variant(source, f"{base}__LOD{level}", role, stage,
                                         depsgraph, lod=level, ratio=ratio))
        collider = (make_variant(source, f"{base}__COLLIDER", role, stage,
                                 depsgraph, collider=True) if role == "rock" else None)
        record = {"name": base, "role": role, "source": source.name,
                  "lodTriangles": [mesh_triangles(obj.data) for obj in variants],
                  "colliderTriangles": mesh_triangles(collider.data) if collider else None,
                  "sourceMaterials": [material.name for material in source.data.materials if material]}
        records.append(record)
        if record["lodTriangles"] != sorted(record["lodTriangles"], reverse=True):
            raise ValueError(f"LOD triangle counts not monotonic: {base}")
        if collider and record["colliderTriangles"] > ROCK_COLLIDER_TRIANGLES:
            raise ValueError(f"Rock {base} collider still exceeds {ROCK_COLLIDER_TRIANGLES} triangles")

    bpy.ops.object.select_all(action="DESELECT")
    for obj in stage.objects:
        obj.hide_set(False)
        obj.select_set(True)
    bpy.context.view_layer.objects.active = next(iter(stage.objects))
    # Keep Draco OFF: Belle's existing GLTFLoader does not register DRACOLoader.
    # Do not export Meshopt or KTX2 either until this specific loader supports them.
    export_options = {"filepath": str(out), "export_format": "GLB", "use_selection": True,
                      "export_extras": True, "export_yup": True, "export_apply": False,
                      "export_draco_mesh_compression_enable": False}
    # Fail closed when the currently installed exporter cannot honor a selected-only
    # GLB export: otherwise source park geometry could be exported accidentally.
    supported = {prop.identifier for prop in bpy.ops.export_scene.gltf.get_rna_type().properties}
    selection_key = next((name for name in ("use_selection", "export_selected") if name in supported), None)
    if not selection_key:
        raise RuntimeError("Blender glTF exporter has no supported selected-only setting")
    export_options.pop("use_selection")
    export_options[selection_key] = True
    if "export_extras" not in supported:
        raise RuntimeError("Blender glTF exporter cannot preserve belle_role metadata")
    result = bpy.ops.export_scene.gltf(**{key: value for key, value in export_options.items() if key in supported})
    if "FINISHED" not in result or not out.is_file():
        raise RuntimeError("Selected-only GLB export did not finish successfully")
    report = {"schema": 1, "format": "GLB", "compression": "none",
              "runtimePolicy": "select exactly one LOD; never render COLLIDER nodes",
              "sources": records}
    out.with_suffix(".json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"output": str(out), "assets": len(records),
                      "lod0Triangles": sum(r["lodTriangles"][0] for r in records),
                      "report": str(out.with_suffix(".json"))}, indent=2))


if __name__ == "__main__":
    main()

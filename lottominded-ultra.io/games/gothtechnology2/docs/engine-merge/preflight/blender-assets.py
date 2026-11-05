"""Read the existing shipping riders/wheel in a fresh background Blender process.
No master file or export is overwritten; this is M0 asset inspection only.
"""
import bpy
import json
import math
from pathlib import Path
from mathutils import Vector

pack = Path(__file__).resolve().parents[3]
root = pack / 'store/public/arcade/swoop-detroit/exports/glb'
models = [(name, name + '_LOD1.glb') for name in (
    'DS_Hoodie_Woman_01', 'DS_Mascot_Suit_01', 'DS_Mascot_Hoodie_01', 'DS_Armored_Rider_01')]
models += [('DS_Man_01', 'DS_Man_01_LOD0.glb'), ('DS_EUC_01', 'DS_EUC_01_LOD1.glb')]
report = {'blender': bpy.app.version_string, 'scope': 'read-only existing asset inspection', 'assets': []}
for folder, filename in models:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    path = root / folder / filename
    bpy.ops.import_scene.gltf(filepath=str(path))
    meshes = [o for o in bpy.data.objects if o.type == 'MESH']
    rigs = [o for o in bpy.data.objects if o.type == 'ARMATURE']
    points = [o.matrix_world @ Vector(c) for o in meshes for c in o.bound_box]
    assert points and all(math.isfinite(v) for p in points for v in p), filename
    missing = [i.filepath for i in bpy.data.images if i.source == 'FILE' and not i.packed_file and not Path(bpy.path.abspath(i.filepath)).is_file()]
    assert not missing, missing
    report['assets'].append({'file': str(path), 'meshes': len(meshes), 'vertices': sum(len(o.data.vertices) for o in meshes), 'rigs': len(rigs), 'bones': sum(len(o.data.bones) for o in rigs), 'actions': len(bpy.data.actions), 'sizeBlenderXYZ': [max(p[a] for p in points)-min(p[a] for p in points) for a in range(3)], 'missingTextures': missing})
(pack / 'docs/engine-merge/evidence/blender-assets.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
print('ENGINE_MERGE_BLENDER_PREFLIGHT_PASS', len(models), 'existing assets; exports unchanged')

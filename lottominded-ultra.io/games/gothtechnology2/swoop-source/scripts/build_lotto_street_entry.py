"""Add a street-facing second portal to the existing LottoMind master.

Blender metres: (u, -v, height). Preserve the original Mack entry and all
interior equipment. Re-running starts from the archived pre-entry master.
"""
import bpy, json, math, shutil
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parent.parent
ART = ROOT / 'art/studio-retail'
source = ROOT / 'scripts/build_production_interiors.py'
scope = {'__file__': str(source)}
exec(compile(source.read_text().split('\nreports=[]')[0], str(source), 'exec'), scope)
backup = ART / 'before-street-entry'
backup.mkdir(exist_ok=True)
for name in ['LottoMind_Store.blend', 'lottomind-store-authoring.glb']:
    if not (backup/name).exists():
        shutil.copy2(ART/name, backup/name)
if not (backup/'lottomind-store-runtime.glb').exists():
    shutil.copy2(ROOT/'public/exports/atwater/lottomind-store.glb', backup/'lottomind-store-runtime.glb')

bpy.ops.wm.open_mainfile(filepath=str(backup/'LottoMind_Store.blend'))
wall = bpy.data.objects.get('LottoMind back wall')
if wall is None:
    raise RuntimeError('The archived LottoMind back wall was not found')
bpy.data.objects.remove(wall, do_unlink=True)

# Move the complete practice-ticket wall onto the right indoor wall. This
# opens the street windows without losing the app's existing display assets.
moved = []
for o in list(bpy.context.scene.objects):
    if any(o.name.startswith(n) for n in ['Backlit practice ticket display', 'Illustrated number card', 'Ticket sample numerals', 'Practice ticket wall caption', 'Practice play disclosure']):
        u, minus_v = o.location.x, o.location.y
        o.location.x = 6.48 + minus_v - 9.2
        o.location.y = 2.75 - (u - .75)
        o.rotation_euler.z -= math.pi/2
        moved.append(o.name)

cube, panel, label, material, floor = [scope[n] for n in ['cube','panel','label','material','floor']]
navy = bpy.data.materials['LottoMind midnight blue']
blue = bpy.data.materials['LottoMind electric blue']
gold = bpy.data.materials['Higgsfield satin brass']
ivory = bpy.data.materials['Higgsfield gallery plaster']
black = bpy.data.materials['Powder coated graphite']
white = bpy.data.materials['Warm white studio diffuser']
rubber = bpy.data.materials['Rubber / acoustic felt']

# A 2.6 m opening at u=-4.35 connects to the unobstructed west aisle.
cube('Street entry left masonry pier', -6.175, 1.95, -9.35, 1.05, 3.9, .18, navy)
cube('Street portal masonry lintel', -4.35, 3.47, -9.35, 2.6, .86, .18, navy)
cube('Street display stone base', 1.825, .23, -9.35, 9.75, .46, .20, ivory)
cube('Street display fascia', 1.825, 3.52, -9.35, 9.75, .76, .23, navy)
for u in [-5.65, -3.05, 1.825, 6.70]:
    cube('Street portal brass mullion', u, 1.56, -9.42, .10, 3.10, .16, gold)
for u in [-.6125, 4.2625]:
    for y in [.48, 3.10]:
        cube('Street window brass rail', u, y, -9.42, 4.775, .075, .14, gold)
glass = material('Street storefront clear glazing', (.53,.67,.75), .10, .18)
glass.diffuse_color = (.53,.67,.75,.16)
glass.node_tree.nodes.get('Principled BSDF').inputs['Alpha'].default_value = .16
glass.surface_render_method = 'DITHERED'
for u in [-.6125, 4.2625]:
    panel('Street display glazing', u, 1.79, -9.43, 4.675, 2.55, glass, math.pi)

cube('Street entrance recessed mat', -4.35, .080, -8.50, 2.55, .024, 1.6, rubber, 0)
label('Street entry welcome', 'APP LOUNGE / COME INSIDE', -4.35, 3.39, -9.56, .12, white, math.pi)
label('Street window services', 'NUMBERS  /  MUSIC  /  PLAY', 1.825, 3.53, -9.51, .22, white, math.pi)
label('Counter rear wayfinding', 'LOTTOMIND / PLAY DESK', 1.9, .75, -7.135, .25, white, math.pi)

# Upper-storey details belong to the same building, not a pasted flat banner.
for u in [-5, -2.5, 0, 2.5, 5]:
    cube('Street rear upper window', u, 8.45, -9.424, 1.55, 1.45, .05, black)
    cube('Street rear upper sash', u, 8.45, -9.47, .05, 1.45, .04, gold)
    cube('Street rear upper sill', u, 7.65, -9.50, 1.8, .13, .30, ivory)

report = scope['finish']('LottoMind with two walk-in street entries', ROOT/'public/exports/atwater/lottomind-store.glb', 'LottoMind_Store.blend')
report.update({'portal': {'u':-4.35,'v':-9.35,'width':2.6,'height':3.04}, 'ticketDisplayObjectsRelocated':len(moved), 'sourceMaster':'before-street-entry/LottoMind_Store.blend','textures':'Existing original LottoMind identity and Higgsfield retail materials; no new external images'})
(ART/'street-entry-provenance.json').write_text(json.dumps(report, indent=2)+'\n')
print('LOTTOMIND_STREET_ENTRY_SUCCESS')

"""Move the existing authored cabinet, preserving the rest of both editable rooms."""
import bpy, shutil
from pathlib import Path
from mathutils import Vector

ROOT=Path(__file__).resolve().parent.parent
source=ROOT/'scripts/build_production_interiors.py'
scope={'__file__':str(source)}
exec(compile(source.read_text().split('\nreports=[]')[0],str(source),'exec'),scope)
ART=ROOT/'art/studio-retail'
backup=ART/'before-cabinet-move';backup.mkdir(exist_ok=True)
for name in ['LottoMind_Store.blend','GothTech_Retail.blend']:
 if not (backup/name).exists():shutil.copy2(ART/name,backup/name)

bpy.ops.wm.open_mainfile(filepath=str(backup/'LottoMind_Store.blend'))
removed=[]
for o in list(bpy.context.scene.objects):
 if o.type not in ['MESH','FONT']:continue
 points=[o.matrix_world@Vector(v) for v in o.bound_box]
 if points and all(-6.1<p.x<-5.0 and 5.7<p.y<6.7 and -.05<p.z<2.1 for p in points):
  removed.append(o.name);bpy.data.objects.remove(o,do_unlink=True)
if len(removed)<30:raise RuntimeError('Could not identify the complete original arcade cabinet: '+str(len(removed)))
scope['finish']('LottoMind without Underground cabinet',ROOT/'public/exports/atwater/lottomind-store.glb','LottoMind_Store.blend')

bpy.ops.wm.open_mainfile(filepath=str(backup/'GothTech_Retail.blend'))
P=scope['palette']();scope['arcade_cabinet'](2.35,-4.7,'RAHBE / UNDERGROUND',P)
scope['finish']('GothTech with Underground cabinet',ROOT/'public/exports/boutique/GothTechnology-Store.glb','GothTech_Retail.blend')
(ART/'cabinet-move.txt').write_text('Moved existing Underground cabinet from LottoMind (-5.55, -6.2) to GothTech (2.35, -4.7). Removed '+str(len(removed))+' authored cabinet objects. Both original masters backed up in before-cabinet-move. Runtime hardware and collision follow the new placement.\n')

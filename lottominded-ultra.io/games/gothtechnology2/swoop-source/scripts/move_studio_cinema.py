"""Relocate only the authored cinema hardware onto the adjacent left wall."""
import bpy, json, shutil
from pathlib import Path
from mathutils import Vector

ROOT=Path(__file__).resolve().parent.parent
ART=ROOT/'art/studio-retail'
source=ROOT/'scripts/build_production_interiors.py'
scope={'__file__':str(source)}
exec(compile(source.read_text().split('\nreports=[]')[0],str(source),'exec'),scope)
backup=ART/'before-cinema-left-wall';backup.mkdir(exist_ok=True)
for name in ['Mack_Production_Studio.blend','mack-gothtech-studio-authoring.glb']:
 if not (backup/name).exists():shutil.copy2(ART/name,backup/name)
target=ROOT/'public/exports/atwater/mack-gothtech-studio.glb'
if not (backup/'mack-gothtech-studio-runtime.glb').exists():shutil.copy2(target,backup/'mack-gothtech-studio-runtime.glb')
bpy.ops.wm.open_mainfile(filepath=str(backup/'Mack_Production_Studio.blend'))
prefixes=['Giant wall display aluminum chassis','Display top and bottom brass edge','Display vertical brass edge','Wall surround loudspeaker','Wall screen program label','Wall display status strip']
objects=[o for o in bpy.context.scene.objects if o.location.x>23 and any(o.name.startswith(name) for name in prefixes)]
if len(objects)!=9:raise RuntimeError('Expected exactly nine cinema hardware objects, found '+str(len(objects)))
names=[o.name for o in objects]
scope['move_cinema_to_left_wall'](objects)
bpy.context.view_layer.update()
points=[o.matrix_world@Vector(v) for o in objects for v in o.bound_box]
if not all(10<p.x<21 and 21.3<-p.y<21.85 for p in points):raise RuntimeError('Cinema hardware missed its intended wall')
report=scope['finish']('Mack studio cinema on adjacent left wall',target,'Mack_Production_Studio.blend')
report.update({'movedObjects':names,'chassis':{'u':15.55,'v':21.70,'y':3.05},'videoSurface':{'u':15.55,'v':21.58,'y':3.05,'normal':[0,0,-1]},'sourceMaster':'before-cinema-left-wall/Mack_Production_Studio.blend'})
(ART/'cinema-left-wall-provenance.json').write_text(json.dumps(report,indent=2)+'\n')
print('STUDIO_CINEMA_LEFT_WALL_SUCCESS')

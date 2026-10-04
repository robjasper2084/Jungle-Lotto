import bpy, json
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
hero=Path(r'C:\Users\digit\Documents\phone\Digital_Static_Street_Asset_Pack\exports\glb\DS_Man_01\DS_Man_01_LOD0.glb')
walk=Path(r'C:\Users\digit\Documents\phone\euc-detroit-riverwalk\art\elmwood\landmark-pass\Unity\Assets\Kevin Iglesias\Human Animations\Animations\Male\Movement\Walk\HumanM@Walk01_Forward.fbx')
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(hero))
target=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE');target.name='Original suited hero'
bpy.ops.import_scene.fbx(filepath=str(walk),ignore_leaf_bones=True)
source=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE' and o!=target)
report={}
for key,arm in [('hero',target),('walk',source)]:
 report[key]={'object':arm.name,'world':list(map(list,arm.matrix_world)),'bones':[{'name':b.name,'parent':b.parent.name if b.parent else None,'head':list(b.head_local),'tail':list(b.tail_local)} for b in arm.data.bones], 'action':arm.animation_data.action.name if arm.animation_data and arm.animation_data.action else None}
report['actions']=[{'name':a.name,'range':list(a.frame_range)} for a in bpy.data.actions]
report['samples']=[]
for frame in [1,6,11,16,21]:
 bpy.context.scene.frame_set(frame)
 report['samples'].append({'frame':frame,'points':{n:list(source.pose.bones[n].matrix.translation*.01) for n in ['B-hips','B-foot.L','B-foot.R','B-upperArm.L','B-forearm.L','B-hand.L']}})
out=ROOT/'art'/'animation-polish'/'retail-walk-inspection.json';out.parent.mkdir(parents=True,exist_ok=True);out.write_text(json.dumps(report,indent=2))
print(json.dumps(report))

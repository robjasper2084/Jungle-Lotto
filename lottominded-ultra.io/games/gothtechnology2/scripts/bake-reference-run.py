"""Bake the actual fitted runtime run onto a separate editable Blender hero master."""
import bpy,json,math
from pathlib import Path
from mathutils import Matrix,Quaternion,Vector
root=Path(__file__).resolve().parents[1]
out=root/'swoop-source/art/reference-run-20261028'
data=json.loads((out/'runtime-bake.json').read_text())
source=Path('C:/Users/digit/Documents/phone/hero-wheel-animation-20261004/Blender/Rigify/DS_Man_01_Rigify.blend')
bpy.ops.wm.open_mainfile(filepath=str(source))
rig=bpy.data.objects['DS_Man_01_Rig'];controls=bpy.data.objects.get('DS_Man_01_Rigify_Controls')
for o in bpy.context.scene.objects:
 if o.animation_data:o.animation_data_clear()
if controls:controls['Edit_pose']=0.
for b in rig.pose.bones:b.matrix_basis=Matrix.Identity(4)
bpy.context.view_layer.update()
rest={b.name:(rig.matrix_world@b.matrix).copy() for b in rig.pose.bones}
action=bpy.data.actions.new('Reference_Run_12_Pose');action.use_fake_user=True
rig.animation_data_create();rig.animation_data.action=action
convert=Quaternion((1,0,0),math.pi/2)
def quat(a):return Quaternion((a[3],a[0],a[1],a[2]))
for i,row in enumerate(data['frames']):
 bpy.context.scene.frame_set(i+1)
 for b in rig.pose.bones:
  if b.name not in row or b.name not in data['rest']:continue
  r=row[b.name];base=data['rest'][b.name]
  delta=convert@quat(r['q'])@quat(base['q']).inverted()@convert.inverted()
  m=Matrix.Translation(convert@Vector(r['p']))@(delta@rest[b.name].to_quaternion()).to_matrix().to_4x4()
  b.matrix=rig.matrix_world.inverted()@m
  b.rotation_mode='QUATERNION';b.keyframe_insert('location',frame=i+1);b.keyframe_insert('rotation_quaternion',frame=i+1)
  bpy.context.view_layer.update()
scene=bpy.context.scene;scene.render.fps=120;scene.frame_start=1;scene.frame_end=60;scene.frame_set(1)
scene['Reference']='https://www.youtube.com/watch?v=dUDRcG9ihY4'
scene['Authorship']='Original Blender curves fitted by shared browser-game rig solver; source meshes retained for editing. Runtime uses current corrected GLBs.'
bpy.ops.wm.save_as_mainfile(filepath=str(out/'Hero_Reference_Run.blend'))
print('RUN_MASTER_SAVED',out/'Hero_Reference_Run.blend')

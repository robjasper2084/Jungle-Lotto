"""Bake portable fall controls and an editable Rigify reference with free Blender tools."""
import bpy, json
from pathlib import Path
root=Path(__file__).resolve().parents[1]
out=root/'art'/'fall-motion'
out.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
scene=bpy.context.scene
scene.render.fps=120
scene.frame_start=0
scene.frame_end=240
control=bpy.data.objects.new('Swoop_Fall_Controls',None)
bpy.context.collection.objects.link(control)
bpy.context.view_layer.objects.active=control
control.select_set(True)
# Reach early; bend elbows at impact; keep the chin and knees tucked through the roll.
keys={
 'reach':[(0,0),(.12,.80),(.32,1),(.50,.84),(.66,.22),(1.15,.08),(1.8,0),(2,0)],
 'absorb':[(0,0),(.40,0),(.54,1),(.72,.72),(1.1,.16),(1.8,0),(2,0)],
 'curl':[(0,0),(.17,.12),(.40,.45),(.64,.85),(.95,.72),(1.8,.48),(2,.48)],
 'headTuck':[(0,0),(.15,.65),(.40,1),(.74,.9),(1.8,.35),(2,.35)],
 'stagger':[(0,0),(.14,.7),(.34,1),(.75,.75),(1.8,.45),(2,.45)],
}
for channel,poses in keys.items():
 control[channel]=0.0
 for seconds,value in poses:
  # Custom properties change type on assignment. Integer keys previously turned
  # reach/absorb into binary switches instead of continuous animation curves.
  control[channel]=float(value)
  control.keyframe_insert(data_path='["'+channel+'"]',frame=seconds*120,group='Contact-aware fall')
action=control.animation_data.action
action.name='Swoop_Brace_Impact_Roll_Settle'
for layer in action.layers:
 for strip in layer.strips:
  for bag in strip.channelbags:
   for curve in bag.fcurves:
    for key in curve.keyframe_points:
     key.interpolation='BEZIER'
     key.handle_left_type=key.handle_right_type='AUTO_CLAMPED'
samples=[]
for frame in range(241):
 scene.frame_set(frame)
 samples.append([round(float(control[name]),6) for name in keys])
data={'source':'Blender built-in Action/F-curve tools; authored for Swoop, no external animation copied','fps':120,'channels':list(keys),'samples':samples}
(root/'src'/'detroit'/'fall-curves.json').write_text(json.dumps(data,separators=(',',':')))
scene.frame_set(60)
bpy.ops.preferences.addon_enable(module='rigify')
bpy.ops.object.armature_human_metarig_add()
rig=bpy.context.object
rig.name='Fall_Posture_Rigify_Reference'
rig.show_in_front=True
rig['purpose']='Editable posture reference; game retargets these controls to the supplied rider skins using IK.'
for frame,row in enumerate(samples):
 reach,absorb,curl,tuck,stagger=row
 for side,sign in [('L',1),('R',-1)]:
  for name,rotation in [(f'upper_arm.{side}',(-.7*reach+.35*absorb,0,sign*(.12+.2*stagger))),
                        (f'forearm.{side}',(-.25-.65*absorb-.3*curl,0,0)),
                        (f'thigh.{side}',(-.75*curl*(1 if side=='L' else .72),0,sign*.08*curl)),
                        (f'shin.{side}',(1.25*curl,0,0)),('spine.006',(.3*tuck,0,0))]:
   bone=rig.pose.bones.get(name)
   if bone:
    bone.rotation_mode='XYZ';bone.rotation_euler=rotation
    bone.keyframe_insert(data_path='rotation_euler',frame=frame,group='Fall posture')
rig.animation_data.action.name='Brace_Absorb_Shoulder_Roll'
scene.frame_set(60)
bpy.ops.wm.save_as_mainfile(filepath=str(out/'Swoop_Fall_Motion.blend'))
(out/'README.md').write_text('# Swoop fall motion controls\n\nEditable Blender Action with five contact-relative posture channels. 120 Hz samples ship in src/detroit/fall-curves.json. The game retargets these controls to all four supplied rider skeletons with its existing two-bone IK; terrain sweeps remain authoritative. This is a procedural animation control asset, not motion capture or a ragdoll. No paid plug-in is required.\n\nRebuild: blender --background --factory-startup --python scripts/build_fall_motion.py\n')
print('Baked',len(samples),'samples to fall-curves.json')

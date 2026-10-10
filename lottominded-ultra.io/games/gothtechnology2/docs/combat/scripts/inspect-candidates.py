import bpy,json,sys
from pathlib import Path
base=Path(sys.argv[sys.argv.index('--')+1]);report=[]
for path in base.glob('*.fbx'):
 bpy.ops.wm.read_factory_settings(use_empty=True)
 if path.read_bytes().startswith(b'; FBX'):
  parser=Path(r'C:/Users/digit/Documents/phone/gothtech-film-mocap-20261005/extract_motion.py').read_text().split('outputs={}')[0]
  scope={};exec(compile(parser,'installed-ascii-fbx-reader','exec'),scope)
  objects=scope['ascii_import'](path)
  actions=[o.animation_data.action for o in objects.values() if o.animation_data and o.animation_data.action]
  report.append({'file':path.name,'importer':'existing local ASCII FBX channel parser','bones':list(objects),'actions':len(actions),'frames':[min(a.frame_range[0] for a in actions),max(a.frame_range[1] for a in actions)],'fps':24,'decision':'Reference only: standing full-body gun mime. Existing feet and mounted two-hand IK retained.'})
 else:bpy.ops.import_scene.fbx(filepath=str(path),ignore_leaf_bones=True)
 rigs=[o for o in bpy.context.scene.objects if o.type=='ARMATURE']
 for rig in rigs:
  action=rig.animation_data.action if rig.animation_data else None
  report.append({'file':path.name,'rig':rig.name,'bones':list(rig.data.bones.keys()),'clip':action.name if action else None,'frames':list(action.frame_range) if action else [],'fps':bpy.context.scene.render.fps,'decision':'Candidate reference only. Full-body standing gun mime is not a mounted two-hand reload or EUC clip. No automatic replacement of established riding or walking motion.'})
 bpy.ops.wm.save_as_mainfile(filepath=str(base/(path.stem+'-inspection.blend')))
(base/'blender-inspection.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report))

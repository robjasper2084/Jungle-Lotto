"""Export the isolated, newly authored action masters as animation-only FBX."""
import bpy
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
ART=ROOT/'swoop-source/art/hero-actions-20261017'
OUT=Path('C:/Users/digit/Documents/phone/hero-wheel-animation-20261004/UnityProject/Assets/HeroActions20261017/Models')
OUT.mkdir(parents=True,exist_ok=True)
for file in ART.glob('DS_*_Actions.blend'):
    aid=file.stem.removesuffix('_Actions')
    bpy.ops.wm.open_mainfile(filepath=str(file))
    rig=bpy.data.objects[aid+'_Rig'];controls=bpy.data.objects[aid+'_Rigify_Controls'];controls['Edit_pose']=0.
    bpy.ops.object.select_all(action='DESELECT');rig.hide_set(False);rig.select_set(True);bpy.context.view_layer.objects.active=rig
    for name in ['StandingIdle','WeaponDraw','WeaponHolster','WheelPickupPolish']:
        action=bpy.data.actions[name];rig.animation_data.action=action
        bpy.context.scene.frame_start=1;bpy.context.scene.frame_end=round(action.frame_range[1]);bpy.context.scene.frame_set(1)
        bpy.ops.export_scene.fbx(filepath=str(OUT/f'{aid}_{name}.fbx'),use_selection=True,object_types={'ARMATURE'},
            add_leaf_bones=False,bake_anim=True,bake_anim_use_all_actions=False,bake_anim_use_nla_strips=False,
            bake_anim_simplify_factor=0,axis_forward='-Z',axis_up='Y')
print('ACTION_FBX_EXPORTED',20,flush=True)

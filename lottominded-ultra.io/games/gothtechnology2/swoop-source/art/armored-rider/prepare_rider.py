"""Prepare a separate, non-destructive Blender project for the new rider."""
import bpy
from pathlib import Path

folder=Path(__file__).resolve().parent
assert bpy.data.filepath.endswith('DS_Hoodie_Man_01.blend')
arm=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
arm.name='DS_Armored_Rider_01_Rig'
arm.data.name='DS_Armored_Rider_01_Skeleton'
root=arm.parent
root.name='DS_Armored_Rider_01'
root['status']='Reference layout prepared; final armor pending Higgsfield turnaround'
root['source_photo']='52590114_10158195045604167_4252205837096845312_n.jpg'
root['forward_axis']='-Y'
root['unit']='metre'
for o in bpy.context.scene.objects:
    if o.type=='MESH':o.name='Armored rider / fitted base'
refs=bpy.data.collections.new('Armored rider / source references')
bpy.context.scene.collection.children.link(refs)
image=bpy.data.images.load('C:/Users/digit/Downloads/52590114_10158195045604167_4252205837096845312_n.jpg')
image.pack()
ref=bpy.data.objects.new('User photograph / rear silhouette reference',None)
refs.objects.link(ref)
ref.empty_display_type='IMAGE'
ref.data=image
ref.empty_display_size=1.85
ref.location=(1.7,.45,1.1)
ref.rotation_euler=(1.57079632679,0,0)
ref.hide_render=True
ref['reference_only']=True
armor=bpy.data.collections.new('Armored rider / editable protective gear')
bpy.context.scene.collection.children.link(armor)
bpy.context.scene.unit_settings.system='METRIC'
bpy.context.scene.unit_settings.scale_length=1
bpy.ops.wm.save_as_mainfile(filepath=str(folder/'Armored_Rider_Setup.blend'))
print('ARMORED_RIDER_SETUP_SAVED',len(arm.data.bones),'bones')

"""Add portable command poses to the original Swoop skin; never overwrite the master."""
import bpy, json, math, shutil
from pathlib import Path
from mathutils import Matrix, Vector
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'art/animation-polish'
OUT.mkdir(parents=True,exist_ok=True)
RUNTIME=ROOT/'public/exports/polish'
RUNTIME.mkdir(parents=True,exist_ok=True)
arm=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
body=next(o for o in bpy.context.scene.objects if o.type=='MESH')
arm.animation_data.action=None
for track in arm.animation_data.nla_tracks: track.mute=True
for p in arm.pose.bones: p.matrix_basis=Matrix.Identity(4)
bpy.context.view_layer.update()
rest={p.name:p.matrix.copy() for p in arm.pose.bones}
feet={n:p.translation.copy() for n,p in rest.items() if '_paw_' in n}
def update(): bpy.context.view_layer.update()
def point(a,b,target):
    origin=a.head.copy()
    rotation=(b.head-origin).normalized().rotation_difference((target-origin).normalized())
    a.matrix=Matrix.Translation(origin)@rotation.to_matrix().to_4x4()@Matrix.Translation(-origin)@a.matrix
    update()
def solve(prefix,side,target):
    a=arm.pose.bones[f'{prefix}_upper_{side}'];b=arm.pose.bones[f'{prefix}_lower_{side}']
    ankle=arm.pose.bones[f'{prefix}_ankle_{side}'];foot=arm.pose.bones[f'{prefix}_paw_{side}']
    offset=foot.head-ankle.head;goal=target-offset
    origin=a.head.copy();l1=(b.head-origin).length;l2=(ankle.head-b.head).length
    direction=(goal-origin).normalized();distance=max(.015,min((goal-origin).length,l1+l2-.001))
    pole=Vector((0,1 if prefix=='front' else -1,0));pole=(pole-direction*pole.dot(direction)).normalized()
    along=(l1*l1+distance*distance-l2*l2)/(2*distance)
    joint=origin+direction*along+pole*math.sqrt(max(0,l1*l1-along*along))
    point(a,b,joint);point(b,ankle,origin+direction*distance)
    point(ankle,foot,ankle.head+offset)
    m=rest[foot.name].copy();m.translation=foot.head;foot.matrix=m;update()
for name in ['Dog_Sit','Dog_Down']:
    action=bpy.data.actions.new(name);arm.animation_data.action=action
    for frame in range(1,122):
        for p in arm.pose.bones:p.matrix_basis=Matrix.Identity(4);p.rotation_mode='QUATERNION'
        update()
        if name=='Dog_Sit':
            pivot=rest['pelvis'].translation
            arm.pose.bones['pelvis'].matrix=Matrix.Translation(pivot+Vector((0,.025,-.33)))@Matrix.Rotation(-.82,4,'X')@Matrix.Translation(-pivot)@rest['pelvis'];update()
            for bone,amount in [('chest',.30),('neck',.30),('head',.22)]:
                p=arm.pose.bones[bone];origin=p.head.copy()
                p.matrix=Matrix.Translation(origin)@Matrix.Rotation(amount,4,'X')@Matrix.Translation(-origin)@p.matrix;update()
        else:
            arm.pose.bones['root'].matrix=Matrix.Translation(Vector((0,0,-.29)))@rest['root'];update()
        for side in ['L','R']:
            solve('front',side,feet[f'front_paw_{side}']+Vector((0,-.20 if name=='Dog_Down' else .12,0)))
            solve('hind',side,feet[f'hind_paw_{side}']+Vector((-.045 if side=='L' else .045,-.12 if name=='Dog_Down' else -.13,0)))
        # Correct the deformed skin contact in authoring space, including the haunches.
        evaluated=body.evaluated_get(bpy.context.evaluated_depsgraph_get());mesh=evaluated.to_mesh()
        floor=min((evaluated.matrix_world@v.co).z for v in mesh.vertices)
        evaluated.to_mesh_clear()
        p=arm.pose.bones['root'];m=p.matrix.copy();m.translation.z+=.012-floor;p.matrix=m;update()
        phase=(frame-1)/120
        arm.pose.bones['chest'].scale=(1+math.sin(phase*math.tau)*.0015,1,1)
        for p in arm.pose.bones:
            for prop in ['location','rotation_quaternion','scale']:p.keyframe_insert(prop,frame=frame)
    track=arm.animation_data.nla_tracks.new();track.name=name;track.strips.new(name,1,action);arm.animation_data.action=None
for track in arm.animation_data.nla_tracks:track.mute=False
scene=bpy.context.scene;scene.frame_start=1;scene.frame_end=121;scene.frame_set(1)
bpy.ops.object.select_all(action='DESELECT')
for obj in [arm,body]:obj.select_set(True)
bpy.context.view_layer.objects.active=arm
bpy.ops.export_scene.gltf(filepath=str(RUNTIME/'DS_Boerboel_Polished.glb'),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_force_sampling=True,export_frame_range=True,export_anim_slide_to_zero=True)
shutil.copy2(RUNTIME/'DS_Boerboel_Polished.glb',OUT/'DS_Boerboel_Polished-authoring.glb')
bpy.ops.export_scene.fbx(filepath=str(OUT/'DS_Boerboel_Polished.fbx'),use_selection=True,add_leaf_bones=False,bake_anim=True,bake_anim_use_all_actions=False,bake_anim_use_nla_strips=True,path_mode='COPY',embed_textures=True)
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'DS_Boerboel_Polished.blend'))
(OUT/'provenance.json').write_text(json.dumps({'source':'Digital_Static_Street_Asset_Pack/source/dog/DS_Boerboel_01.blend','authoring':'Blender 5.2.1 LTS built-in rig, Action and glTF exporter','commands':['Dog_Sit','Dog_Down'],'originalGaitsPreserved':True,'tailWagDisabledInRuntime':True},indent=2))
print('SWOOP_COMPANION_POLISH_EXPORTED')

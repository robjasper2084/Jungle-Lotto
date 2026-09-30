"""Retain existing rigs and survey-aligned placement; author petals and a folded-leg sit."""
import bpy,math,json,random
from pathlib import Path
from mathutils import Vector,Matrix
ROOT=Path(__file__).resolve().parents[1];PUB=ROOT/'public/elmwood'
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'art/blender/DS_Boerboel_Elmwood_Commands.blend'))
bpy.context.preferences.filepaths.save_version=0
arm=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE');arm.animation_data.action=None
for track in list(arm.animation_data.nla_tracks):
 if track.name=='Dog_Sit':arm.animation_data.nla_tracks.remove(track)
 else:track.mute=True
for bone in arm.pose.bones:bone.matrix_basis=Matrix.Identity(4)
bpy.context.view_layer.update();rests={p.name:p.matrix.copy() for p in arm.pose.bones};feet={n:arm.pose.bones[n].head.copy() for n in rests if '_paw_' in n}
source=(ROOT/'tools/build_dog_companion.py').read_text(encoding='utf-8');exec(source[source.index('def update():'):source.index('scene=bpy.context.scene;')])
action=bpy.data.actions.new('Dog_Sit_Grounded');arm.animation_data.action=action
for frame in range(1,122):
 for bone in arm.pose.bones:bone.matrix_basis=Matrix.Identity(4)
 update();pivot=rests['pelvis'].translation.copy()
 arm.pose.bones['pelvis'].matrix=Matrix.Translation(pivot+Vector((0,.025,-.40)))@Matrix.Rotation(-.58,4,'X')@Matrix.Translation(-pivot)@rests['pelvis'];update()
 chest=arm.pose.bones['chest'];m=chest.matrix.copy();m.translation.z+=.045;chest.matrix=m;update()
 for name,angle in [('neck',.34),('head',.24)]:
  bone=arm.pose.bones[name];p=bone.head.copy();bone.matrix=Matrix.Translation(p)@Matrix.Rotation(angle,4,'X')@Matrix.Translation(-p)@bone.matrix;update()
 for side in ['L','R']:
  solve('front',side,feet['front_paw_'+side]+Vector((0,.12,0)))
  sign=-1 if side=='L' else 1
  solve('hind',side,Vector((sign*.16,.31,.16)),Vector((sign*.12,-1,.05)))
 arm.pose.bones['chest'].scale=(1+math.sin((frame-1)/120*math.tau)*.002,1,1+math.sin((frame-1)/120*math.tau)*.003)
 for bone in arm.pose.bones:
  bone.keyframe_insert('location',frame=frame);bone.keyframe_insert('rotation_quaternion',frame=frame);bone.keyframe_insert('scale',frame=frame)
track=arm.animation_data.nla_tracks.new();track.name='Dog_Sit';track.strips.new('Dog_Sit',1,action);arm.animation_data.action=None
for track in arm.animation_data.nla_tracks:track.mute=False
bpy.context.scene.frame_start=1;bpy.context.scene.frame_end=121;bpy.context.scene.frame_set(1)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=str(ROOT/'public/exports/glb/DS_Boerboel_01/DS_Boerboel_Elmwood.glb'),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_force_sampling=True,export_frame_range=True,export_anim_slide_to_zero=True)
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'art/blender/DS_Boerboel_Elmwood_Commands.blend'))

bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(PUB/'models/tour-flowering.glb'))
random.seed(1936);candidates=[]
for o in bpy.context.scene.objects:
 if o.type=='MESH' and any(m and m.name.startswith('leaf') for m in o.data.materials):
  candidates.extend(o.matrix_world@v.co for v in o.data.vertices)
vertices=[];faces=[]
for center in random.sample(candidates,min(500,len(candidates))):
 # Five small curved petals; geometry is shared by the mapped individual tree.
 axis=Vector((random.uniform(-1,1),random.uniform(-1,1),random.uniform(.3,1))).normalized();u=axis.cross(Vector((0,1,0))).normalized();v=axis.cross(u)
 for petal in range(5):
  a=petal*math.tau/5;rad=u*math.cos(a)+v*math.sin(a);cross=axis.cross(rad);start=len(vertices)
  vertices.extend([center,center+rad*.07+cross*.055,center+rad*.14+axis*.018,center+rad*.07-cross*.055]);faces.extend([(start,start+1,start+2),(start,start+2,start+3)])
mesh=bpy.data.meshes.new('Higan cherry five-petal blossoms');mesh.from_pydata(vertices,[],faces);mesh.update();o=bpy.data.objects.new('Spring Higan cherry flowers',mesh);bpy.context.collection.objects.link(o)
mat=bpy.data.materials.new('leaf blossom Higan cherry');mat.diffuse_color=(1,.54,.66,1);mat.use_nodes=True;mat.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(1,.54,.66,1);mat.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.9;mat.use_backface_culling=False;o.data.materials.append(mat)
bpy.ops.object.select_all(action='SELECT');bpy.ops.export_scene.gltf(filepath=str(PUB/'models/tour-higan-cherry.glb'),export_format='GLB',use_selection=True)
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'art/elmwood/audit-fixes/tour-higan-cherry.blend'))
manifest=json.loads((PUB/'asset-manifest.json').read_text());entry=dict(next(a for a in manifest if a['id']=='tour-flowering'));entry.update(id='tour-higan-cherry',label='Higan cherry · spring blossoms',glb='models/tour-higan-cherry.glb',glbBytes=(PUB/'models/tour-higan-cherry.glb').stat().st_size,triangles=entry['triangles']+len(faces),vertices=entry['vertices']+len(vertices));manifest=[a for a in manifest if a['id']!=entry['id']]+[entry];(PUB/'asset-manifest.json').write_text(json.dumps(manifest,separators=(',',':')))
placements=json.loads((PUB/'placements.json').read_text());tour=json.loads((PUB/'tree-tours.json').read_text())
for p in placements:
 if p.get('species')=='Higan Cherry':p['asset']='tour-higan-cherry'
for stop in tour['stops']:
 if stop['species']=='Higan Cherry':stop['placement']['asset']='tour-higan-cherry'
(PUB/'placements.json').write_text(json.dumps(placements,separators=(',',':')));(PUB/'tree-tours.json').write_text(json.dumps(tour,indent=2))
print('GROUNDED_SIT_AND_HIGAN_CHERRY_COMPLETE')

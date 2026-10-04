"""Retarget CMU subject 07 trial 01 walking to the game's existing humanoid.
Run in a separate Blender background process; never changes an open user scene.
Source: http://mocap.cs.cmu.edu/subjects/07/07_01.amc and 07.asf.
"""
import bpy, json, math, sys, struct
from pathlib import Path
from mathutils import Vector, Matrix, Euler, Quaternion
args=sys.argv[sys.argv.index('--')+1:]
source_dir,target_path,out_dir=map(Path,args)
out_dir.mkdir(parents=True,exist_ok=True)
lines=(source_dir/'07.asf').read_text().splitlines()
bones={};hierarchy={};inside=False;item=None
for raw in lines:
 line=raw.strip();parts=line.split()
 if line==':bonedata':inside=True;continue
 if line==':hierarchy':inside=False;continue
 if inside:
  if line=='begin':item={};continue
  if line=='end':bones[item['name']]=item;item=None;continue
  if item is None or not parts:continue
  if parts[0]=='name':item['name']=parts[1]
  elif parts[0] in ['direction','axis']:item[parts[0]]=list(map(float,parts[1:4]))
  elif parts[0]=='length':item['length']=float(parts[1])
  elif parts[0]=='dof':item['dof']=parts[1:]
 else:
  if parts and parts[0] in ['root',*bones]:
   for child in parts[1:]:hierarchy[child]=parts[0]
frames=[];frame=None
for raw in (source_dir/'07_01.amc').read_text().splitlines():
 p=raw.split()
 if not p or p[0].startswith(('#',':')):continue
 if p[0].isdigit():frame={};frames.append(frame)
 else:frame[p[0]]=list(map(float,p[1:]))
# Choose a full gait cycle by matching leg and torso angles; remove translation.
channels=['lfemur','rfemur','ltibia','rtibia','lowerback','upperback']
def difference(a,b):return sum((frames[a][k][j]-frames[b][k][j])**2 for k in channels for j in range(len(frames[a][k])))
start,end=min(((a,a+d) for a in range(20,90) for d in range(100,145) if a+d<len(frames)),key=lambda pair:difference(*pair))
duration=(end-start)/120
scale=.0254/.45
root0=Vector(frames[start]['root'][:3]);root1=Vector(frames[end]['root'][:3]);travel=root1-root0
heading=math.atan2(travel.x,travel.z)
forward_cancel=Euler((0,-heading,0),'XYZ').to_matrix()
convert=Matrix(((1,0,0),(0,0,-1),(0,1,0)))
mapping={'Hips':'root','Spine02':'lowerback','Spine01':'upperback','Spine':'thorax','neck':'lowerneck','Head':'head'}
for side,prefix in [('Left','l'),('Right','r')]:
 for target,source in [('Shoulder','clavicle'),('Arm','humerus'),('ForeArm','radius'),('Hand','hand'),('UpLeg','femur'),('Leg','tibia'),('Foot','foot')]:mapping[side+target]=prefix+source
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(target_path))
rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE');rig.animation_data_clear()
for pb in rig.pose.bones:pb.matrix_basis=Matrix.Identity(4);pb.rotation_mode='QUATERNION'
bpy.context.view_layer.update()
rest={name:(rig.matrix_world@rig.data.bones[name].matrix_local).to_quaternion() for name in mapping}
align={}
for name,source in mapping.items():
 if source=='root':align[name]=Quaternion();continue
 bone=rig.data.bones[name];target_dir=(rig.matrix_world.to_3x3()@(bone.tail_local-bone.head_local)).normalized()
 source_dir=(convert@Vector(bones[source]['direction'])).normalized()
 align[name]=target_dir.rotation_difference(source_dir)
def source_rotations(frame):
 result={'root':Euler(tuple(math.radians(v) for v in frame['root'][3:]),'XYZ').to_matrix()}
 def rotation(name):
  if name in result:return result[name]
  b=bones[name];C=Euler(tuple(math.radians(v) for v in b['axis']),'XYZ').to_matrix()
  xyz=[0.,0.,0.]
  for axis,value in zip(b.get('dof',[]),frame.get(name,[])):xyz['xyz'.index(axis[-1])]=math.radians(value)
  R=Euler(xyz,'XYZ').to_matrix();result[name]=rotation(hierarchy[name])@C@R@C.inverted();return result[name]
 for name in bones:rotation(name)
 return result
count=33;times=[duration*i/(count-1) for i in range(count)]
goals=[];bobs=[]
ys=[f['root'][1]*scale for f in frames[start:end]];mean_y=sum(ys)/len(ys)
for i,time in enumerate(times):
 n=start+time*120;a=min(end,int(n));b=min(end,a+1);t=n-a
 rotations=[]
 for index in [a,b]:
  source=source_rotations(frames[index]);rotations.append({name:(convert@forward_cancel@source[source_name]@convert.inverted()).to_quaternion()@align[name]@rest[name] for name,source_name in mapping.items()})
 goals.append({name:rotations[0][name].slerp(rotations[1][name],t) for name in mapping})
 bobs.append(((frames[a]['root'][1]*(1-t)+frames[b]['root'][1]*t)*scale-mean_y))
# Blend the tail into the identical first pose, keeping a seamless repeating clip.
for i in range(count-5,count):
 t=(i-(count-5))/4;t=t*t*(3-2*t)
 for name in mapping:goals[i][name]=goals[i][name].slerp(goals[0][name],t)
 bobs[i]=bobs[i]*(1-t)+bobs[0]*t
# Parse original glTF bind rotations so the exported deltas retain each skin's bind pose.
data=target_path.read_bytes();length=struct.unpack_from('<I',data,12)[0];gltf=json.loads(data[20:20+length]);nodes=gltf['nodes']
parents={child:i for i,n in enumerate(nodes) for child in n.get('children',[])};by_name={n.get('name'):i for i,n in enumerate(nodes)};world={}
def node_world(i):
 if i in world:return world[i]
 n=nodes[i]
 if 'matrix' in n:M=Matrix([n['matrix'][j:j+4] for j in range(0,16,4)]).transposed()
 else:
  q=n.get('rotation',[0,0,0,1]);M=Matrix.LocRotScale(Vector(n.get('translation',[0,0,0])),Quaternion((q[3],q[0],q[1],q[2])),Vector(n.get('scale',[1,1,1])))
 world[i]=node_world(parents[i])@M if i in parents else M;return world[i]
result={'name':'CMU 07-01 walk / Blender retarget','source':'CMU Graphics Lab Motion Capture Database, NSF EIA-0196217','duration':round(duration,7),'nominalSpeed':round(math.hypot(travel.x,travel.z)*scale/duration,5),'cycleMetres':round(math.hypot(travel.x,travel.z)*scale,5),'times':[round(t,7) for t in times],'bones':{},'hipBob':[round(y,6) for y in bobs]}
rig.animation_data_create();rig.animation_data.action=bpy.data.actions.new('CMU_07_01_Walking_Retarget');scene=bpy.context.scene;scene.render.fps=30
for i,goal in enumerate(goals):
 scene.frame_set(i+1)
 for pb in rig.pose.bones:
  if pb.name not in goal:continue
  parent=goal.get(pb.parent.name,(rig.matrix_world@pb.parent.bone.matrix_local).to_quaternion()) if pb.parent else rig.matrix_world.to_quaternion()
  local_rest=pb.parent.bone.matrix_local.inverted()@pb.bone.matrix_local if pb.parent else pb.bone.matrix_local
  pb.rotation_quaternion=local_rest.to_quaternion().inverted()@parent.inverted()@goal[pb.name]
  pb.keyframe_insert(data_path='rotation_quaternion',frame=i+1,group=pb.name)
 bpy.context.view_layer.update()
 for name in mapping:
  desired=(convert.inverted()@((rig.matrix_world@rig.pose.bones[name].matrix).to_3x3())@convert).to_quaternion()
  node=by_name[name];parent=parents.get(node);parent_name=nodes[parent].get('name') if parent is not None else None
  if parent_name in mapping:pq=(convert.inverted()@(rig.matrix_world@rig.pose.bones[parent_name].matrix).to_3x3()@convert).to_quaternion()
  else:pq=node_world(parent).to_quaternion() if parent is not None else Quaternion()
  original=nodes[node].get('rotation',[0,0,0,1]);bind=Quaternion((original[3],*original[:3]));delta=bind.inverted()@pq.inverted()@desired;delta.normalize()
  result['bones'].setdefault(name,[]).extend([round(delta.x,6),round(delta.y,6),round(delta.z,6),round(delta.w,6)])
scene.frame_start=1;scene.frame_end=count;scene.frame_set(1)
rig['source']='CMU Graphics Lab 07_01 walking';rig['retarget']='Anatomical segment alignment, bind-roll correction, cycle trim and loop cleanup'
bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(out_dir/'CMU_Walk_Retarget.blend'))
(out_dir/'mocapWalkData.ts').write_text('export const mocapWalk = '+json.dumps(result,separators=(',',':'))+';\n')
report={'sourceUrls':['http://mocap.cs.cmu.edu/subjects/07/07_01.amc','http://mocap.cs.cmu.edu/subjects/07/07.asf'],'frames':[start+1,end+1],'duration':duration,'nominalSpeed':result['nominalSpeed'],'mappedBones':list(mapping),'bakedSamples':count,'tool':bpy.app.version_string,'master':'CMU_Walk_Retarget.blend'}
(out_dir/'mocap-walk-report.json').write_text(json.dumps(report,indent=2))
print('MOCAP_WALK_BAKED',json.dumps(report))

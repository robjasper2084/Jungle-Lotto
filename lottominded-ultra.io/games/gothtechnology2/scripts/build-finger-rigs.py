"""Add weighted, articulated glove meshes to copies of the five shipped heroes."""
import bpy,bmesh,json,math,struct
from pathlib import Path
from mathutils import Vector
root=Path(__file__).resolve().parents[1]
source=root.parents[2]/'.game-builds/jazz-world-20261011/store/public/arcade/swoop-detroit/exports/glb'
out=root/'swoop-source/public/exports/rigged-heroes';out.mkdir(parents=True,exist_ok=True)
masters=root/'art/blender/finger-rigs-20261011';masters.mkdir(parents=True,exist_ok=True)
profiles={'Relaxed':[.18,.24,.16],'WeaponGrip':[.68,1.05,.65],'SupportGrip':[.45,.85,.5],'MeleeFist':[1.2,1.45,1.0],'ReloadRelease':[.12,.15,.1]}
rows=[]
for name in ['DS_Man_01','DS_Hoodie_Woman_01','DS_Mascot_Suit_01','DS_Mascot_Hoodie_01','DS_Armored_Rider_01']:
 bpy.ops.wm.read_factory_settings(use_empty=True)
 bpy.ops.import_scene.gltf(filepath=str(source/name/(name+'_LOD'+('0' if name=='DS_Man_01' else '1')+'.glb')))
 arm=next(o for o in bpy.data.objects if o.type=='ARMATURE');original=arm.animation_data.action if arm.animation_data else None
 if arm.animation_data:arm.animation_data.action=None
 for track in arm.animation_data.nla_tracks if arm.animation_data else []:track.mute=True
 for pb in arm.pose.bones:pb.matrix_basis.identity()
 bpy.context.view_layer.update()
 material=bpy.data.materials.new('Articulated charcoal riding gloves');material.diffuse_color=(.035,.043,.05,1);material.use_nodes=True
 principled=material.node_tree.nodes.get('Principled BSDF');principled.inputs['Base Color'].default_value=(.035,.043,.05,1);principled.inputs['Roughness'].default_value=.72
 finger_names=[];removed=0
 for side in ['Left','Right']:
  bone=arm.data.bones[side+'Hand'];frame=bone.matrix_local.copy();inv=frame.inverted();scale=max(.45,min(1.05,bone.length/.275));sign=-1 if side=='Left' else 1
  for obj in list(bpy.data.objects):
   if obj.type!='MESH':continue
   group=obj.vertex_groups.get(bone.name)
   if not group:continue
   to_arm=arm.matrix_world.inverted()@obj.matrix_world
   ids={v.index for v in obj.data.vertices if (inv@to_arm@v.co).y>.009*scale and any(g.group==group.index and g.weight>.5 for g in v.groups)}
   if ids:
    bm=bmesh.new();bm.from_mesh(obj.data);bm.verts.ensure_lookup_table();bmesh.ops.delete(bm,geom=[bm.verts[i] for i in ids],context='VERTS');bm.to_mesh(obj.data);bm.free();removed+=len(ids)
  chains=[]
  for index,(finger,length) in enumerate([('Index',.079),('Middle',.087),('Ring',.079),('Pinky',.062)]):
   x=sign*(.029-index*.019);y=.084-(.008 if index==3 else 0);points=[Vector((x,y+length*t,0)) for t in [0,.43,.75,1]];chains.append((finger,points,.0095 if index<3 else .008))
  chains.append(('Thumb',[Vector((sign*x,y,z)) for x,y,z in [(.032,.035,.001),(.049,.054,.004),(.058,.072,.006),(.059,.090,.008)]],.011))
  bpy.context.view_layer.objects.active=arm;arm.select_set(True);bpy.ops.object.mode_set(mode='EDIT')
  for finger,points,radius in chains:
   parent=arm.data.edit_bones[side+'Hand']
   for j in range(3):
    b=arm.data.edit_bones.new(side+'Hand'+finger+str(j+1));b.head=frame@(points[j]*scale);b.tail=frame@(points[j+1]*scale);b.parent=parent;b.use_connect=j>0;b.align_roll(frame.to_3x3()@Vector((0,0,1)));parent=b;finger_names.append(b.name)
  bpy.ops.object.mode_set(mode='OBJECT');arm.select_set(False)
  verts=[];faces=[];weights=[]
  def ring(center,width,depth,groups,segments=12):
   base=len(verts)
   for i in range(segments):
    angle=i*math.tau/segments;v=center+Vector((math.cos(angle)*width,0,math.sin(angle)*depth));verts.append(frame@(v*scale));weights.append(groups)
   return list(range(base,base+segments))
  def bridge(a,b):
   for i in range(len(a)):faces.append((a[i],a[(i+1)%len(a)],b[(i+1)%len(b)],b[i]))
  rings=[ring(Vector((0,y,0)),w,d,{side+'Hand':1}) for y,w,d in [(-.007,.021,.015),(.012,.025,.016),(.035,.035,.018),(.061,.039,.017),(.087,.037,.015)]]
  faces.append(tuple(reversed(rings[0])));faces.append(tuple(rings[-1]));
  for a,b in zip(rings,rings[1:]):bridge(a,b)
  for finger,points,radius in chains:
   previous=None
   for segment in range(3):
    for step in range(4):
     if segment and step==0:continue
     t=step/3;center=points[segment].lerp(points[segment+1],t);group=side+'Hand'+finger+str(segment+1)
     mix={group:1}
     if segment>0 and t<.34:mix={side+'Hand'+finger+str(segment):.5*(1-t/.34),group:.5+.5*t/.34}
     elif segment==0 and t==0:mix={side+'Hand':.6,group:.4}
     taper=1-(segment+t)*.12;r=ring(center,radius*taper,radius*.87*taper,mix,10)
     if previous:bridge(previous,r)
     else:faces.append(tuple(reversed(r)))
     previous=r
   faces.append(tuple(previous))
  mesh=bpy.data.meshes.new(side+'WeightedGlove');mesh.from_pydata(verts,[],faces);mesh.update();obj=bpy.data.objects.new(side+'ArticulatedGlove',mesh);bpy.context.collection.objects.link(obj);obj.matrix_world=arm.matrix_world.copy();obj.parent=arm;obj.matrix_parent_inverse=arm.matrix_world.inverted();obj.data.materials.append(material)
  for poly in mesh.polygons:poly.use_smooth=True
  for i,groups in enumerate(weights):
   for group,value in groups.items():vg=obj.vertex_groups.get(group) or obj.vertex_groups.new(name=group);vg.add([i],value,'REPLACE')
  mod=obj.modifiers.new('Finger skin deformation','ARMATURE');mod.object=arm
  obj['provenance']='Blender authored replacement for fused distal hand; 15 articulated finger joints, blended skin weights.'
 if not arm.animation_data:arm.animation_data_create()
 for label,angles in profiles.items():
  action=bpy.data.actions.new('Hand_'+label);arm.animation_data.action=action
  for frame_no,blend in [(1,0),(12,1),(24,1)]:
   for key in finger_names:
    pb=arm.pose.bones[key];pb.rotation_mode='XYZ';j=int(key[-1])-1;pb.rotation_euler=(angles[j]*blend*(.65 if 'Thumb' in key else 1),0,0);pb.keyframe_insert('rotation_euler',frame=frame_no,group=key)
  track=arm.animation_data.nla_tracks.new();track.name=action.name;track.strips.new(action.name,1,action);track.mute=True
 arm.animation_data.action=original
 for pb in arm.pose.bones:
  if pb.name in finger_names:pb.rotation_euler=(0,0,0)
 arm['finger_profiles']=json.dumps(profiles);bpy.context.scene.frame_set(1)
 for obj in bpy.context.scene.objects:obj.select_set(True)
 bpy.context.view_layer.objects.active=arm
 for image in bpy.data.images:
  if image.source=='FILE':
   try:image.pack()
   except Exception:pass
 bpy.ops.wm.save_as_mainfile(filepath=str(masters/(name+'.blend')))
 file=out/(name+'.glb');bpy.ops.export_scene.gltf(filepath=str(file),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_extras=True,export_apply=False)
 # Keep the original mounted bind clip first for existing loader compatibility.
 raw=file.read_bytes();size=struct.unpack_from('<I',raw,12)[0];doc=json.loads(raw[20:20+size]);animations=doc.get('animations',[]);animations.sort(key=lambda a:a.get('name','').startswith('Hand_'));doc['animations']=animations
 data=json.dumps(doc,separators=(',',':')).encode();data+=b' '*((-len(data))%4);rest=raw[20+size:];file.write_bytes(struct.pack('<4sII',b'glTF',2,20+len(data)+len(rest))+struct.pack('<II',len(data),0x4E4F534A)+data+rest)
 rows.append({'hero':name,'fingerJoints':len(finger_names),'removedFusedVertices':removed,'animations':[a['name'] for a in animations],'bytes':file.stat().st_size})
(out/'manifest.json').write_text(json.dumps({'revision':'finger-rigs-20261011','profiles':profiles,'heroes':rows},indent=2))
print(json.dumps(rows))

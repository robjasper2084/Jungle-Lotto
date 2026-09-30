"""Build editable scooter and Detroit tee rider assets in an isolated Blender process."""
import bpy,bmesh,math,json,sys
from pathlib import Path
from mathutils import Vector,Matrix
ROOT=Path(__file__).resolve().parents[1]
PACK=Path('C:/Users/digit/Documents/phone/Digital_Static_Street_Asset_Pack')
sys.path.insert(0,str(PACK/'scripts'))
from common import mat,cube,cylinder,uvball,tube,parent_world
OUT=ROOT/'public/exports/scooter';ART=ROOT/'art/scooter';OUT.mkdir(parents=True,exist_ok=True);ART.mkdir(parents=True,exist_ok=True)
def reset():bpy.ops.wm.read_factory_settings(use_empty=True)
def xyz(p):return Vector((p[0],-p[2],p[1]))
def box(n,p,s,m,bev=.008):return cube(n,xyz(p),(s[0],s[2],s[1]),m,bev=bev)
def rod(n,a,b,r,m):return cylinder(n,xyz(a),xyz(b),r,m,vertices=16)
def group(n,p=(0,0,0)):
 o=bpy.data.objects.new(n,None);bpy.context.collection.objects.link(o);o.location=xyz(p);bpy.context.view_layer.update();return o
def export(name):
 bpy.context.scene.unit_settings.system='METRIC'
 if name=='SW_Scooter_01':
  buckets={}
  for o in list(bpy.context.scene.objects):
   if o.type!='MESH':continue
   bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
   for modifier in list(o.modifiers):bpy.ops.object.modifier_apply(modifier=modifier.name)
   key=(o.parent.name if o.parent else '',o.data.materials[0].name);buckets.setdefault(key,[]).append(o)
  for (parent,material),objects in buckets.items():
   bpy.ops.object.select_all(action='DESELECT')
   for o in objects:o.select_set(True)
   bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join();objects[0].name=(parent or 'Scooter_Body')+'_'+material.replace(' ','_')
 for img in bpy.data.images:
  if img.has_data:
   if max(img.size)>1024:
    ratio=1024/max(img.size);img.scale(round(img.size[0]*ratio),round(img.size[1]*ratio))
   img.pack()
 bpy.ops.wm.save_as_mainfile(filepath=str(ART/(name+'.blend')))
 settings=dict(filepath=str(OUT/(name+'.glb')),export_format='GLB',export_animations=False,export_yup=True,export_image_format='JPEG')
 if 'export_image_quality' in bpy.ops.export_scene.gltf.get_rna_type().properties.keys():settings['export_image_quality']=88
 bpy.ops.export_scene.gltf(**settings)
 bpy.ops.export_scene.fbx(filepath=str(ART/(name+'.fbx')),use_selection=False,object_types={'EMPTY','MESH','ARMATURE'},add_leaf_bones=False,bake_anim=False,path_mode='COPY',embed_textures=True,axis_forward='-Z',axis_up='Y')
def render(name,target=(0,.9,0),camera=(2.4,2.1,4)):
 scene=bpy.context.scene;world=bpy.data.worlds.new('Preview world');world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.14,.16,.17,1);scene.world=world
 for loc,power in [((3,-4,5),550),((-3,-2,3),320)]:
  bpy.ops.object.light_add(type='AREA',location=loc);l=bpy.context.object;l.data.energy=power;l.data.size=4;l.rotation_euler=(xyz(target)-l.location).to_track_quat('-Z','Y').to_euler()
 bpy.ops.object.camera_add(location=xyz(camera));cam=bpy.context.object;cam.rotation_euler=(xyz(target)-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=2.1;scene.camera=cam
 scene.render.engine='CYCLES';scene.cycles.samples=16;scene.render.resolution_x=850;scene.render.resolution_y=900;scene.render.resolution_percentage=100;scene.render.filepath=str(ART/(name+'.png'));bpy.ops.render.render(write_still=True)

reset()
rubber=mat('Black rubber and grips',(.018,.023,.024),0,.86);alloy=mat('Satin white alloy',(.66,.70,.68),.5,.31);green=mat('Rental green',(.025,.48,.045),.18,.38);dark=mat('Graphite trim',(.035,.04,.042),.25,.44);metal=mat('Wheel silver',(.28,.32,.34),.8,.3);red=mat('Rear brake light',(.65,.005,.003),0,.3,1.1);lamp=mat('Headlamp',(.7,.82,.89),0,.23,1.3)
box('Wide alloy deck',(0,.148,-.06),(.205,.064,.78),alloy,.025)
box('Textured standing pad',(0,.183,-.06),(.182,.012,.70),rubber,.018)
for z in [-.36+i*.034 for i in range(19)]:box('Deck traction groove',(0,.190,z),(.17,.002,.005),dark,.001)
for z,label in [(-.52,'Rear'),(.50,'Front')]:
 wheel=group('Scooter_'+label+'_Wheel',(0,.145,z))
 for part in [rod(label+'_Tire',(-.044,.145,z),(.044,.145,z),.145,rubber),rod(label+'_Rim',(-.047,.145,z),(.047,.145,z),.093,dark),rod(label+'_Hub',(-.053,.145,z),(.053,.145,z),.047,metal)]:parent_world(part,wheel)
 for side in [-1,1]:
  for k in range(7):
   a=k*math.tau/7;p=rod('Cast wheel spoke',(side*.048,.145+.045*math.cos(a),z+.045*math.sin(a)),(side*.048,.145+.086*math.cos(a+.13),z+.086*math.sin(a+.13)),.009,alloy);parent_world(p,wheel)
 for k in range(28):
  a=k*math.tau/28;p=rod('Tire tread',(-.041,.145+.1455*math.cos(a),z+.1455*math.sin(a)),(.041,.145+.1455*math.cos(a+.028),z+.1455*math.sin(a+.028)),.002,dark);parent_world(p,wheel)
 # Crowned mudguard, open at the bottom rather than a solid cube.
 points=[xyz((0,.145+.171*math.sin(a),z+.171*math.cos(a))) for a in [i*math.pi/20 for i in range(21)]]
 tube(label+'_Mudguard',points,.049,dark,res=1)
box('Rear reflector',(0,.27,-.665),(.071,.024,.014),red,.006)
for x in [-.061,.061]:rod('Suspension fork',(x,.145,.50),(x,.40,.46),.021,alloy)
rod('White head tube',(0,.26,.45),(0,.56,.41),.043,alloy)
rod('Green steering stem',(0,.53,.412),(0,1.14,.33),.03,green)
box('Stem control module',(0,.86,.382),(.076,.33,.073),green,.018)
box('Headlamp housing',(0,1.05,.377),(.057,.055,.019),dark,.01)
box('Headlamp lens',(0,1.05,.39),(.039,.035,.008),lamp,.008)
rod('Diagonal frame brace',(0,.15,.22),(0,.55,.41),.035,alloy)
rod('Handlebar',(-.31,1.17,.33),(.31,1.17,.33),.022,dark)
for s in [-1,1]:
 rod('Rubber handle grip',(s*.20,1.17,.33),(s*.32,1.17,.33),.029,rubber)
 rod('Brake lever',(s*.20,1.155,.36),(s*.295,1.145,.389),.007,metal)
box('Throttle',( .17,1.156,.37),(.035,.032,.05),dark)
box('Handlebar display',(0,1.184,.33),(.085,.022,.060),rubber)
box('Display glass',(0,1.197,.33),(.061,.004,.037),green,.003)
tube('Brake cable',[xyz(p) for p in [(-.16,1.16,.37),(-.075,1.10,.44),(-.055,.62,.46),(-.055,.34,.46)]],.0035,rubber,res=1)
rod('Kickstand',( .07,.12,-.18),(.07,.072,-.34),.009,dark)
export('SW_Scooter_01');render('SW_Scooter_01',target=(0,.63,0))

reset();bpy.ops.import_scene.gltf(filepath=str(PACK/'exports/glb/DS_Cyclist_01/DS_Cyclist_01_LOD1.glb'))
arm=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE');arm.animation_data_clear()
for b in arm.pose.bones:b.matrix_basis=Matrix.Identity(4)
for o in list(bpy.context.scene.objects):
 if o.type=='MESH' and not any(m.type=='ARMATURE' for m in o.modifiers):bpy.data.objects.remove(o,do_unlink=True)
bpy.context.view_layer.update()
shirt=mat('Detroit charcoal cotton',(.013,.014,.013),0,.96);front=shirt.copy();front.name='Higgsfield Detroit embroidery';bs=front.node_tree.nodes.get('Principled BSDF');tex=front.node_tree.nodes.new('ShaderNodeTexImage');tex.image=bpy.data.images.load(str(OUT/'detroit-shirt-basecolor.png'));front.node_tree.links.new(tex.outputs['Color'],bs.inputs['Base Color'])
skin=mat('Bare arms',(.54,.36,.245),0,.79)
for o in [o for o in bpy.context.scene.objects if o.type=='MESH']:
 o.name='SW_Detroit_Tee_Rider_Surface';me=o.data;slots=len(me.materials);me.materials.append(shirt);me.materials.append(front);me.materials.append(skin)
 # Cut actual topology at the garment edges so material transitions cannot form saw teeth.
 bm=bmesh.new();bm.from_mesh(me);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.00002)
 for height in [.935,1.025,1.49,1.565]:
  bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),dist=.00001,plane_co=o.matrix_world.inverted()@Vector((0,0,height)),plane_no=(0,0,1))
 for side,sign in [('Left',1),('Right',-1)]:
  a=arm.matrix_world@arm.data.bones[side+'Arm'].head_local;b=arm.matrix_world@arm.data.bones[side+'ForeArm'].head_local
  faces=[f for f in bm.faces if all((o.matrix_world@v.co).x*sign>.18 and (o.matrix_world@v.co).z>1.0 for v in f.verts)]
  edges=set(e for f in faces for e in f.edges);verts=set(v for f in faces for v in f.verts)
  bmesh.ops.bisect_plane(bm,geom=list(verts)+list(edges)+faces,dist=.00001,plane_co=o.matrix_world.inverted()@(a+(b-a)*.54),plane_no=(b-a).normalized())
 bm.to_mesh(me);bm.free()
 originals=[o.matrix_world@v.co for v in me.vertices];regions=[]
 for v,p in zip(me.vertices,originals):
  side='Left' if p.x>0 else 'Right';a=arm.matrix_world@arm.data.bones[side+'Arm'].head_local;b=arm.matrix_world@arm.data.bones[side+'ForeArm'].head_local;c=arm.matrix_world@arm.data.bones[side+'Hand'].head_local
  ab=b-a;t=(p-a).dot(ab)/ab.length_squared;bc=c-b;u=(p-b).dot(bc)/bc.length_squared
  region='original'
  if abs(p.x)>.19 and p.z>1.025 and p.z<1.43:
   region='skin' if t>.54 else 'shirt'
   if region=='skin':
    axisPoint=a+ab*max(0,min(1,t)) if t<1 else b+bc*max(0,min(1,u));radial=p-axisPoint
    radius=.054-.015*max(0,min(1,t)) if t<1 else .035-.011*max(0,min(1,u))+.006*math.sin(max(0,min(1,u))*math.pi)
    if radial.length>0:radial*=radius/radial.length
    p=axisPoint+radial;v.co=o.matrix_world.inverted()@p
  elif .935<p.z<1.49:region='shirt'
  elif 1.49<=p.z<1.565 and abs(p.x)<.15:
   region='skin';v.co.x*=.72
  regions.append(region)
 uv=me.uv_layers.active
 for f in me.polygons:
  p=sum((originals[i] for i in f.vertices),Vector())/len(f.vertices)
  side='Left' if p.x>0 else 'Right';a=arm.matrix_world@arm.data.bones[side+'Arm'].head_local;b=arm.matrix_world@arm.data.bones[side+'ForeArm'].head_local;t=(p-a).dot(b-a)/(b-a).length_squared
  region=('skin' if t>.54 else 'shirt') if abs(p.x)>.19 and 1.025<p.z<1.43 else 'shirt' if .935<p.z<1.49 else 'skin' if 1.49<=p.z<1.565 and abs(p.x)<.15 else 'original'
  if region=='skin':f.material_index=slots+2
  elif region=='shirt':
   chest=abs(p.x)<.195 and 1.00<p.z<1.475 and p.y<.012
   f.material_index=slots+1 if chest else slots
   if chest:
    for li in f.loop_indices:
     point=originals[me.loops[li].vertex_index];uv.data[li].uv=((point.x+.24)/.48,(point.z-1.00)/.48)
 me.update()
arm.name='SW_Detroit_Tee_Rider_Rig';arm['source']='Existing supplied cyclist identity; remodelled short sleeves and bare forearms';arm['texture_job']='84262af9-fbc6-4bca-b48b-560d3cb50a5e'
export('SW_Detroit_Tee_Rider');render('SW_Detroit_Tee_Rider')
print('SCOOTER_ASSETS_COMPLETE')

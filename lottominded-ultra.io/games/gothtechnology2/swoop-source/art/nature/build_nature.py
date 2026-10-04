"""Free, reusable Blender add-on: original cherry trees, petals and American robin.
Run with Blender --background --factory-startup --python this_file.py.
No downloaded geometry, paid plug-in, or image textures are used.
"""
bl_info={'name':'Digital Static Nature Pack','author':'Digital Static','version':(1,0,0),'blender':(5,2,0),'category':'Add Mesh'}
import bpy, math, random, json
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'public'/'exports'/'nature'
ART=Path(__file__).resolve().parent

def material(name,color):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
 bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*color,1);bs.inputs['Roughness'].default_value=.78
 return m
def uv(name,loc,scale,mat,parent=None):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=12,ring_count=8,location=loc)
 o=bpy.context.object;o.name=name;o.scale=scale;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 o.data.materials.append(mat);o.parent=parent
 for p in o.data.polygons:p.use_smooth=True
 return o
def rod(name,a,b,r1,r2,mat):
 a,b=Vector(a),Vector(b);bpy.ops.mesh.primitive_cone_add(vertices=8,radius1=r1,radius2=r2,depth=(b-a).length,location=(a+b)/2)
 o=bpy.context.object;o.name=name;o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler();o.data.materials.append(mat)
 return o
def export(name,objects):
 bpy.ops.object.select_all(action='DESELECT')
 for o in objects:o.select_set(True)
 bpy.context.view_layer.objects.active=objects[0]
 bpy.ops.export_scene.gltf(filepath=str(OUT/(name+'.glb')),export_format='GLB',use_selection=True,export_animations=True,export_yup=True)
def consolidate(objects):
 # One mesh per material, preserving the wing pivots as separate groups.
 names=[o.name for o in objects];buckets={}
 for o in objects:
  if o.type=='MESH':buckets.setdefault((o.parent.name if o.parent else '',o.data.materials[0].name),[]).append(o)
 for group in buckets.values():
  bpy.ops.object.select_all(action='DESELECT')
  for o in group:o.select_set(True)
  bpy.context.view_layer.objects.active=group[0]
  if len(group)>1:bpy.ops.object.join()
 return [bpy.data.objects[name] for name in names if name in bpy.data.objects]

class DS_OT_nature_pack(bpy.types.Operator):
 bl_idname='mesh.digital_static_nature_pack';bl_label='Build Digital Static nature pack'
 def execute(self,context):
  OUT.mkdir(parents=True,exist_ok=True);random.seed(313)
  bark=material('Cherry bark',(.20,.095,.06));pink=material('Blossom rose',(.91,.45,.60));light=material('Blossom ivory pink',(1,.78,.84));leaf=material('Spring leaves',(.22,.38,.12))
  # Individual curved five-petal flowers, instanced with native Geometry Nodes.
  flower=[]
  for i in range(5):
   a=i*math.tau/5
   vertices=[(.006,0,0),(.025,-.018,.004),(.056,-.012,.01),(.064,0,.012),(.056,.012,.01),(.025,.018,.004)]
   mesh=bpy.data.meshes.new('Curved petal');mesh.from_pydata(vertices,[],[(0,j,j+1) for j in range(1,5)])
   petal=bpy.data.objects.new('Petal',mesh);context.collection.objects.link(petal);mesh.materials.append(light)
   petal.rotation_euler.z=a;flower.append(petal)
  mesh=bpy.data.meshes.new('Flower heart');mesh.from_pydata([(0,0,.012)]+[(.01*math.cos(i*math.tau/6),.01*math.sin(i*math.tau/6),.005) for i in range(6)],[],[(0,i+1,(i+1)%6+1) for i in range(6)])
  heart=bpy.data.objects.new('Flower heart',mesh);context.collection.objects.link(heart);mesh.materials.append(pink);flower.append(heart)
  blossom=consolidate(flower)[0];blossom.name='Cherry blossom prototype'
  # Join all petals including heart into one prototype with material slots.
  bpy.ops.object.select_all(action='DESELECT')
  for o in list(bpy.data.objects):
   if o.name.startswith('Petal') or o.name.startswith('Flower heart') or o==blossom:o.select_set(True)
  bpy.context.view_layer.objects.active=blossom;bpy.ops.object.join()
  blossom.hide_render=True
  for variant in range(2):
   before=set(bpy.data.objects);tips=[]
   rod('Cherry trunk',(0,0,0),(.14,-.05,2.3),.19,.105,bark)
   for i in range(7):
    a=i*math.tau/7+.25*variant;base=Vector((.09,-.04,1.25+i*.15));end=Vector((math.cos(a)*(1.4+.22*(i%2)),math.sin(a)*1.45,3.2+.2*(i%3)))
    middle=base.lerp(end,.55)+Vector((0,0,.28));rod('Main bough',base,middle,.085,.035,bark);rod('Branch',middle,end,.036,.01,bark)
    for j in range(5):
     t=.38+j*.14;fork=base.lerp(end,t)+Vector((0,0,.1));tip=fork+Vector((math.cos(a+j*.8)*.65,math.sin(a+j*.8)*.65,.35+.1*(j%2)))
     rod('Flower twig',fork,tip,.024,.004,bark)
     for k in range(25):
      # Open canopy; twig structure remains visible through blossom clusters.
      u=random.random();p=fork.lerp(tip,u)+Vector((random.uniform(-.21,.21),random.uniform(-.21,.21),random.uniform(-.16,.20)))
      tips.append(tuple(p))
     for k in range(2):
      p=fork.lerp(tip,.55+k*.3);o=uv('Cherry leaf',p,(.04,.11,.015),leaf);o.rotation_euler=(.4,random.random(),a)
   mesh=bpy.data.meshes.new('Blossom distribution');mesh.from_pydata(tips,[],[]);points=bpy.data.objects.new('Geometry Nodes blossom canopy',mesh);context.collection.objects.link(points)
   mod=points.modifiers.new('Blossoms / free Geometry Nodes','NODES');ng=bpy.data.node_groups.new('Cherry blossom scatter','GeometryNodeTree');mod.node_group=ng
   ng.interface.new_socket(name='Geometry',in_out='INPUT',socket_type='NodeSocketGeometry');ng.interface.new_socket(name='Geometry',in_out='OUTPUT',socket_type='NodeSocketGeometry')
   inp=ng.nodes.new('NodeGroupInput');out=ng.nodes.new('NodeGroupOutput');obj=ng.nodes.new('GeometryNodeObjectInfo');obj.inputs['Object'].default_value=blossom;obj.inputs['As Instance'].default_value=True
   inst=ng.nodes.new('GeometryNodeInstanceOnPoints');rand=ng.nodes.new('FunctionNodeRandomValue');rand.data_type='FLOAT_VECTOR';rand.inputs['Min'].default_value=(-1,-1,-math.pi);rand.inputs['Max'].default_value=(1,1,math.pi)
   realize=ng.nodes.new('GeometryNodeRealizeInstances')
   ng.links.new(inp.outputs['Geometry'],inst.inputs['Points']);ng.links.new(obj.outputs['Geometry'],inst.inputs['Instance']);ng.links.new(rand.outputs['Value'],inst.inputs['Rotation']);ng.links.new(inst.outputs['Instances'],realize.inputs['Geometry']);ng.links.new(realize.outputs['Geometry'],out.inputs['Geometry'])
   context.view_layer.objects.active=points;points.select_set(True)
   bpy.ops.object.modifier_apply(modifier=mod.name)
   objects=consolidate([o for o in bpy.data.objects if o not in before]);export('cherry-blossom-'+str(variant+1),objects)
   # Spread source variants apart in the editable file after exporting at origin.
   for o in objects:o.location.x+=variant*5
  blossom.hide_render=False;blossom.hide_set(True)
  # American robin: reddish breast, grey-brown back, white eye rings, yellow beak.
  before=set(bpy.data.objects)
  brown=material('Robin back',(.18,.14,.11));breast=material('Robin breast',(.65,.20,.055));white=material('Robin eye ring',(.90,.88,.78));black=material('Robin pupil',(.012,.014,.014));beak=material('Robin beak',(.77,.52,.10))
  root=bpy.data.objects.new('Robin',None);context.collection.objects.link(root)
  uv('Body',(0,0,.11),(.05,.09,.063),brown,root);uv('Breast',(0,-.029,.10),(.045,.06,.052),breast,root);uv('Head',(0,-.076,.18),(.043,.042,.042),brown,root)
  rod('Beak',(0,-.112,.177),(0,-.147,.175),.012,0,beak).parent=root
  for side in [-1,1]:
   uv('Eye ring',(side*.038,-.092,.19),(.004,.012,.012),white,root);uv('Eye',(side*.041,-.095,.19),(.004,.007,.007),black,root)
   rod('Leg',(side*.023,0,.076),(side*.023,0,.013),.003,.002,beak).parent=root
   for toe in [-1,0,1]:rod('Toe',(side*.023,0,.014),(side*.023+toe*.008,-.022,.007),.002,.001,beak).parent=root
   wing=bpy.data.objects.new('WingLeft' if side<0 else 'WingRight',None);context.collection.objects.link(wing);wing.parent=root;wing.location=(side*.043,0,.14)
   for k in range(7):
    feather=uv('Flight feather',(side*(.018+k*.016),.025+k*.004,-.005-k*.005),(.016,.064-k*.004,.004),brown,wing);feather.rotation_euler.z=side*.18
   for frame,a in [(0,.12),(5,.75),(10,-.75),(15,.12)]:
    wing.rotation_euler.y=side*a;wing.keyframe_insert(data_path='rotation_euler',frame=frame,group='Wing flap')
   wing.animation_data.action.name='Robin_Flap_'+str(side)
  for k in range(5):uv('Tail feather',((k-2)*.01,.13,.095),(.009,.057,.004),brown,root)
  birds=consolidate([o for o in bpy.data.objects if o not in before]);export('american-robin',birds)
  root.location.x=10
  # One thin curved petal, reused with InstancedMesh in both runtimes.
  bpy.ops.mesh.primitive_uv_sphere_add(segments=8,ring_count=4);petal=bpy.context.object;petal.name='Falling cherry petal';petal.scale=(.025,.04,.003);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);petal.data.materials.append(light);export('cherry-petal',[petal]);petal.location.x=11
  context.scene.unit_settings.system='METRIC';context.scene.unit_settings.scale_length=1
  bpy.ops.wm.save_as_mainfile(filepath=str(ART/'Digital_Static_Nature.blend'))
  (OUT/'manifest.json').write_text(json.dumps({'version':1,'author':'Digital Static','license':'Original project assets; no third-party meshes or textures','tools':['Blender 5.2','Geometry Nodes','Digital Static Nature Pack add-on'],'trees':['cherry-blossom-1.glb','cherry-blossom-2.glb'],'bird':'american-robin.glb','petal':'cherry-petal.glb'},indent=2))
  return {'FINISHED'}
def register():bpy.utils.register_class(DS_OT_nature_pack)
def unregister():bpy.utils.unregister_class(DS_OT_nature_pack)
if __name__=='__main__':
 bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False);register();bpy.ops.mesh.digital_static_nature_pack()

"""Reference-based, rigged visitors. User photos are projected onto 3D faces;
the existing Digital Static rigs stay intact. Props remain editable in Blender.
These are likeness adaptations, not scanned bodies or generated video sprites.
"""
import bpy,math,json,random
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parent.parent
OUT=ROOT/'art'/'visitors';OUT.mkdir(parents=True,exist_ok=True)
BASE=Path(r'C:\Users\digit\Documents\phone\Digital_Static_Street_Asset_Pack\exports\glb')
PHOTO=Path(r'C:\Users\digit\Downloads\hf_20260808_161025_5392b51f-29ab-4f8c-af3c-9a6fd429a6b7.png')
BLUE=Path(r'C:\Users\digit\Downloads\73fa03c2-5e0d-460d-b108-571d1903a627.png')
SPECS=[
 {'id':'detroit-photographer','base':'Man','face':[310,128,429,251],'skin':(.32,.19,.11),'hair':'cap','prop':'camera'},
 {'id':'detroit-blonde-shopper','base':'Woman','face':[544,197,678,331],'skin':(.67,.46,.32),'hair':'blonde','prop':'bag'},
 {'id':'detroit-bob-shopper','base':'Woman','face':[738,233,865,359],'skin':(.55,.34,.20),'hair':'bob','prop':'sling'},
 {'id':'detroit-cap-shopper','base':'Man','face':[942,147,1069,275],'skin':(.59,.38,.23),'hair':'cap','prop':'charm'},
 {'id':'gallery-blue-visitor','base':'Woman','face':[660,214,1165,735],'skin':(.32,.17,.095),'hair':'curls','prop':'phone','blue':True},
]
bpy.ops.wm.read_factory_settings(use_empty=True)
random.seed(2084)
def mat(name,color,metal=0,rough=.6):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
 n=m.node_tree.nodes.get('Principled BSDF');n.inputs['Base Color'].default_value=(*color,1);n.inputs['Metallic'].default_value=metal;n.inputs['Roughness'].default_value=rough
 return m
black=mat('Soft black retail cotton',(.022,.025,.026));navy=mat('Navy embroidered cap',(.032,.047,.077));gold=mat('Brushed gold jewelry',(.58,.37,.12),.8,.28)
green=mat('Forest green sling bag leather',(.022,.11,.067),0,.42);paper=mat('GothTech kraft shopping bag',(.38,.25,.12));steel=mat('Camera lens black alloy',(.017,.022,.025),.6,.25);glass=mat('Camera lens glass',(.036,.14,.19),.65,.12)
blue=mat('Royal blue ruched dress',(.015,.055,.35),0,.62);blond=mat('Blonde layered hair',(.36,.24,.11),0,.68);darkhair=mat('Dark brown hair',(.035,.022,.018),0,.65)
def photo_material(spec):
 src=bpy.data.images.load(str(BLUE if spec.get('blue') else PHOTO),check_existing=True)
 x0,y0,x1,y1=spec['face'];w,h=src.size;pix=list(src.pixels);pixels=[]
 size=384
 for y in range(size):
  sy=max(0,min(h-1,h-1-int(y1-(y+.5)*(y1-y0)/size)))
  for x in range(size):
   sx=max(0,min(w-1,int(x0+(x+.5)*(x1-x0)/size)));pixels.extend(pix[(sy*w+sx)*4:(sy*w+sx)*4+4])
 img=bpy.data.images.new(spec['id']+' supplied face projection',width=size,height=size);img.pixels=pixels;img.pack()
 m=mat(spec['id']+' photographic skin',(1,1,1),0,.82);n=m.node_tree.nodes.new('ShaderNodeTexImage');n.image=img;m.node_tree.links.new(n.outputs['Color'],m.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
 return m
def sphere(name,loc,scale,material,segments=20,rings=12):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=segments,ring_count=rings,location=loc);o=bpy.context.object;o.name=name;o.scale=scale
 bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(material)
 for p in o.data.polygons:p.use_smooth=True
 return o
def box(name,loc,scale,material,bevel=.006):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.name=name;o.scale=scale;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(material)
 if bevel:
  mod=o.modifiers.new('Rounded manufactured edges','BEVEL');mod.width=bevel;mod.segments=2;bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
 return o
def rod(name,a,b,r,material,vertices=12):
 a,b=Vector(a),Vector(b);d=b-a;bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=r,depth=d.length,location=(a+b)/2);o=bpy.context.object;o.name=name;o.rotation_mode='QUATERNION';o.rotation_quaternion=d.to_track_quat('Z','Y');o.data.materials.append(material);return o
def bind(o,arm,bone):
 bpy.context.view_layer.objects.active=o;bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
 g=o.vertex_groups.new(name=bone);g.add(list(range(len(o.data.vertices))),1,'REPLACE');mod=o.modifiers.new('Rigid prop skin binding','ARMATURE');mod.object=arm;o.parent=arm
def prop_root(name,loc):
 o=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(o);o.location=loc;return o
def prop_mesh(o,group):o.parent=group
def torus(name,loc,major,minor,material,rot=(0,0,0)):
 bpy.ops.mesh.primitive_torus_add(major_segments=24,minor_segments=6,location=loc,major_radius=major,minor_radius=minor,rotation=rot);o=bpy.context.object;o.name=name;o.data.materials.append(material);return o
def text(name,value,loc,size,material):
 bpy.ops.object.select_all(action='DESELECT')
 c=bpy.data.curves.new(name,'FONT');c.body=value;c.size=size;c.align_x='CENTER';c.extrude=.0004;o=bpy.data.objects.new(name,c);bpy.context.collection.objects.link(o);o.location=loc;o.rotation_euler=(math.pi/2,0,0);o.data.materials.append(material);bpy.context.view_layer.objects.active=o;o.select_set(True);bpy.ops.object.convert(target='MESH');o.select_set(False);return o
all_sets=[];reports=[]
for spec in SPECS:
 before=set(bpy.context.scene.objects);base='DS_Hoodie_'+spec['base']+'_01';bpy.ops.import_scene.gltf(filepath=str(BASE/base/(base+'_LOD1.glb')))
 objects=set(bpy.context.scene.objects)-before;arm=next(o for o in objects if o.type=='ARMATURE');body=max((o for o in objects if o.type=='MESH'),key=lambda o:len(o.data.vertices));arm.name=spec['id']+'_Rig';body.name=spec['id']+'_Body'
 for o in objects:
  if o.type=='MESH' and o!=body and not o.vertex_groups:bpy.data.objects.remove(o,do_unlink=True)
 arm.animation_data_clear();arm['source_photos']=str(BLUE if spec.get('blue') else PHOTO);arm['likeness']='User supplied photographic face projection with modeled reference clothing and hair'
 head=arm.data.bones['Head'].head_local.z;face=photo_material(spec);skin=mat(spec['id']+' matched skin',spec['skin'])
 face_index=len(body.data.materials);body.data.materials.append(face);skin_index=len(body.data.materials);body.data.materials.append(skin);blue_index=len(body.data.materials);body.data.materials.append(blue)
 uv=body.data.uv_layers.active.data
 face_low=head-.075;face_high=head+.115
 for p in body.data.polygons:
  centre=sum((body.data.vertices[i].co for i in p.vertices),Vector())/len(p.vertices)
  # Front skin patch is projected in object space, then deformed by the real rig.
  if face_low<centre.z<face_high and centre.y<-.025 and abs(centre.x)<.102:
   p.material_index=face_index
   for li in p.loop_indices:
    co=body.data.vertices[body.data.loops[li].vertex_index].co;uv[li].uv=((co.x+.108)/.216,(co.z-face_low)/(face_high-face_low))
  elif centre.z>face_low and centre.z<head+.11 and centre.y<-.005:p.material_index=skin_index
  elif centre.z<1.0 and centre.z>.68 and abs(centre.x)>.285:p.material_index=skin_index
  elif spec.get('blue') and .70<centre.z<head-.065:p.material_index=blue_index
 if spec.get('blue'):
  # Widen hips and taper the photographed dress silhouette without changing the rig.
  for v in body.data.vertices:
   if .85<v.co.z<1.35 and abs(v.co.x)<.27:v.co.x*=1.14;v.co.y*=1.08
  vertices=[];faces=[]
  for j in range(7):
   z=.52+j*.061;r=.245-.022*j/6
   for i in range(40):
    a=i*math.tau/40;vertices.append((r*math.cos(a),r*.65*math.sin(a),z))
  for j in range(6):
   for i in range(40):faces.append((j*40+i,j*40+(i+1)%40,(j+1)*40+(i+1)%40,(j+1)*40+i))
  me=bpy.data.meshes.new('Fitted royal blue skirt');me.from_pydata(vertices,[],faces);me.update();o=bpy.data.objects.new('Royal blue dress hem',me);bpy.context.collection.objects.link(o);o.data.materials.append(blue);bind(o,arm,'Hips')
  for p in me.polygons:p.use_smooth=True
 body.data.update();bpy.context.view_layer.update()
 # Reference hair in layered volumes, weighted to Head.
 hair_objects=[]
 if spec['hair']=='cap':
  hair_objects.append(sphere('Navy six panel cap crown',(0,.025,head+.139),(.119,.127,.062),navy))
  hair_objects.append(sphere('Navy curved cap visor',(0,-.113,head+.112),(.13,.092,.011),navy))
  hair_objects.append(sphere('Cap top button',(0,.025,head+.20),(.01,.01,.006),navy,12,6))
  hair_objects.append(text('Cap embroidered Detroit','DETROIT',(0,-.104,head+.152),.020,gold))
 elif spec['hair'] in ['blonde','bob']:
  m=blond if spec['hair']=='blonde' else darkhair
  # Open front preserves the projected face and modeled forehead.
  for i in range(17):
   a=1.05+i*(math.tau-2.10)/16;x=math.sin(a)*.102;y=.025-math.cos(a)*.092
   hair_objects.append(sphere('Layered bob hair', (x,y,head+.041),(.022,.025,.100 if spec['hair']=='bob' else .105),m,16,10))
  hair_objects.append(sphere('Bob crown volume',(0,.031,head+.146),(.115,.099,.051),m))
 else:
  for i in range(210):
   a=random.uniform(.95,math.tau-.95);z=random.uniform(head-.24,head+.145);radius=.112+random.uniform(0,.04)
   x=math.sin(a)*radius;y=.025-math.cos(a)*radius*.85
   hair_objects.append(sphere('Curly hair lock',(x,y,z),(.019,.020,.027),darkhair,8,6))
  for x in [-.105,.105]:hair_objects.append(torus('Gold hoop earring',(x,-.032,head-.055),.024,.0022,gold,(math.pi/2,0,0)))
  for i in range(3):
   hair_objects.append(torus('Layered gold necklace',(0,-.075,head-.18-i*.035),.058+i*.01,.0018,gold,(math.pi/2,0,0)))
 for o in hair_objects:bind(o,arm,'Head' if 'necklace' not in o.name else 'Spine')
 prop=spec['prop']
 if prop=='camera':
  g=prop_root('Visitor_Camera',(0,-.245,1.23));prop_mesh(box('Camera DSLR body',(0,0,0),(.145,.061,.093),black),g)
  prop_mesh(box('Camera grip',(-.068,-.002,-.006),(.036,.075,.092),black),g)
  prop_mesh(rod('Camera lens barrel',(0,-.023,0),(0,-.117,0),.034,steel,24),g)
  prop_mesh(rod('Camera lens front',(0,-.117,0),(0,-.121,0),.029,glass,24),g)
  prop_mesh(box('Camera hot shoe prism',(0,.0,.057),(.055,.04,.03),black),g)
  for x in [-.081,.081]:bind(rod('Camera neck strap',(x,-.075,1.50),(x*.65,-.24,1.245),.008,black),arm,'Spine')
 elif prop=='sling':
  bind(sphere('Green leather sling bag',(-.145,-.192,1.13),(.126,.064,.20),green),arm,'Spine02')
  bind(rod('Green sling cross body strap',(.19,-.065,1.40),(-.17,-.13,1.03),.022,green),arm,'Spine')
  bind(rod('Sling bag brass zipper',(-.18,-.247,1.15),(-.09,-.247,1.25),.002,gold),arm,'Spine02')
  bind(text('Sling embroidered city','DETROIT',(-.145,-.255,1.09),.025,gold),arm,'Spine02')
  bind(torus('Sling collectible charm ring',(-.065,-.242,1.0),.015,.002,gold,(math.pi/2,0,0)),arm,'Spine02')
 elif prop=='charm':
  g=prop_root('Visitor_Charm',(-.36,-.10,.86));prop_mesh(box('Retail charm package',(0,0,0),(.11,.018,.18),navy),g)
  prop_mesh(torus('Charm package keyring',(0,-.018,.04),.018,.003,gold,(math.pi/2,0,0)),g)
  prop_mesh(sphere('Purple mascot key charm',(0,-.03,-.028),(.025,.016,.035),mat('Charm purple enamel',(.24,.055,.35)),12,8),g)
 elif prop=='phone':
  g=prop_root('Visitor_Phone',(-.365,-.07,.91));prop_mesh(box('Photo phone body',(0,0,0),(.067,.009,.134),black,.004),g);prop_mesh(box('Phone camera glass',(0,-.005,0),(.057,.002,.119),glass,.002),g)
 # All shoppers carry a modeled bag; handles and seams are visible at close range.
 if prop in ['bag','sling','phone']:
  g=prop_root('Visitor_Bag',(-.36,-.02,.66));prop_mesh(box('GothTech shopping bag',(0,0,-.055),(.23,.115,.28),paper,.004),g)
  for y in [-.048,.048]:
   for x in [-.067,.067]:prop_mesh(rod('Bag rope handle',(x,y,.08),(x,y,.17),.004,black),g)
   prop_mesh(rod('Bag rope handle top',(-.067,y,.17),(.067,y,.17),.004,black),g)
  prop_mesh(text('Bag printed GothTech','GOTHTECH',(0,-.058,-.035),.026,black),g)
 created=set(bpy.context.scene.objects)-before
 # Batch rigid hair parts per material; keep armature weights and named props.
 for material in [navy,gold,blond,darkhair]:
  created=set(bpy.context.scene.objects)-before
  parts=[o for o in created if o.type=='MESH' and o.parent==arm and o!=body and o.data.materials and o.data.materials[0]==material]
  if len(parts)>1:
   bpy.ops.object.select_all(action='DESELECT')
   for o in parts:o.select_set(True)
   bpy.context.view_layer.objects.active=parts[0];bpy.ops.object.join()
 created=set(bpy.context.scene.objects)-before
 bpy.ops.object.select_all(action='DESELECT')
 for o in created:o.select_set(True)
 bpy.context.view_layer.objects.active=arm
 for o in created:
  if o.type=='MESH':o.data.update()
 bpy.context.view_layer.update()
 bpy.ops.export_scene.gltf(filepath=str(OUT/(spec['id']+'-authoring.glb')),export_format='GLB',use_selection=True,export_animations=False,export_yup=True)
 count=sum(len(o.data.polygons) for o in created if o.type=='MESH');reports.append({'id':spec['id'],'reference':str(BLUE if spec.get('blue') else PHOTO),'baseRig':base,'bones':len(arm.data.bones),'polygons':count,'prop':prop})
 all_sets.append((spec,created))
 # Move the editable reference lineup after the runtime export.
 for o in created:
  if o.parent not in created:o.location.x+=(len(all_sets)-3)*1.05
floor=box('Visitor lineup floor',(0,0,-.035),(7,4,.06),mat('Lineup warm grey',(.28,.29,.27)))
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=32
scene.world=bpy.data.worlds.new('Visitor preview environment')
scene.world.color=(.22,.22,.22)
for loc,energy,size in [((1,-4,5),850,5),((-4,1,4),650,4)]:
 bpy.ops.object.light_add(type='AREA',location=loc);light=bpy.context.object;light.data.energy=energy;light.data.shape='DISK';light.data.size=size;light.rotation_euler=(Vector((0,0,1))-light.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(3.5,-8,3.0));camera=bpy.context.object;camera.rotation_euler=(Vector((0,0,1))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=6.9;scene.camera=camera
scene.render.resolution_x=1600;scene.render.resolution_y=900;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG';scene.render.filepath=str(OUT/'visitor-reference-lineup.png')
bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'GothTech_Reference_Visitors.blend'))
(OUT/'visitor-authoring-report.json').write_text(json.dumps(reports,indent=2));print('REFERENCE_VISITORS',json.dumps(reports));bpy.ops.render.render(write_still=True)

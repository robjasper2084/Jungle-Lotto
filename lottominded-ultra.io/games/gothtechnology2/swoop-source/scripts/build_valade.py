"""Original Valade reconstruction; mapped foundations, estimated facade/fittings.
No reference photography is redistributed. Editable Blender masters and FBX.
"""
import bpy,math,json
from pathlib import Path
from mathutils import Vector
root=Path(__file__).resolve().parents[1];art=root/'art/valade';out=root/'public/exports/valade';out.mkdir(parents=True,exist_ok=True)
site=json.loads((root/'src/detroit/valade-data.json').read_text())
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
def mat(n,c,metal=0,rough=.55):
 m=bpy.data.materials.new(n);m.diffuse_color=(*c,1);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*c,1);p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough;return m
white=mat('Valade white metal',(.78,.80,.77),.38,.45);iron=mat('Valade dark steel',(.045,.065,.065),.7,.32);wood=mat('Valade weathered wood',(.40,.29,.16),0,.8);glass=mat('Valade glazing',(.07,.20,.24),.55,.17);lime=mat('Play tower green',(.44,.65,.045),.12,.48);yellow=mat('Play tower yellow',(.90,.61,.035),.12,.48);rope=mat('Play rope',(.30,.24,.15),0,.85);teal=mat('Barge teal canopy',(.025,.40,.42),0,.82);red=mat('Park chair red',(.56,.025,.04),.1,.45)
def box(n,p,size,m,bevel=.008):
 bpy.ops.mesh.primitive_cube_add(size=1,location=p);o=bpy.context.object;o.name=n;o.scale=size;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(m)
 if bevel:q=o.modifiers.new('Edge bevel','BEVEL');q.width=bevel;q.segments=2;bpy.ops.object.modifier_apply(modifier=q.name)
 return o
def tube(n,a,b,r,m,verts=12):
 a,b=Vector(a),Vector(b);v=b-a;bpy.ops.mesh.primitive_cylinder_add(vertices=verts,radius=r,depth=v.length,location=(a+b)/2);o=bpy.context.object;o.name=n;o.rotation_euler=v.to_track_quat('Z','Y').to_euler();o.data.materials.append(m)
 for f in o.data.polygons:f.use_smooth=len(f.vertices)==4
 return o
def panel(n,vertices,m):
 mesh=bpy.data.meshes.new(n);mesh.from_pydata(vertices,[],[list(range(len(vertices)))]);mesh.materials.append(m);o=bpy.data.objects.new(n,mesh);bpy.context.collection.objects.link(o);s=o.modifiers.new('Metal sheet thickness','SOLIDIFY');s.thickness=.06;bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=s.name);return o
def text(n,value,p,size,m,rotation=(math.pi/2,0,0)):
 bpy.ops.object.text_add(location=p,rotation=rotation);o=bpy.context.object;o.name=n;o.data.body=value;o.data.size=size;o.data.align_x='CENTER';o.data.extrude=.003;o.data.materials.append(m);bpy.ops.object.convert(target='MESH')
def save(n):
 bpy.ops.wm.save_as_mainfile(filepath=str(art/(n+'.blend')));bpy.ops.export_scene.fbx(filepath=str(art/(n+'.fbx')),axis_forward='-Z',axis_up='Y',add_leaf_bones=False)
 for m in list(bpy.data.materials):
  parts=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.data.materials and o.data.materials[0]==m]
  if len(parts)<2:continue
  bpy.ops.object.select_all(action='DESELECT')
  for o in parts:o.select_set(True)
  bpy.context.view_layer.objects.active=parts[0];bpy.ops.object.join()
 bpy.ops.export_scene.gltf(filepath=str(out/(n+'.glb')),export_format='GLB',export_yup=True);print('VALADE_ASSET',n)
 bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)

# Shed envelope follows OSM 777936143; covered pavilion is open, never a solid block.
cx,cz=site['shed']['x'],site['shed']['z']
points=[(p[0]-cx,-(p[1]-cz)) for p in site['buildings'][0]['points']]
for i,(a,b) in enumerate(zip(points,points[1:])):
 dx,dy=b[0]-a[0],b[1]-a[1];length=math.hypot(dx,dy);mx,my=(a[0]+b[0])/2,(a[1]+b[1])/2;ang=math.atan2(dy,dx)
 wall=box('Shed mapped wall',(mx,my,1.78),(length,.12,3.3),white);wall.rotation_euler.z=ang
 for d in range(1,int(length),3):
  t=d/length;x=a[0]+dx*t;y=a[1]+dy*t
  frame=box('Shed window frame',(x,y,1.8),(2.05,.17,1.90),iron);frame.rotation_euler.z=ang
  pane=box('Shed glazing',(x,y,1.8),(1.90,.19,1.74),glass);pane.rotation_euler.z=ang
  mull=box('Window mullion',(x,y,1.8),(.055,.20,1.8),white);mull.rotation_euler.z=ang
  for h in [.52,3.27]:
   trim=box('Shed horizontal trim',(x,y,h),(2.8,.18,.07),iron);trim.rotation_euler.z=ang
box('Shed lower foundation',(-1.4,8,.10),(10,.12,.2),iron)
# White standing-seam gable roof over closed service volume and open terrace.
for side in [-1,1]:
 panel('Shed gable roof',[(side*8,-25,3.5),(0,-25,5.8),(0,22,5.8),(side*8,22,3.5)],white)
 for y in range(-25,23):tube('Standing roof seam',(side*8,y,3.53),(0,y,5.83),.017,iron,6)
for y in [-24,-14,-4,6,16,21]:
 for x in [-7.4,7.4]:
  tube('Covered terrace post',(x,y,.13),(x,y,3.5),.07,iron)
  tube('Terrace diagonal brace',(x,y,2.9),(x*.70,y,4.08),.045,iron)
text('Shed fascia','THE SHED',(0,22.04,3.67),.53,iron,(math.pi/2,0,math.pi))
save('valade-shed')

# Two reference-colored towers with portholes, timber stilts and a sagging rope bridge.
for x,m in [(-3.1,lime),(3.1,yellow)]:
 for px in [x-.95,x+.95]:
  for y in [-.95,.95]:tube('Timber tower stilt',(px,y,0),(px,y,4.9),.085,wood)
 box('Tower platform',(x,0,2.05),(2.2,2.2,.16),wood)
 for y in [-1,1]:
  wall=box('Colored tower siding',(x,y,3.05),(2.05,.08,1.95),m)
  # Actual opening, rather than a painted black disc.
  bpy.ops.mesh.primitive_cylinder_add(vertices=24,radius=.43,depth=.4,location=(x,y,3.10),rotation=(math.pi/2,0,0));cut=bpy.context.object;bpy.context.view_layer.objects.active=wall;bo=wall.modifiers.new('Round play window','BOOLEAN');bo.operation='DIFFERENCE';bo.object=cut;bpy.ops.object.modifier_apply(modifier=bo.name);bpy.data.objects.remove(cut,do_unlink=True)
  bpy.ops.mesh.primitive_torus_add(major_radius=.44,minor_radius=.028,major_segments=24,minor_segments=8,location=(x,y*1.045,3.10),rotation=(math.pi/2,0,0));bpy.context.object.data.materials.append(iron)
 for side in [-1,1]:panel('Tower pitched roof',[(x+side*1.25,-1.25,4.1),(x,-1.25,4.65),(x,1.25,4.65),(x+side*1.25,1.25,4.1)],white)
for i in range(18):
 x=-2.0+i*4/17;h=2.02-.35*math.sin((x+2)/4*math.pi);box('Rope bridge step',(x,0,h),(.19,1.2,.075),wood)
 for side in [-1,1]:
  nx=min(2,x+4/17);nh=2.02-.35*math.sin((nx+2)/4*math.pi)
  tube('Rope bridge handline',(x,side*.62,h+.9),(nx,side*.62,nh+.9),.025,rope,8)
  tube('Rope bridge net',(x,side*.62,h),(x,side*.62,h+.9),.014,rope,6)
for y in [-.72,0,.72]:
 tube('Climbing rope',(4.15,y,2.1),(5.9,y,.10),.025,rope,8)
for i in range(8):tube('Climbing rung',(4.15+i*.25,-.72,2.1-i*.285),(4.15+i*.25,.72,2.1-i*.285),.023,rope,8)
save('valade-play-towers')

# Barge furniture is a local ten by 36 m floating deck in the mapped footprint.
box('Floating barge hull',(0,0,-.14),(9.8,35.5,.45),iron)
for y in range(-17,18):box('Barge deck board',(0,y,.12),(9.8,.94,.12),wood)
box('Barge café trailer',(-2,8,1.75),(2.8,6,2.8),white,.08)
box('Barge café serving hatch',(-.56,8,1.91),(.08,3.1,1.25),glass)
box('Barge serving counter',(-.34,8,1.12),(.6,3.8,.12),wood)
text('Barge café sign',"BOB'S BARGE",(-.51,8,2.58),.28,iron,(math.pi/2,0,math.pi/2))
for x in [-4.65,4.65]:
 tube('Barge edge top rail',(x,-17.5,1.22),(x,17.5,1.22),.038,iron)
 for y in range(-17,18,2):tube('Barge edge rail post',(x,y,.17),(x,y,1.22),.035,iron)
for x,y in [(2,-12),(-2,-7),(2,-2),(-2,3),(2,9),(2,14)]:
 tube('Umbrella pedestal',(x,y,.2),(x,y,2.8),.035,iron)
 bpy.ops.mesh.primitive_cone_add(vertices=12,radius1=1.75,radius2=.10,depth=.38,location=(x,y,2.63));bpy.context.object.data.materials.append(teal)
 tube('Café table pedestal',(x,y,.2),(x,y,.95),.055,iron)
 bpy.ops.mesh.primitive_cylinder_add(vertices=24,radius=.75,depth=.06,location=(x,y,.97));bpy.context.object.data.materials.append(wood)
 for side in [-1,1]:
  box('Café chair seat',(x+side*1.02,y,.64),(.43,.45,.07),white)
  for yy in [y-.17,y+.17]:tube('Café chair leg',(x+side*1.02,yy,.2),(x+side*1.02,yy,.63),.025,iron)
  box('Café chair back',(x+side*1.02,y+.24,.92),(.43,.045,.53),white)
save('valade-barge')

# Adirondack beach chairs, retained as reusable masters.
for x in [-.30,.30]:
 tube('Chair forward leg',(x,-.36,0),(x,-.36,.65),.037,red)
 tube('Chair sloping back support',(x,-.20,.43),(x,.45,.98),.037,red)
 box('Chair armrest',(x,0,.65),(.14,.75,.065),red)
for x in [-.24,-.12,0,.12,.24]:
 box('Chair seat slat',(x,0,.42),(.095,.58,.045),red).rotation_euler.x=-.12
 box('Chair back slat',(x,.31,.78),(.095,.05,.68),red).rotation_euler.x=-.26
save('valade-chair')

# Outdoor musical garden, picnic and barbecue furniture.
for x in [-.65,.65]:
 tube('Musical instrument support',(x,0,0),(x,0,1.02),.055,iron)
for i in range(10):box('Garden chime bar',(-.60+i*.133,0,1.08),(.10,.32+i*.025,.07),lime if i%2 else yellow)
save('valade-musical-garden')
for x in [-.68,.68]:
 for s in [-1,1]:tube('Picnic A frame',(x,s*.75,0),(x,0,.78),.06,iron)
for y in [-.28,-.14,0,.14,.28]:box('Picnic table slat',(0,y,.78),(1.9,.115,.06),wood)
for y in [-.75,.75]:
 for yy in [-.07,.07]:box('Picnic seat slat',(0,y+yy,.44),(1.9,.115,.06),wood)
save('valade-picnic-table')
tube('BBQ pedestal',(0,0,0),(0,0,.80),.07,iron);box('BBQ firebox',(0,0,.91),(.70,.48,.26),iron)
for i in range(12):tube('BBQ cooking grate',(-.32+i*.058,-.23,1.05),(-.32+i*.058,.23,1.05),.01,white,6)
box('BBQ side shelf',(.57,0,.98),(.36,.4,.035),white);save('valade-bbq')

"""Original waterfront meshes. OSM plan anchors; elevations/detail are visual estimates.
Blender 5.2 -> glTF browser + FBX Unity review. Map photographs are references only.
"""
import bpy, math, json
from pathlib import Path
from mathutils import Vector
from mathutils.geometry import delaunay_2d_cdt
root=Path(__file__).resolve().parents[1]; art=root/'art/waterfront'; out=root/'public/exports/waterfront';out.mkdir(parents=True,exist_ok=True)
data=json.loads((root/'src/detroit/waterfront-data.json').read_text(encoding='utf-8'))
def clear():
 bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
def mat(name,c,metal=0,rough=.7):
 m=bpy.data.materials.new(name);m.diffuse_color=(*c,1);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*c,1);p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough;return m
def box(name,loc,size,m):
 x,y,z=[n/2 for n in size];o=mesh(name,[(-x,-y,-z),(x,-y,-z),(x,y,-z),(-x,y,-z),(-x,-y,z),(x,-y,z),(x,y,z),(-x,y,z)],[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],m);o.location=loc;return o
def tube(name,a,b,r,m,verts=8):
 a,b=Vector(a),Vector(b);v=b-a;bpy.ops.mesh.primitive_cylinder_add(vertices=verts,radius=r,depth=v.length,location=(a+b)/2);o=bpy.context.object;o.name=name;o.rotation_euler=v.to_track_quat('Z','Y').to_euler();o.data.materials.append(m);return o
def mesh(name,verts,faces,m):
 me=bpy.data.meshes.new(name);me.from_pydata(verts,[],faces);me.update();o=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(o);o.data.materials.append(m);return o
def text(name,words,loc,size,m,rotation=(math.pi/2,0,0)):
 bpy.ops.object.text_add(location=loc,rotation=rotation);o=bpy.context.object;o.name=name;o.data.body=words;o.data.align_x='CENTER';o.data.size=size;o.data.extrude=.018;o.data.materials.append(m);bpy.ops.object.convert(target='MESH')
def polygon(pts,x,y):
 inside=False
 for i in range(len(pts)):
  a,b=pts[i-1],pts[i]
  if (a[1]>y)!=(b[1]>y) and x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0]:inside=not inside
 return inside
def save(name):
 # Material batches keep runtime draw calls small; editable shapes remain named in .blend.
 bpy.ops.wm.save_as_mainfile(filepath=str(art/(name+'.blend')))
 bpy.ops.export_scene.fbx(filepath=str(art/(name+'.fbx')),axis_forward='-Z',axis_up='Y',use_mesh_modifiers=True,add_leaf_bones=False)
 for m in list(bpy.data.materials):
  items=[o for o in bpy.context.scene.objects if o.type=='MESH' and len(o.data.materials)==1 and o.data.materials[0]==m]
  if not items:continue
  bpy.ops.object.select_all(action='DESELECT')
  for o in items:o.select_set(True)
  bpy.context.view_layer.objects.active=items[0];bpy.ops.object.join()
 bpy.ops.export_scene.gltf(filepath=str(out/(name+'.glb')),export_format='GLB',export_yup=True)
 print('EXPORTED',name)
clear();stone=mat('Warm limestone',(.58,.52,.42));concrete=mat('Stepped concrete',(.55,.57,.52));white=mat('White tensile membrane',(.91,.93,.89),.08,.48);iron=mat('Black architectural steel',(.055,.075,.07),.6,.38);seat=mat('Teal theatre seating',(.10,.28,.27));stage=mat('Stage deck',(.10,.115,.11));silver=mat('Tension cables',(.5,.54,.53),.8,.3)
cx,cz=-211,-1625
outline=next(b['points'] for b in data['buildings'] if b['id']=='60624913')[:-1]; pts=[(p[0]-cx,-p[1]+cz) for p in outline]
boundary=[Vector(p) for p in pts];vertices=list(boundary)
for x in range(-38,39,4):
 for y in range(-48,49,4):
  if polygon(pts,x,y):vertices.append(Vector((x,y)))
v,e,f,_,_,_=delaunay_2d_cdt(vertices,[(i,(i+1)%len(pts)) for i in range(len(pts))],[tuple(range(len(pts)))],1,1e-5)
def roofheight(x,y):
 # Two masted peaks create a tensioned, scalloped tent rather than a solid prism.
 return 7.3+13.4*max(math.exp(-math.hypot((x+1)/22,(y-22)/24)*1.25),math.exp(-math.hypot((x+1)/24,(y+20)/26)*1.3))
roof=mesh('OSM 60624913 twin-peak tensile canopy',[(p.x,p.y,roofheight(p.x,p.y)) for p in v],f,white)
for p in roof.data.polygons:p.use_smooth=True
for i,(x,y) in enumerate(pts):
 nx,ny=pts[(i+1)%len(pts)];tube('Perimeter tension cable',(x,y,roofheight(x,y)),(nx,ny,roofheight(nx,ny)),.075,silver)
 if i%2==0:tube('Canopy steel support',(x,y,0),(x,y,roofheight(x,y)),.20,iron)
for y in [-20,22]:tube('Peak mast',(-1,y,0),(-1,y,21.2),.26,iron)
# Stage is on the river side; open fan of seating faces it, with clear radial aisles.
box('Waterfront stage',(-27,0,.65),(12,24,1.3),stage);box('Stage backdrop',(-33,0,3.1),(.3,24,5),iron)
for y in [-11,11]:
 box('PA speaker stack',(-27,y,3.4),(1.1,1.3,4.8),iron)
for row in range(30):
 radius=12+row*1.15;h=.08+row*.085;count=int(radius*2.2/.62)
 for n in range(count):
  a=-1.06+(n+.5)*2.12/count
  if min(abs(a-k) for k in [-.55,0,.55])<.045:continue
  x=-27+math.cos(a)*radius;y=math.sin(a)*radius
  if not polygon(pts,x,y):continue
  # Seat/back are bevelled compact solid shells, authored individually for Unity review.
  o=box('Theatre seat',(x,y,h+.48),(.47,.49,.13),seat);o.rotation_euler.z=a
  o=box('Seat back',(x+.20*math.cos(a),y+.20*math.sin(a),h+.83),(.10,.47,.6),seat);o.rotation_euler.z=a
  box('Seat pedestal',(x,y,h+.22),(.08,.10,.44),iron)
 # Shallow stepped terraces only inside the mapped plan.
 verts=[];faces=[]
 for n in range(120):
  a=-1.08+n*2.16/120;b=-1.08+(n+1)*2.16/120
  q=[(-27+math.cos(t)*r,math.sin(t)*r,h) for r,t in [(radius-.45,a),(radius+.65,a),(radius+.65,b),(radius-.45,b)]]
  if all(polygon(pts,x,y) for x,y,z in q):j=len(verts);verts+=q;faces.append((j,j+1,j+2,j+3))
 mesh('Seating terrace',verts,faces,concrete)
# Existing riverside pavilion footprint: rounded tower and attached limestone volumes.
pavilion=next(b['points'] for b in data['buildings'] if b['id']=='105519122')[:-1];local=[(p[0]-cx,-p[1]+cz) for p in pavilion]
n=len(local);me=mesh('OSM 105519122 pavilion',[(x,y,z) for z in [0,7.4] for x,y in local],[tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)],stone)
for x,y in [(-1,46),(-6,47)]:tube('Rounded pavilion tower',(x,y,0),(x,y,12.5),2.35,stone,24)
for y in [43,49]:box('Pavilion upper glazing',(-3,y,8.3),(4,.10,2),iron)
save('aretha-amphitheatre')
clear();stone=mat('Entry limestone',(.60,.54,.42));iron=mat('Entry black metal',(.06,.08,.07),.6,.42);letters=mat('Entry white lettering',(.9,.91,.85))
for x in [-5,5]:box('Entry tower',(x,0,3),(1.3,1.3,6),stone);tube('Column cap',(x,0,6),(x,0,7),.8,stone,24)
box('Entry marquee',(0,0,5.3),(11,.65,1.25),iron);text('Amphitheatre name','THE ARETHA',(0,-.34,5.08),.60,letters)
for x in [-4.1,4.1]:
 for i in range(8):box('Open gate bars',(x+i*.12*(1 if x<0 else -1),.1,1.3),(.045,1.8,2.6),iron)
save('aretha-entry')
clear();iron=mat('Powder-coated river railing',(.09,.12,.12),.62,.4)
for x in [-1.5,1.5]:tube('Rail post',(x,0,0),(x,0,1.14),.052,iron)
for z in [.19,1.1]:tube('Horizontal rail',(-1.5,0,z),(1.5,0,z),.042,iron)
for i in range(15):tube('Baluster',(-1.4+i*.2,0,.19),(-1.4+i*.2,0,1.1),.02,iron,6)
save('shore-railing')
clear();white=mat('Marine service white',(.88,.90,.86),.15,.45);steel=mat('Marine fittings',(.4,.45,.45),.8,.3);black=mat('Outlet cover',(.045,.055,.055));blue=mat('Dock utility blue',(.03,.19,.32))
box('Dock pedestal base',(0,0,.08),(.38,.38,.16),steel);box('Dock pedestal',(0,0,.55),(.31,.3,.88),white);box('Blue service top',(0,0,1.03),(.34,.34,.12),blue)
for x in [-.165,.165]:box('Outlet',(x,0,.66),(.035,.15,.18),black)
tube('Fresh water tap',(.19,.06,.6),(.3,.06,.6),.035,steel)
save('dock-service')
clear();hull=mat('White fibreglass',(.89,.91,.87),.16,.38);navy=mat('Navy hull stripe',(.055,.11,.2),.3,.4);glass=mat('Smoked marine glass',(.075,.16,.21),.55,.2);steel=mat('Stainless rails',(.6,.65,.64),.85,.22);wood=mat('Teak deck',(.42,.28,.15))
# Bow + transom section loft. Original 10 m leisure cruiser; berth occupancy is decorative.
sections=[(-4.8,.08),(-4,1),(-2.5,1.6),(1.8,1.65),(4.3,1.45)]
verts=[]
for y,w in sections:verts.extend([(-w*.72,y,-.35),(-w,y,.25),(w,y,.25),(w*.72,y,-.35)])
faces=[(0,1,2,3)]
for i in range(len(sections)-1):
 for j in range(4):faces.append((i*4+j,i*4+(j+1)%4,(i+1)*4+(j+1)%4,(i+1)*4+j))
faces.append(tuple(range(16,20)));mesh('Cruiser hull',verts,faces,hull)
box('Teak cockpit',(0,2.8,.32),(2.8,2.5,.16),wood);box('Cabin',(0,-.2,1.05),(2.55,3.9,1.6),hull)
box('Front windshield',(0,-2.19,1.47),(2.35,.06,.75),glass)
for x in [-1.29,1.29]:box('Cabin side glazing',(x,-.2,1.45),(.06,2.9,.62),glass)
box('Cabin roof',(0,-.2,1.98),(2.75,4.2,.22),hull)
for side in [-1,1]:
 for i in range(4):
  y=-3.4+i*2;w=1.4;tube('Boat rail post',(side*w,y,.3),(side*w,y,1),.027,steel)
  if i<3:tube('Boat rail',(side*w,y,1),(side*w,y+2,1),.026,steel)
 box('Hull stripe',(side*1.59,.5,.08),(.04,6,.1),navy)
tube('VHF antenna',(.7,.5,2),(.7,.5,3.5),.018,steel,6)
save('harbor-cruiser')

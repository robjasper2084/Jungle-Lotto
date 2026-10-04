"""Original street furniture, in metres. Reference shapes, not surveyed inventory.
Run in an isolated Blender background process. Retain editable masters and FBX.
"""
import bpy, math, json
from pathlib import Path
from mathutils import Vector
root=Path(__file__).resolve().parents[1]
art=root/'art/street-furniture'; out=root/'public/exports/street-furniture'
art.mkdir(parents=True,exist_ok=True); out.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)

def material(name,color,metal=0,rough=.5,emission=None):
 m=bpy.data.materials.new(name); m.diffuse_color=(*color,1); m.use_nodes=True
 p=m.node_tree.nodes.get('Principled BSDF'); p.inputs['Base Color'].default_value=(*color,1)
 p.inputs['Metallic'].default_value=metal; p.inputs['Roughness'].default_value=rough
 if emission: p.inputs['Emission Color'].default_value=(*emission,1); p.inputs['Emission Strength'].default_value=.3
 return m
iron=material('Street powdercoat',(.08,.10,.10),.65,.38)
steel=material('Galvanized metal',(.48,.54,.55),.82,.29)
black=material('Camera lens and rubber',(.012,.020,.026),.3,.18)
ivory=material('Camera weatherproof enclosure',(.76,.79,.77),.2,.38)
red=material('Hydrant enamel',(.50,.035,.025),.38,.35)
wood=material('Weathered park slats',(.28,.18,.095),0,.78)
lamp=material('Street LED diffuser',(.81,.86,.78),.1,.25,(.95,.84,.59))
green=material('Camera green beacon',(.025,.62,.18),.05,.23,(.02,.85,.16))
solar=material('Solar cells',(.025,.07,.12),.55,.22)

def mesh_finish(o,name,mat):
 o.name=name; o.data.materials.append(mat)
 return o
def box(name,p,size,mat,bevel=.012):
 bpy.ops.mesh.primitive_cube_add(size=1,location=p); o=bpy.context.object; o.scale=size
 bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 mesh_finish(o,name,mat)
 if bevel:
  mod=o.modifiers.new('Rounded manufactured edges','BEVEL'); mod.width=bevel; mod.segments=2
  bpy.ops.object.modifier_apply(modifier=mod.name)
 return o
def tube(name,a,b,r,mat,vertices=16,r2=None):
 a,b=Vector(a),Vector(b); v=b-a
 bpy.ops.mesh.primitive_cone_add(vertices=vertices,radius1=r,radius2=r if r2 is None else r2,depth=v.length,location=(a+b)/2)
 o=bpy.context.object; o.rotation_euler=v.to_track_quat('Z','Y').to_euler(); mesh_finish(o,name,mat)
 for p in o.data.polygons: p.use_smooth=len(p.vertices)==4
 return o
def sphere(name,p,size,mat):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=8,radius=1,location=p)
 o=bpy.context.object; o.scale=size; mesh_finish(o,name,mat)
 for p in o.data.polygons:p.use_smooth=True
 return o
def bolts(z,r=.15,n=6):
 for i in range(n):
  a=i*math.tau/n;tube('Foundation bolt',(r*math.cos(a),r*math.sin(a),z),(r*math.cos(a),r*math.sin(a),z+.026),.016,steel,6)
def clear():
 bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
def save(name):
 bpy.ops.wm.save_as_mainfile(filepath=str(art/(name+'.blend')))
 bpy.ops.export_scene.fbx(filepath=str(art/(name+'.fbx')),axis_forward='-Z',axis_up='Y',add_leaf_bones=False)
 # Join by finish for compact static batches. Keep the individual master editable.
 for mat in list(bpy.data.materials):
  parts=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.data.materials and o.data.materials[0]==mat]
  if not parts:continue
  bpy.ops.object.select_all(action='DESELECT')
  for o in parts:o.select_set(True)
  bpy.context.view_layer.objects.active=parts[0];bpy.ops.object.join()
 bpy.ops.export_scene.gltf(filepath=str(out/(name+'.glb')),export_format='GLB',export_yup=True)
 print('STREET_ASSET',name)

box('Lamp footing',(0,0,.055),(.43,.43,.11),iron);bolts(.115)
tube('Tapered street pole',(0,0,.11),(0,0,7.55),.115,steel,16,.058)
box('Maintenance hatch',(0,-.102,.58),(.12,.024,.28),iron)
points=[(0,0,7.24),(0,-.18,7.63),(0,-.58,7.91),(0,-1.03,8.02),(0,-1.74,8.02)]
for a,b in zip(points,points[1:]):tube('Curved cobrahead arm',a,b,.043,steel)
box('Cobrahead housing',(0,-1.83,8.03),(.34,.66,.14),steel,.045)
box('Recessed LED optic',(0,-1.83,7.955),(.26,.53,.025),lamp,.016)
save('street-lamp');clear()

box('Camera pole footing',(0,0,.055),(.42,.42,.11),iron);bolts(.115)
tube('Camera pole',(0,0,.11),(0,0,5.85),.085,steel,16,.055)
box('Weatherproof network box',(0,.07,2.42),(.25,.19,.40),ivory)
box('Network box hinge',(-.13,.07,2.42),(.025,.11,.24),iron)
box('Camera arm',(0,-.25,4.65),(.07,.62,.065),steel)
for x in [-.23,.23]:
 tube('Adjustable bracket',(0,-.36,4.66),(x,-.36,4.71),.025,steel)
 box('Bullet camera body',(x,-.48,4.71),(.14,.33,.14),ivory,.028)
 tube('Camera recessed lens',(x,-.65,4.71),(x,-.678,4.71),.054,black)
 box('Camera sun shield',(x,-.48,4.79),(.18,.38,.02),ivory)
sphere('PTZ dome',(0,-.35,4.43),(.10,.10,.11),black)
tube('Beacon base',(0,0,5.73),(0,0,5.83),.12,iron)
tube('Green beacon',(0,0,5.83),(0,0,6.01),.11,green)
tube('Beacon cap',(0,0,6.01),(0,0,6.05),.13,iron)
panel=box('Solar panel',(0,.06,5.45),(.56,.70,.045),solar,.008);panel.rotation_euler.x=.35
for x in [-.28,.28]:box('Panel frame',(x,.06,5.45),(.02,.7,.055),steel,.004).rotation_euler.x=.35
save('camera-pole');clear()

tube('Hydrant base',(0,0,0),(0,0,.11),.23,iron)
tube('Cast hydrant barrel',(0,0,.1),(0,0,.67),.16,red,20)
tube('Hydrant bonnet rim',(0,0,.67),(0,0,.73),.20,red,20)
sphere('Hydrant bonnet',(0,0,.75),(.18,.18,.11),red)
tube('Bonnet operating nut',(0,0,.81),(0,0,.88),.027,steel,6)
for a in [0,math.pi/2,-math.pi/2]:
 dx,dy=math.sin(a),-math.cos(a);tube('Outlet',(dx*.1,dy*.1,.43),(dx*.25,dy*.25,.43),.075,red)
 tube('Outlet hexagonal cap',(dx*.24,dy*.24,.43),(dx*.28,dy*.28,.43),.086,iron,6)
bolts(.12,.185)
save('hydrant');clear()

for x in [-.64,.64]:
 box('Bench foot',(x,0,.055),(.10,.62,.10),iron)
 box('Bench leg',(x,0,.27),(.075,.08,.47),iron)
 tube('Back support',(x,.22,.3),(x,.32,.94),.035,iron)
 # A curved arm with separate attachment points.
 for a,b in zip([(x,-.25,.49),(x,-.25,.68),(x,-.16,.75),(x,.23,.75)],[(x,-.25,.68),(x,-.16,.75),(x,.23,.75),(x,.27,.61)]):tube('Bench arm',a,b,.027,iron)
for y in [-.22,-.075,.075,.22]:box('Bench seat slat',(0,y,.47),(1.72,.115,.055),wood)
for z in [.68,.80,.92]:box('Bench back slat',(0,.30,z),(1.72,.055,.09),wood).rotation_euler.x=-.13
save('bench');clear()

tube('Bin base',(0,0,0),(0,0,.08),.27,iron)
tube('Liner',(0,0,.08),(0,0,.80),.24,black)
for i in range(20):
 a=i*math.tau/20;box('Waste bin steel slat',(.27*math.sin(a),.27*math.cos(a),.45),(.027,.027,.74),iron,.005)
tube('Waste bin rim',(0,0,.82),(0,0,.88),.30,iron)
tube('Lid',(0,0,.89),(0,0,.96),.32,iron,20,.27)
box('Waste opening',(0,-.292,.85),(.27,.03,.085),black)
save('waste-bin');clear()

for x in [-.8,0,.8]:
 points=[(x,-.30,.025),(x,-.30,.6)]+[(x,-.30*math.cos(i*math.pi/10),.6+.3*math.sin(i*math.pi/10)) for i in range(1,11)]+[(x,.30,.025)]
 for a,b in zip(points,points[1:]):tube('Bike rack hoop',a,b,.032,steel,12)
 for y in [-.3,.3]:box('Rack anchor',(x,y,.03),(.12,.13,.06),iron,.006)
save('bike-rack');clear()

for x in [-.22,.22]:box('Drain rim',(x,0,.008),(.025,.68,.016),iron,.002)
for y in [-.33,.33]:box('Drain rim',(0,y,.008),(.46,.025,.016),iron,.002)
for i in range(10):box('Drain slot bar',(0,-.29+i*.064,.008),(.43,.018,.016),iron,.002)
save('drain-grate');clear()

tube('Utility lid',(0,0,0),(0,0,.012),.34,iron,32)
for i in range(-4,5):
 w=math.sqrt(max(0,.31*.31-(i*.061)**2))*2
 box('Utility lid rib',(0,i*.061,.014),(w,.012,.005),steel,.001)
for x in [-.18,.18]:box('Lifting slot',(x,0,.017),(.08,.027,.004),black,.001)
save('utility-cover');clear()
(art/'README.md').write_text('Original Blender 5.2 street furniture, metre scale. GLB Y-up for browser; editable .blend and FBX for authoring. Camera models are decorative game assets, with no video capture or networking. Forms informed by Detroit riverfront photographs and the City Project Green Light program; locations and dimensions are authored estimates. No reference photographs are redistributed.\n',encoding='utf-8')

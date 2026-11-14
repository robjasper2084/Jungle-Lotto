"""Refine the approved Higgsfield hull in Blender; export metres, +Z bow, +Y up.
blender --background --factory-startup --python build-speedboat.py -- SOURCE.glb OUTPUT.glb SOURCE.blend
"""
import bpy, bmesh, math, sys, os, json
from mathutils import Vector
source, output, blend = sys.argv[sys.argv.index('--')+1:][:3]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=source)
body=next(o for o in bpy.context.scene.objects if o.type=='MESH')
body.name='Higgsfield_refined_offshore_hull'
# Remove the reconstructed wake outside the gunwales. Work in imported metres
# before the eight-metre conversion; the provider's bow points along Blender +Y.
bm=bmesh.new();bm.from_mesh(body.data)
discard=[]
for v in bm.verts:
 x,y,z=v.co
 beam=.154 if y>-.15 else .154-(min(.45,-y)-.15)*.10
 if abs(x)>beam:discard.append(v)
bmesh.ops.delete(bm,geom=discard,context='VERTS')
bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.00002)
bm.to_mesh(body.data);bm.free()
body.scale=(7.8,7.8,7.8);body.rotation_mode='XYZ';body.rotation_euler.z=math.pi;body.location.z=.48
bpy.context.view_layer.objects.active=body;body.select_set(True)
bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
# Open a real cockpit rather than leaving the generated seat/dashboard surface.
bm=bmesh.new();bm.from_mesh(body.data)
remove=[v for v in bm.verts if (abs(v.co.x)<.69 and -.35<v.co.y<1.95 and v.co.z>.30) or v.co.z<.40 or v.co.y< -2.75]
bmesh.ops.delete(bm,geom=remove,context='VERTS');bm.to_mesh(body.data);bm.free()
def material(name,color,metal=0,rough=.4):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
 p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough
 return m
black=material('Graphite clearcoat',(.025,.035,.047),.55,.24)
red=material('Vermilion marine paint',(.58,.018,.027),.3,.24)
rubber=material('Charcoal marine upholstery',(.014,.018,.023),0,.67)
silver=material('Brushed aluminium',(.42,.47,.49),.8,.32)
glass=material('Smoked windscreen',(.035,.10,.13),.45,.12)
display=material('Reactive instrument surface',(.009,.02,.025),0,.8)
glass.diffuse_color=(.04,.13,.17,.24);glass.node_tree.nodes['Principled BSDF'].inputs['Alpha'].default_value=.24;glass.surface_render_method='DITHERED'
body.data.materials.clear();body.data.materials.append(black)
for p in body.data.polygons:p.use_smooth=True
def point(p):return (p[0],-p[2],p[1])
def box(name,p,size,mat,bevel=.04):
 bpy.ops.mesh.primitive_cube_add(size=1,location=point(p));o=bpy.context.object;o.name=name;o.dimensions=(size[0],size[2],size[1]);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(mat)
 if bevel:
  m=o.modifiers.new('Soft manufactured edges','BEVEL');m.width=bevel;m.segments=2;bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=m.name)
 return o
def rod(name,points,r,mat):
 c=bpy.data.curves.new(name,'CURVE');c.dimensions='3D';c.resolution_u=1;c.bevel_depth=r;c.bevel_resolution=2;s=c.splines.new('POLY');s.points.add(len(points)-1)
 for dest,p in zip(s.points,points):dest.co=(*point(p),1)
 o=bpy.data.objects.new(name,c);bpy.context.collection.objects.link(o);o.data.materials.append(mat);return o
def plane(name,p,w,h,mat):
 # Plane faces the driver's seat, toward glTF -Z. UVs read upright from aft.
 verts=[point((p[0]-w/2,p[1]-h/2,p[2])),point((p[0]+w/2,p[1]-h/2,p[2])),point((p[0]+w/2,p[1]+h/2,p[2])),point((p[0]-w/2,p[1]+h/2,p[2]))]
 mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],[(3,2,1,0)]);mesh.uv_layers.new()
 for i,uv in enumerate([(1,1),(0,1),(0,0),(1,0)]):mesh.uv_layers.active.data[i].uv=uv
 o=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(o);o.data.materials.append(mat);return o
# Fair the generated lower surface into a closed deep-V hull. The retained
# Higgsfield deck/cockpit surround and outboards sit above these clean chines.
verts=[]
for z,w,deck in [(-3.5,.87,.69),(-2.4,1.05,.74),(0,1.18,.80),(2.3,1.00,.84),(3.9,.015,.85)]:
 verts.extend([point((-w,deck,z)),point((w,deck,z)),point((w*.88,.10,z)),point((0,-.34,z)),point((-w*.88,.10,z))])
faces=[(4,3,2,1,0)]
for k in range(4):
 for i in range(5):a=k*5+i;b=k*5+(i+1)%5;faces.append((a,b,b+5,a+5))
faces.append(tuple(range(20,25)))
# Keep the central top open beneath the cockpit, closing the foredeck only.
faces=[f for f in faces if not (len(f)==4 and f[0]%5==0 and f[0]<15)]
mesh=bpy.data.meshes.new('Faired hull');mesh.from_pydata(verts,[],[tuple(reversed(f)) for f in faces]);o=bpy.data.objects.new('Faired V hull',mesh);bpy.context.collection.objects.link(o);mesh.materials.append(black)
# Narrow red foredeck accents do not add another texture download.
rod('Foredeck accent left',[(-.23,.86,1.7),(-.18,.88,2.5),(0,.88,3.65)],.022,red)
rod('Foredeck accent right',[(.23,.86,1.7),(.18,.88,2.5),(0,.88,3.65)],.022,red)
box('Cockpit floor',(0,.34,-.8),(1.42,.10,2.55),rubber)
for side in [-1,1]:
 box('Red cockpit coaming',(side*.75,.68,-.86),(.15,.43,2.45),red,.07)
 box('Gunwale inset',(side*.77,.92,-.86),(.13,.06,2.42),rubber,.025)
 box('Red seat base',(side*.40,.54,-1.27),(.63,.20,.63),red,.10)
 box('Seat cushion',(side*.40,.65,-1.25),(.49,.09,.47),rubber,.045)
 seat=box('Bolstered seat back',(side*.40,.95,-1.64),(.63,.64,.18),red,.07);seat.rotation_euler.x=math.radians(-8)
 box('Black seat insert',(side*.40,.99,-1.53),(.43,.43,.06),rubber,.03)
 box('Head restraint',(side*.40,1.30,-1.67),(.42,.20,.16),rubber,.06)
 # Original surface retained; thin new accent follows the gunwale sheer.
 rod('Red sheer stripe',[(side*.86,.27,-3.5),(side*1.05,.34,-2.2),(side*1.15,.40,0),(side*1.05,.44,2.2),(side*.79,.47,3.45)],.025,red)
 rod('Silver trim',[(side*.86,.32,-3.5),(side*1.05,.39,-2.2),(side*1.15,.45,0),(side*1.05,.49,2.2),(side*.79,.52,3.45)],.009,silver)
 for z in [-2.6,2.5]:box('Deck cleat',(side*.84,.89,z),(.16,.035,.06),silver,.01)
box('Dashboard',(0,.89,.27),(1.43,.38,.28),red,.06)
plane('Cockpit_Display',(0,.91,.118),1.30,.31,display)
window=plane('Windscreen',(0,1.19,.42),1.46,.25,glass)
rod('Windscreen rim',[(-.74,1.07,.42),(-.74,1.31,.42),(.74,1.31,.42),(.74,1.07,.42)],.013,silver)
box('Console',(0,.62,-.63),(.16,.40,.65),black,.03)
for x in [-.045,.045]:
 box('Throttle slot',(x,.84,-.55),(.022,.018,.30),silver,.005)
 lever=rod('Throttle_Lever_'+str(x),[(x,.85,-.6),(x,1.01,-.52)],.012,silver)
 box('Throttle grip',(x,1.01,-.52),(.05,.04,.08),rubber,.015)
# Wheel is a separate transform pivot for steering animation.
bpy.ops.object.empty_add(type='PLAIN_AXES',location=point((-.40,.94,-.30)));helm=bpy.context.object;helm.name='Helm_Wheel'
bpy.ops.mesh.primitive_torus_add(major_radius=.18,minor_radius=.018,major_segments=32,minor_segments=8,location=helm.location,rotation=(math.pi/2,0,0));o=bpy.context.object;o.data.materials.append(rubber);o.parent=helm;o.matrix_parent_inverse=helm.matrix_world.inverted()
for a in [math.pi/2,7*math.pi/6,11*math.pi/6]:
 o=rod('Wheel spoke',[(-.40,.94,-.30),(-.40+math.cos(a)*.16,.94+math.sin(a)*.16,-.30)],.012,silver);o.parent=helm;o.matrix_parent_inverse=helm.matrix_world.inverted()
# Small red/green navigation lenses; emissive materials are driven at runtime.
for side,color,label in [(1,(.9,.02,.02),'Nav_Port'),(-1,(.01,.8,.25),'Nav_Starboard')]:
 o=box(label,(side*.88,.98,.5),(.08,.035,.07),material(label,color,0,.25),.012)
for name,p in [('Driver_Eye',(-.40,1.50,-1.46)),('Driver_Hip',(-.40,.79,-1.36))]:
 bpy.ops.object.empty_add(type='PLAIN_AXES',location=point(p));bpy.context.object.name=name
# Merge static pieces by material, retaining named controls and anchors.
dynamic={'Cockpit_Display','Nav_Port','Nav_Starboard'}
for o in list(bpy.context.scene.objects):
 if o.type=='CURVE':
  bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o;bpy.ops.object.convert(target='MESH')
for mat in [black,red,rubber,silver,glass]:
 objs=[o for o in bpy.context.scene.objects if o.type=='MESH' and not o.parent and o.name not in dynamic and len(o.data.materials)==1 and o.data.materials[0]==mat]
 if objs:
  bpy.ops.object.select_all(action='DESELECT')
  for o in objs:o.select_set(True)
  bpy.context.view_layer.objects.active=objs[0];bpy.ops.object.join();bpy.context.object.name='Speedboat_'+mat.name
os.makedirs(os.path.dirname(output),exist_ok=True);os.makedirs(os.path.dirname(blend),exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=blend)
bpy.ops.export_scene.gltf(filepath=output,export_format='GLB',export_apply=True,export_yup=True)
tri=sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in bpy.context.scene.objects if o.type=='MESH')
print('SPEEDBOAT_EXPORT',json.dumps({'triangles':tri,'bytes':os.path.getsize(output),'meshObjects':sum(o.type=='MESH' for o in bpy.context.scene.objects)}))

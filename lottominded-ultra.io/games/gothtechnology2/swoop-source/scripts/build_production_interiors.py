"""Original 2000 Mack interiors. Blender metres -> glTF +Y up, +Z entrance.
Run in background. Original masters and incoming retail GLBs stay preserved.
Google Images references guide equipment/layout; no search image is embedded.
"""
import bpy, math, os, runpy, json, shutil, random
from pathlib import Path
from mathutils import Vector, Matrix

ROOT=Path(__file__).resolve().parent.parent
ART=ROOT/'art'/'studio-retail'; ART.mkdir(exist_ok=True)
ORIGINALS=ART/'originals'; ORIGINALS.mkdir(exist_ok=True)
EXPORT=ROOT/'public'/'exports'
for relative in ['atwater/mack-gothtech-studio.glb','boutique/GothTechnology-Store.glb','gallery/Serengeti-Galleries.glb']:
 destination=ORIGINALS/Path(relative).name
 if not destination.exists(): shutil.copy2(EXPORT/relative,destination)

def material(name,color,metal=0,rough=.65,emit=0):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
 p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal
 if emit: p.inputs['Emission Color'].default_value=(*color,1);p.inputs['Emission Strength'].default_value=emit
 return m

def surface(name,path):
 m=material(name,(1,1,1),rough=.82);node=m.node_tree.nodes.new('ShaderNodeTexImage');node.image=bpy.data.images.load(str(path),check_existing=True);m.node_tree.links.new(node.outputs['Color'],m.node_tree.nodes.get('Principled BSDF').inputs['Base Color']);return m

def skin(name,tile,rough=.7,metal=0,metres=1.2):
 m=surface(name,ART/'higgsfield'/(tile+'.png'));p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal;m['texture_metres']=metres
 normal=m.node_tree.nodes.new('ShaderNodeTexImage');normal.image=bpy.data.images.load(str(ART/'higgsfield'/(tile+'-normal.png')),check_existing=True);normal.image.colorspace_settings.name='Non-Color'
 bump=m.node_tree.nodes.new('ShaderNodeNormalMap');bump.inputs['Strength'].default_value=.36;m.node_tree.links.new(normal.outputs['Color'],bump.inputs['Color']);m.node_tree.links.new(bump.outputs['Normal'],p.inputs['Normal']);return m

def floor_material(name,wood=False,dark=False):
 return skin(name,'walnut' if wood else 'charcoal' if dark else 'travertine',.5 if wood else .74,metres=1.8)

def floor(name,x,z,w,d,m,y=.071,repeat=1.8):
 mesh=bpy.data.meshes.new(name);mesh.from_pydata([(x-w/2,-z+d/2,y),(x+w/2,-z+d/2,y),(x+w/2,-z-d/2,y),(x-w/2,-z-d/2,y)],[],[(3,2,1,0)]);mesh.update();uv=mesh.uv_layers.new()
 for loop,coords in zip(uv.data,[(0,d/repeat),(w/repeat,d/repeat),(w/repeat,0),(0,0)]):loop.uv=coords
 o=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(o);o.data.materials.append(m);o['surface_uv_done']=True

def cube(name,x,y,z,w,h,d,m,bevel=.025):
 bpy.ops.mesh.primitive_cube_add(size=1,location=(x,-z,y));o=bpy.context.object;o.name=name;o.scale=(w,d,h);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(m)
 if bevel:
  mod=o.modifiers.new('Soft manufactured edges','BEVEL');mod.width=min(bevel,min(w,h,d)*.3);mod.segments=2
  bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
 return o

def rod(name,a,b,r,m,vertices=12):
 a=Vector((a[0],-a[2],a[1]));b=Vector((b[0],-b[2],b[1]));v=b-a
 bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=r,depth=v.length,location=(a+b)/2);o=bpy.context.object;o.name=name;o.rotation_euler=v.to_track_quat('Z','Y').to_euler();o.data.materials.append(m)
 for p in o.data.polygons:p.use_smooth=len(p.vertices)==4
 return o

def ball(name,x,y,z,sx,sy,sz,m):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=8,location=(x,-z,y));o=bpy.context.object;o.name=name;o.scale=(sx,sz,sy);o.data.materials.append(m)
 for p in o.data.polygons:p.use_smooth=True
 return o

def label(name,body,x,y,z,size,m,angle=0):
 bpy.ops.object.text_add(location=(x,-z,y),rotation=(math.pi/2,0,angle));o=bpy.context.object;o.name=name;o.data.body=body;o.data.size=size;o.data.align_x='CENTER';o.data.resolution_u=2;o.data.extrude=0;o.data.bevel_depth=0;o.data.materials.append(m);bpy.ops.object.convert(target='MESH');return o

def panel(name,x,y,z,w,h,m,angle=0):
 # Explicit front-facing UV quad. Local +Z is toward a visitor at the entrance.
 verts=[(-w/2,0,-h/2),(w/2,0,-h/2),(w/2,0,h/2),(-w/2,0,h/2)]
 mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],[(0,1,2,3)]);mesh.update();uv=mesh.uv_layers.new()
 for loop,coords in zip(uv.data,[(0,0),(1,0),(1,1),(0,1)]):loop.uv=coords
 o=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(o);o.location=(x,-z,y);o.rotation_euler.z=angle;o.data.materials.append(m);return o

def palette():
 return {
 'black':material('Powder coated graphite',(.023,.027,.029),.45,.48),
 'rubber':material('Rubber / acoustic felt',(.035,.04,.043),0,.93),
 'steel':material('Brushed equipment aluminum',(.4,.45,.48),.8,.3),
 'gold':skin('Higgsfield satin brass','brass',.38,.65,.6),
 'white':material('Warm white studio diffuser',(.87,.9,.91),0,.5,.7),
 'warm':material('Warm retail lighting',(.98,.74,.4),0,.45,1.5),
 'green':material('Chroma key green paint',(.004,.24,.009),0,.96),
 'ivory':skin('Higgsfield gallery plaster','plaster',.9,metres=1.8),
 'wood':skin('Higgsfield walnut retail furniture','walnut',.48,metres=1.2),
 'cloth':skin('Higgsfield black cotton garments','cotton',.97,metres=.25),
 'red':material('Oxblood cotton',(.2,.025,.043),0,.94),
 'cream':material('Bone cotton',(.62,.56,.43),0,.94),
 'floor':skin('Higgsfield charcoal microcement','charcoal',.72,metres=1.8),
 'yellow':material('Safety tape',(.88,.60,.04),0,.84),
 'skin':material('Matte display mannequins',(.43,.40,.35),0,.68),
 'sage':skin('Higgsfield Serengeti green linen','linen',.84,metres=.5),
 }

def stand(x,z,height,P,boom=None):
 rod('Light stand telescoping column',(x,.1,z),(x,height,z),.028,P['steel'])
 rod('Stand lower sleeve',(x,.2,z),(x,.95,z),.044,P['black'])
 for angle in [0,2.094,4.189]:
  ex=x+math.cos(angle)*.61;ez=z+math.sin(angle)*.61
  rod('Folding stand leg',(x,.62,z),(ex,.09,ez),.025,P['black']);ball('Rubber foot',ex,.08,ez,.075,.045,.075,P['rubber'])
 cube('Sandbag ballast',x+.33,.16,z,.42,.24,.30,P['rubber'],.08)
 for h in [.9,1.55]:cube('Stand lock knob',x+.052,h,z,.08,.075,.065,P['black'])
 if boom:rod('Microphone boom',(x,height,z),boom,.021,P['steel'])

def softbox(x,z,height,P,side=1):
 stand(x,z,height,P)
 cube('Softbox black shell',x,height+.18,z,1.15,.86,.34,P['black'],.08)
 face=cube('Softbox white diffusion',x,height+.18,z-.19,1.08,.79,.016,P['white'],.015)
 # Key/fill face the stage behind them, keeping equipment outside the centre lane.
 for dx in [-.52,.52]:rod('Softbox stitched edge',(x+dx,height-.2,z-.20),(x+dx,height+.55,z-.20),.014,P['rubber'])
 cube('Softbox tilt yoke',x,height-.4,z,.45,.22,.2,P['steel'])

def camera(x,z,P):
 stand(x,z,1.42,P)
 cube('Cinema camera body',x,1.61,z,.40,.27,.32,P['black'],.05)
 rod('Cinema lens barrel',(x,1.6,z-.16),(x,1.6,z-.53),.12,P['black'],24)
 rod('Lens focus collar',(x,1.6,z-.27),(x,1.6,z-.33),.137,P['rubber'],24)
 rod('Lens optical glass',(x,1.6,z-.53),(x,1.6,z-.544),.094,P['steel'],24)
 cube('Matte box',x,1.6,z-.52,.34,.27,.05,P['black'])
 cube('Top handle',x,1.86,z,.31,.036,.06,P['steel'])
 cube('Camera field monitor',x+.30,1.83,z,.27,.18,.035,P['black'])
 cube('Camera monitor screen',x+.30,1.83,z+.023,.23,.14,.009,P['green'])
 cube('Camera battery',x,1.61,z+.24,.23,.22,.12,P['rubber'])
 rod('Pan handle',(x+.10,1.39,z),(x+.3,1.32,z+.6),.018,P['black'])
 label('Camera unit mark','CINEMA',x,1.62,z+.167,.043,P['white'])

def chair(x,z,P,director=False):
 cube('Chair seat',x,.53,z,.55,.09,.53,P['rubber'])
 cube('Chair back',x,.94,z-.21,.55,.45,.07,P['rubber'])
 for dx in [-.23,.23]:
  rod('Chair frame',(x+dx,.05,z-.22),(x+dx,.57,z+.2),.026,P['steel']);rod('Chair frame',(x+dx,.05,z+.22),(x+dx,.57,z-.2),.026,P['steel'])
  rod('Chair back support',(x+dx,.47,z-.2),(x+dx,1.2,z-.2),.022,P['steel'])
 if director:label('Director seat','DIRECTOR',x,1.04,z-.167,.085,P['white'])

def framed_image(name,x,y,z,w,h,texture,P):
 # Preserve the proportions and identity of supplied artwork and merchandise.
 image=next(n.image for n in texture.node_tree.nodes if n.type=='TEX_IMAGE')
 aspect=image.size[0]/image.size[1];w=min(w,h*aspect);h=w/aspect
 cube(name+' picture mat',x,y,z,w+.09,h+.09,.035,P['black'])
 for dx in [-w/2-.035,w/2+.035]:cube(name+' brass vertical',x+dx,y,z+.018,.04,h+.11,.035,P['gold'],.008)
 for dy in [-h/2-.035,h/2+.035]:cube(name+' brass horizontal',x,y+dy,z+.018,w+.11,.04,.035,P['gold'],.008)
 panel(name,x,y,z+.027,w,h,texture)

def cyc(P):
 # Continuous curved floor/wall profile, no hard horizon seam. Flat entry at z=-12.8.
 profile=[(-12.8,.065),(-19.1,.065)]
 for i in range(1,21):
  a=i*math.pi/40;profile.append((-19.1-1.15*math.sin(a),.065+1.15*(1-math.cos(a))))
 profile.append((-20.25,5.25))
 vertices=[(x,-z,y) for x in [-6.5,6.5] for z,y in profile];N=len(profile)
 mesh=bpy.data.meshes.new('Seamless chroma cyclorama');mesh.from_pydata(vertices,[],[(N+i,N+i+1,i+1,i) for i in range(N-1)]);mesh.update();o=bpy.data.objects.new('Seamless chroma cyclorama',mesh);bpy.context.collection.objects.link(o);o.data.materials.append(P['green'])
 for p in mesh.polygons:p.use_smooth=True
 # Outside cheeks support the stage without closing the pedestrian route.
 for x in [-6.6,6.6]:cube('Cyc cheek wall',x,2.5,-18.8,.15,4.9,2.9,P['green'])
 for x in [-.6,.6]:cube('Talent floor tape',x,.078,-16,.40,.008,.045,P['yellow'],0)
 cube('Talent centre tape',0,.078,-16,.045,.008,.40,P['yellow'],0)

def move_cinema_to_left_wall(objects):
 # The blank wall to the viewer's left when facing the original cinema is
 # the front interior wall (+v), not the distant opposite livestream wall.
 transform=Matrix.Translation(Vector((15.55,-21.70,0))) @ Matrix.Rotation(-math.pi/2,4,'Z') @ Matrix.Translation(Vector((-24.02,15.55,0)))
 for o in objects:o.matrix_world=transform @ o.matrix_world

def studio(P):
 dark=floor_material('Studio sealed charcoal concrete',dark=True);stone=floor_material('Lobby large format stone');wood=floor_material('Lobby walnut plank inlay',wood=True)
 # Separate floor zones leave the green cyclorama surface above its base slab.
 for x in [-15.0,15.0]:floor('Studio side work bay finished floor',x,-13.6,16.8,15,dark)
 floor('Studio camera and crew floor',0,-9.44,13.2,6.70,dark)
 floor('Lobby porcelain stone tiles',0,15.5,48.1,12.4,stone)
 floor('Central walnut promenade',0,2.0,5.6,27.0,wood,.077,2.4)
 for x in [-2.86,2.86]:cube('Promenade brass floor border',x,.082,2,.035,.008,27,P['gold'],0)
 for x in [-12,12]:floor('Shop lobby walnut threshold',x,10.2,18.0,1.7,wood,.078,2.4)
 for side in [-1,1]:
  before=set(bpy.context.scene.objects)
  x=side*24.02;z=15.55;y=3.05
  cube('Giant wall display aluminum chassis',x,y,z,.18,4.68,8.18,P['black'],.03)
  for yy in [y-2.30,y+2.30]:cube('Display top and bottom brass edge',x-side*.11,yy,z,.045,.035,8.10,P['gold'],.008)
  for zz in [z-4.045,z+4.045]:cube('Display vertical brass edge',x-side*.11,y,zz,.045,4.62,.035,P['gold'],.008)
  for zz in [z-4.6,z+4.6]:
   cube('Wall surround loudspeaker',x-side*.18,2.95,zz,.23,1.55,.36,P['black'])
  sign=label('Wall screen program label','MEDIA CENTER / CINEMA' if side>0 else 'LIVE STREAMS',0,5.66,0,.22,P['black'])
  sign.rotation_euler.z=math.pi/2 if side<0 else -math.pi/2;sign.location=(x-side*.10,-z,5.66)
  cube('Wall display status strip',x-side*.105,.62,z,.025,.025,.50,P['sage'],0)
  if side>0:move_cinema_to_left_wall(set(bpy.context.scene.objects)-before)
 cyc(P)
 label('Production studio brand','GOTHTECH  /  PRODUCTION',0,5.49,-20.4,.44,P['white'])
 label('Studio stage designation','01    GREEN SCREEN / PHOTO + VIDEO',0,5.08,-20.37,.21,P['white'])
 # Ceiling grid, suspension, and eight fixed LED units.
 for x in [-6,0,6]:rod('Ceiling suspension',(x,5.5,-15.5),(x,5.98,-15.5),.027,P['steel'])
 for z in [-19,-15.5,-12]:rod('Studio overhead grid',(-7,5.45,z),(7,5.45,z),.056,P['black'])
 for x in [-6,-2,2,6]:
  rod('Studio overhead grid',(x,5.45,-20),(x,5.45,-11.5),.045,P['black'])
  for z in [-18.4,-13.8]:
   cube('LED grid fixture',x,5.17,z,.63,.17,.45,P['black']);cube('LED grid diffuser',x,5.07,z,.55,.018,.38,P['white'])
 for x in [-5.35,5.35]:softbox(x,-12.1,2.45,P)
 camera(-2.3,-10.1,P);camera(3.0,-10.0,P)
 stand(6.9,-14,2.7,P,boom=(1.6,3.5,-16))
 rod('Shotgun microphone',(1.6,3.5,-16),(1.6,3.5,-16.55),.055,P['rubber'])
 for x in [-8.4,8.4]:
  cube('Rolling V-flat acoustic flag',x,1.65,-17,.08,3.05,1.85,P['rubber'])
  for z in [-17.55,-16.45]:rod('V-flat caster frame',(x-.4,.10,z),(x+.4,.10,z),.025,P['steel'])
 chair(9.6,-10.5,P,True)
 # Editing station and audio desk, with reused original Higgsfield Detroit cover.
 x=-15.3;z=-13.6
 cube('Editing desk',x,.83,z,4.2,.12,1.10,P['wood'])
 for dx in [-1.7,1.7]:cube('Desk steel pedestal',x+dx,.42,z,.10,.80,.85,P['black'])
 monitor=surface('Higgsfield Detroit edit monitor',ROOT/'art/animation-polish/mission-cover.png')
 for dx in [-.83,.83]:
  cube('Editor monitor housing',x+dx,1.40,z-.24,1.53,.93,.075,P['black']);panel('Detroit footage on edit screen',x+dx,1.40,z-.197,1.42,.80,monitor);cube('Monitor stand',x+dx,1.03,z-.24,.07,.24,.08,P['steel']);cube('Monitor foot',x+dx,.92,z-.14,.40,.025,.27,P['black'])
 cube('Keyboard',x,.925,z+.3,.75,.035,.25,P['black']);cube('Trackpad',x+.62,.925,z+.3,.18,.02,.2,P['steel'])
 for dx in [-1.95,1.95]:
  cube('Nearfield studio speaker',x+dx,1.15,z-.22,.29,.5,.28,P['black']);rod('Speaker cone',(x+dx,1.15,z-.06),(x+dx,1.15,z-.045),.10,P['rubber'])
 chair(x,z+1.1,P)
 cube('Edit workstation tower',x+1.3,.4,z-.1,.32,.65,.48,P['black'])
 label('Edit suite sign','02   EDIT / COLOR / SOUND',x,3.05,z-.7,.28,P['white'])
 for i in range(7):cube('Edit acoustic wall panels',-19.8+i*1.45,2.55,-20.8,1.05,2.6,.13,P['rubber'])
 # Makeup/wardrobe bay, illuminated mirror and paper backdrop rack.
 x=16;z=-16.7
 cube('Makeup vanity',x,.87,z,3.5,.13,.8,P['wood']);cube('Vanity drawer',x,.60,z,3.3,.45,.7,P['ivory']);cube('Vanity mirror frame',x,1.90,z-.3,3.2,1.62,.08,P['black']);cube('Vanity mirror',x,1.90,z-.25,3,1.43,.017,P['steel'])
 for dx in [-1.53,1.53]:
  for y in [1.3,1.7,2.1,2.5]:ball('Makeup mirror bulb',x+dx,y,z-.18,.065,.065,.065,P['white'])
 for i in range(5):cube('Makeup kit',x-.65+i*.29,1.03,z+.1,.16,.18,.14,P['black'])
 chair(x,z+1.0,P);label('Makeup bay sign','03   MAKEUP / WARDROBE',x,3.18,z-.36,.24,P['white'])
 for i,m in enumerate([P['white'],P['sage'],P['rubber']]):rod('Spare paper backdrop roll',(11,3.0+i*.43,-20.6),(20.7,3.0+i*.43,-20.6),.17,m)
 for x in [10.7,21]:cube('Backdrop storage support',x,2.6,-20.6,.12,3.4,.12,P['black'])
 for x,z in [(-21,-9),(18.8,-9.8),(20.5,-12)]:
  cube('Rolling equipment road case',x,.51,z,1.18,.87,.72,P['black'],.065)
  for dx in [-.55,.55]:cube('Case metal corner',x+dx,.51,z,.035,.85,.73,P['steel'])
  cube('Case lid trim',x,.68,z,1.19,.035,.735,P['steel']);cube('Case handle',x,.45,z+.38,.25,.045,.025,P['steel'])
  for dx in [-.42,.42]:
   for dz in [-.23,.23]:ball('Case caster',x+dx,.1,z+dz,.065,.08,.065,P['rubber'])
 label('Storage bay sign','GEAR / GRIP',-20.6,2.5,-10.6,.23,P['white'])
 cube('Cable crossing protector',0,.105,-8.6,7,.1,.30,P['rubber'],.04)
 for x in [-3,-2,-1,0,1,2,3]:cube('Cable cover safety stripe',x,.163,-8.6,.32,.008,.26,P['yellow'],0)
 label('Studio wayfinding','PHOTO + VIDEO  /  STUDIO 01',0,3.9,-6.5,.27,P['white'])
 for x,title in [(-9,'2084 / STATIC WAVE'),(-10.4,'ROBOT RAHBE / VAULT RUSH')]:arcade_cabinet(x,20.65,title,P,math.pi)

def shirt(name,x,y,z,m,P,width=.62):
 outline=[(-.28,.4),(-.47,.24),(-.35,.06),(-.25,.14),(-.22,-.42),(.22,-.42),(.25,.14),(.35,.06),(.47,.24),(.28,.4),(.12,.4),(.08,.32),(-.08,.32),(-.12,.4)]
 scale=width/.94;N=len(outline);verts=[(x+a*scale,-z+depth,y+b*scale) for depth in [-.052,.052] for a,b in outline]
 faces=[tuple(range(N)),tuple(range(2*N-1,N-1,-1))]+[(i,i+N,(i+1)%N+N,(i+1)%N) for i in range(N)]
 mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update();o=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(o);o.data.materials.append(m)
 rod('Wood hanger',(x-.21,y+.23,z),(x,y+.39,z),.014,P['wood']);rod('Wood hanger',(x,y+.39,z),(x+.21,y+.23,z),.014,P['wood']);rod('Hanger hook',(x,y+.37,z),(x,y+.5,z),.009,P['steel'])
 label('Garment Gothic embroidery','GOTH',x,y+.05,z+.057,.064,P['gold'])

def rack(x,z,P):
 for dx in [-1.8,1.8]:
  rod('Clothing rack upright',(x+dx,.16,z),(x+dx,2.3,z),.035,P['black']);rod('Garment rack foot',(x+dx,.1,z-.48),(x+dx,.1,z+.48),.031,P['black'])
 rod('Garment rail',(x-1.8,2.3,z),(x+1.8,2.3,z),.029,P['steel'])
 cube('Rack shoe shelf',x,.26,z,3.75,.08,.88,P['wood'])
 for i in range(10):shirt('Hanging streetwear',x-1.55+i*.345,1.80,z,[P['cloth'],P['red'],P['cream']][i%3],P,width=.55)

def mannequin(x,z,P,m):
 cube('Mannequin plinth',x,.13,z,1.05,.20,.9,P['black'])
 for dx in [-.13,.13]:
  rod('Mannequin trouser leg',(x+dx,.22,z),(x+dx,1.12,z),.083,P['cloth']);cube('Mannequin shoe',x+dx,.27,z+.055,.15,.09,.30,P['black'])
 ball('Dressed mannequin torso',x,1.4,z,.25,.37,.13,m);ball('Mannequin head',x,1.99,z,.12,.165,.12,P['skin']);rod('Mannequin neck',(x,1.68,z),(x,1.87,z),.05,P['skin'])
 for side in [-1,1]:
  rod('Hoodie mannequin sleeve',(x+side*.22,1.62,z),(x+side*.33,1.13,z+.025),.07,m);ball('Mannequin hand',x+side*.33,1.08,z+.025,.048,.075,.04,P['skin'])
 label('Mannequin shirt embroidery','GOTH',x,1.5,z+.14,.085,P['gold'])

def room(P,store):
 cube('Shop finished floor',0,.05,0,18,.03,12,P['floor'] if store else P['ivory'],0)
 floor('Retail porcelain tile flooring',0,0,17.75,11.75,floor_material('GothTech dark porcelain' if store else 'Serengeti ivory stone',dark=store),.071)
 for x in [-8.88,8.88]:cube('Retail side wall',x,2.20,0,.18,4.4,12,P['black'] if store else P['ivory'])
 cube('Retail rear wall',0,2.20,-5.88,18,4.4,.18,P['black'] if store else P['sage'])
 # Open double-door, brass storefront portals and glazed display bays.
 for x in [-8.86,-2.25,2.25,8.86]:cube('Storefront metal mullion',x,1.95,6,.09,3.8,.12,P['gold'])
 cube('Storefront fascia',0,4.23,6,18,.59,.23,P['black'] if store else P['sage'])
 for x in [-5.55,5.55]:
  cube('Storefront sill',x,.2,6,6.5,.18,.15,P['gold']);cube('Storefront head',x,3.95,6,6.5,.09,.12,P['gold'])
  # Glazing supplied as glass strips at runtime for predictable transparency.
  cube('Display podium',x,.32,4.7,3.7,.36,1.35,P['wood']);cube('Window bay back panel',x,1.95,3.4,3.7,3.05,.09,P['black'] if store else P['sage'])
 for x in [-6,-2,2,6]:
  rod('Retail ceiling track',(x,4.55,-4.5),(x,4.55,5.2),.025,P['black'])
  for z in [-3,0,3]:
   cube('Aimable retail spotlight',x,4.37,z,.22,.27,.22,P['black']);cube('Retail spotlight lens',x,4.21,z,.16,.035,.16,P['warm'])
 for x in [-8.75,8.75]:cube('Integrated shop floor strip',x,.17,0,.018,.022,11.7,P['warm'],0)
 label('Storefront brand','GOTHTECHNOLOGY' if store else 'SERENGETI GALLERIES',0,4.12,6.14,.43,P['white'])
 label('Entrance threshold caption','DETROIT / THE ARMORY' if store else 'ART / MUSIC / PEOPLE',0,.47,6.10,.15,P['gold'])
 # Staff/service counter sits behind a clear central browsing aisle.
 cube('Staff counter',5.7,.65,-3.8,3.6,1.1,1.05,P['wood']);cube('Stone counter top',5.7,1.24,-3.8,3.72,.10,1.17,P['black']);cube('Counter illuminated reveal',5.7,.27,-3.23,3.45,.035,.022,P['warm'])
 cube('POS terminal',5.85,1.46,-3.78,.46,.35,.055,P['black']);cube('POS display',5.85,1.46,-3.743,.40,.27,.012,P['sage']);cube('Card reader',5.35,1.33,-3.5,.18,.06,.26,P['steel'])
 label('Counter brand','GOTH / DETROIT' if store else 'SERENGETI',5.7,.80,-3.26,.20,P['gold'])

def boutique(P):
 room(P,True)
 arcade_cabinet(2.35,-4.70,'RAHBE / UNDERGROUND',P)
 rack(-5.9,-.4,P);rack(4.7,.0,P)
 mannequin(-5.55,4.8,P,P['cloth']);mannequin(5.55,4.8,P,P['red'])
 for x in [-7.3,-4.8]:
  cube('Folded clothing display table',x,.82,-3.7,1.8,.12,1.15,P['wood'])
  for dx in [-.65,.65]:cube('Table legs',x+dx,.45,-3.7,.06,.74,.8,P['black'])
  for i in range(3):
   for k in range(3):cube('Folded cotton stack',x-.55+i*.55,.95+k*.055,-3.7,.47,.048,.44,[P['cloth'],P['red'],P['cream']][i],.035)
 cube('Accessory island',0,.7,-.9,2.8,1.10,1.4,P['wood']);cube('Accessory island top',0,1.29,-.9,2.95,.075,1.55,P['black'])
 for x in [-.9,-.45,0,.45,.9]:
  rod('Armory fragrance bottle',(x,1.36,-.9),(x,1.61,-.9),.065,P['gold'],16);rod('Roller bottle cap',(x,1.60,-.9),(x,1.69,-.9),.066,P['black'],16)
 for x in [-.8,0,.8]:ball('Embroidered cap',x,1.4,-.36,.18,.10,.14,P['cloth']);cube('Cap visor',x,1.35,-.15,.27,.025,.20,P['black'])
 label('Accessory collection heading','THE ARMORY / OBJECTS + SCENT',0,1.02,-.17,.14,P['gold'])
 catalog=json.loads((EXPORT/'boutique/catalog.json').read_text())
 for i,p in enumerate(catalog):
  # Original official catalog imagery, mounted at human viewing height.
  x=-7.0+(i%6)*2.78;y=2.25+(i//6)*.69;z=-5.72
  tex=surface(p['title'],EXPORT/'boutique'/p['image'])
  framed_image(p['title']+' original catalog',x,y,z,1.60,.54,tex,P)
 label('Collection wall heading','GOTHTECH / COLLECTION CONCEPTS',0,4.13,-5.73,.26,P['gold'])
 label('Counter availability note','CATALOG PREVIEW / ONLINE AVAILABILITY',5.7,1.85,-5.73,.11,P['white'])
 for side in [-1,1]:
  x=side*8.5
  for z in [-2.4,.0,2.4]:
   for y in [.72,1.38,2.04]:
    cube('Accessory wall shelf',x,y,z,.52,.06,1.65,P['wood'])
    for dz in [-.5,0,.5]:ball('Beanie / cap shelf product',x,y+.13,z+dz,.13,.14,.13,P['cloth'])

def gallery(P):
 room(P,False)
 paths=['bill-foster.png','serengeti-gallery.png','detroit-sunset.jpg','cat-portrait.jpg','dog-riverside.jpg','monarch.jpg']
 for i,name in enumerate(paths):
  x=-6.6+(i%3)*6.6;y=2.0+(i//3)*1.28;z=-5.73
  tex=surface('Serengeti original '+name,ROOT/'art/route-gallery'/name)
  framed_image('Original Serengeti art '+name,x,y,z,2.7,1.0,tex,P)
  cube('Artwork picture light',x,y+.63,z+.18,.70,.05,.16,P['warm']);label('Gallery artwork caption',name.split('.')[0].replace('-',' ').upper(),x,y-.68,z+.06,.095,P['white'])
 for i,name in enumerate(['bill-foster.png','serengeti-gallery.png']):
  x=[-5.55,5.55][i];tex=surface('Window exhibition '+name,ROOT/'art/route-gallery'/name);framed_image('Serengeti window original artwork',x,2.08,3.47,2.14,2.27,tex,P)
 # Print shop tables, browser bins, packing and a lounge make the gallery a shop.
 for x in [-5.7,-2.7]:
  cube('Print browser cabinet',x,.62,-1.9,2.0,1.0,1.15,P['wood']);cube('Print bin rim',x,1.13,-1.9,2.08,.075,1.22,P['gold'])
  for i in range(7):cube('Archival art print sleeve',x,.98,-2.3+i*.12,1.7,.43,.024,P['ivory'])
  label('Print browser label','ART PRINTS',x,.82,-1.30,.16,P['ivory'])
 cube('Gallery lounge seat',0,.52,2.0,2.8,.65,1.0,P['sage'],.14);cube('Lounge backrest',0,.97,1.62,2.8,.68,.18,P['sage'],.08)
 cube('Gallery reading table',0,.53,.35,1.9,.08,.65,P['wood'])
 for i in range(4):cube('Exhibition book',-.65+i*.43,.59,.35,.36,.045,.40,P['ivory'])
 for x in [-7.8,7.8]:
  rod('Gallery plant pot',(x,.14,4.7),(x,.64,4.7),.25,P['wood'],20)
  for dx,y,dz in [(-.2,1.3,0),(.15,1.5,.1),(0,1.8,-.15)]:
   rod('Plant stem',(x,.64,4.7),(x+dx,y,4.7+dz),.014,P['sage']);ball('Broad plant leaf',x+dx,y,4.7+dz,.27,.11,.14,P['sage'])
 for i in range(5):rod('Art shipping tube',(4.3+i*.24,.16,-5.2),(4.3+i*.24,1.1,-5.2),.09,P['ivory'])

def lottomind(P):
 # Ground-floor shop in the mapped brick block; +Z faces the street/alley.
 navy=material('LottoMind midnight blue',(.015,.027,.068),0,.6);blue=material('LottoMind electric blue',(.025,.13,.60),.18,.5);lime=material('LottoMind lime detail',(.44,.65,.06),0,.65);brick=skin('Higgsfield Detroit red brick','brick',.94,metres=.8)
 floor('LottoMind stone retail floor',0,0,13.4,18.8,floor_material('LottoMind warm porcelain'),.068)
 floor('LottoMind walnut app zone',-3.7,1.5,4.5,7,floor_material('LottoMind walnut plank',wood=True),.075,2.4)
 for x in [-6.7,6.7]:cube('LottoMind shop side wall',x,1.95,0,.18,3.9,18.8,P['ivory'])
 cube('LottoMind back wall',0,1.95,-9.35,13.4,3.9,.18,navy)
 cube('Brick upper storeys',0,6.88,0,13.4,5.85,18.8,brick)
 cube('Shop ceiling slab',0,4.12,0,13.4,.20,18.8,P['black'])
 cube('Flat industrial roof',0,9.87,0,13.7,.20,19.1,P['rubber'])
 # Real-scale factory windows and brick piers above the shopfront.
 for side in [-1,1]:
  for z in [-7,-3.5,0,3.5,7]:
   for y in [5.65,8.25]:
    cube('Industrial upper window',side*6.807,y,z,.025,1.7,2.5,P['black']);cube('Upper window sash',side*6.826,y,z,.035,.055,2.5,P['steel']);cube('Upper window sill',side*6.85,y-.9,z,.20,.12,2.75,P['ivory'])
 for x in [-5,-2.5,0,2.5,5]:
  for y in [5.65,8.25]:
   cube('Street upper windows',x,y,9.424,1.65,1.8,.05,P['black']);cube('Street window mullion',x,y,9.46,.05,1.8,.04,P['steel']);cube('Street sill',x,y-.95,9.5,1.95,.13,.3,P['ivory'])
 cube('LottoMind illuminated storefront fascia',0,3.60,9.47,13.4,.82,.28,navy)
 label('LottoMind exterior wayfinding','APP LOUNGE / PLAY DESK',0,3.43,9.64,.35,P['white'])
 label('Storefront subtitle','APP LOUNGE  /  NUMBERS  /  PLAY',0,3.11,9.64,.16,lime)
 for x in [-6.62,-1.4,1.4,6.62]:cube('LottoMind brass storefront portal',x,1.57,9.45,.085,3.10,.15,P['gold'])
 for x in [-4.05,4.05]:
  cube('Storefront window sill',x,.15,9.45,5.2,.22,.15,P['gold']);cube('Window display base',x,.28,8.2,3.9,.42,1.1,navy)
  label('Window identity sign','GET THE APP' if x<0 else 'PLAY / EXPLORE',x,2.46,9.50,.24,blue)
 cube('LottoMind entry canopy',0,3.04,9.85,3.35,.13,1.20,blue)
 cube('Recessed entrance mat',0,.078,8.45,2.7,.02,1.7,P['rubber'],0)
 # Ticket wall and staffed-style checkout; no invented jackpots or inventory.
 cube('LottoMind customer counter',1.9,.56,-6.40,7.9,1.06,1.30,navy)
 cube('Stone service counter',1.9,1.12,-6.40,8.10,.10,1.45,P['ivory'])
 cube('Counter illuminated blue reveal',1.9,.33,-5.74,7.6,.04,.02,blue)
 label('Counter brand','LottoMind  /  PLAY DESK',1.9,.77,-5.715,.32,P['white'])
 for x in [-.2,4.4]:
  cube('POS terminal housing',x,1.43,-6.25,.58,.39,.08,P['black']);cube('POS screen',x,1.43,-6.194,.51,.31,.017,blue);cube('Ticket receipt printer',x+.68,1.28,-6.33,.40,.23,.38,P['black']);cube('Contactless reader',x-.52,1.25,-6.00,.18,.10,.23,P['steel'])
 for x in [-3.8,-2.5,-1.2,.1,1.4,2.7,4.0,5.3]:
  for y in [1.9,2.62,3.32]:
   cube('Backlit practice ticket display',x,y,-9.22,1.09,.60,.10,P['gold']);cube('Illustrated number card',x,y,-9.157,1.0,.51,.017,[blue,lime,P['red']][int((x+3.8)/1.3)%3]);label('Ticket sample numerals','01  12  24  36',x,y-.015,-9.13,.13,P['white'])
 label('Practice ticket wall caption','NUMBER EXPLORER / PRACTICE TICKETS',.75,3.79,-9.15,.22,P['white'])
 # App kiosk rows and a visible feature display.
 app=surface('Original LottoMind app identity',ROOT/'art/route-campaign/lottomind-refined.png')
 for x,z in [(-4.5,3.5),(-4.5,.6),(-4.5,-2.3),(4.5,3.3)]:
  cube('LottoMind kiosk weighted pedestal',x,.12,z,.85,.20,.70,navy);cube('App kiosk column',x,.72,z,.36,1.12,.34,blue);cube('Interactive app display housing',x,1.53,z,.88,.65,.10,navy);panel('LottoMind app kiosk screen',x,1.53,z+.063,.78,.54,app);cube('App kiosk shelf',x,1.13,z+.18,.82,.075,.42,P['ivory']);label('Kiosk instruction','OPEN THE APP',x,1.03,z+.407,.085,navy)
 framed_image('LottoMind flagship app poster',4.1,2.06,8.80,2.2,2.60,app,P)
 for x in [1.5,3.7]:
  cube('Play slip writing desk',x,.92,.2,1.35,.10,.75,P['wood']);cube('Writing desk support',x,.48,.2,.15,.88,.54,navy)
  for i in range(4):cube('Practice play slips',x-.38+i*.22,.981,.23,.16,.009,.29,P['white'],0)
  rod('Tethered counter pen',(x+.5,1.0,.3),(x+.52,1.2,.3),.012,navy)
 for x,z in [(-5.9,-4.5),(5.8,6.6)]:
  rod('Indoor planter pot',(x,.1,z),(x,.58,z),.24,navy,16)
  for dx in [-.2,0,.2]:ball('Lobby plant leaf',x+dx,1.0+dx,z,.19,.48,.12,P['sage'])
 for z in [-7,-3,1,5]:
  for x in [-3.5,3.5]:cube('LottoMind ceiling light',x,3.91,z,1.8,.025,.35,P['white'],0)
 label('App lounge interior sign','YOUR NUMBERS. YOUR WORLD.',0,3.44,4.8,.28,navy)
 label('Practice play disclosure','PRACTICE PLAY / NO REAL TICKETS OR PRIZES',0,2.86,-9.14,.11,P['white'])

def arcade_cabinet(x,z,title,P,angle=0):
 before=set(bpy.context.scene.objects)
 game='wave' if '2084' in title else 'underground' if 'UNDERGROUND' in title else 'rahbe'
 accent=material('Retro cabinet '+game+' T-molding',{'wave':(.02,.62,.72),'rahbe':(.78,.23,.03),'underground':(.49,.68,.04)}[game],.18,.38,.15)
 side_art=surface('Original '+game+' cabinet side art',ART/'cabinets'/(game+'-side.png'));marquee=surface('Original '+game+' backlit marquee',ART/'cabinets'/(game+'-marquee.png'))
 mp=marquee.node_tree.nodes.get('Principled BSDF');mp.inputs['Emission Strength'].default_value=.45;marquee.node_tree.links.new(next(n for n in marquee.node_tree.nodes if n.type=='TEX_IMAGE').outputs['Color'],mp.inputs['Emission Color'])
 # Full vintage side profile: foot, coin door, projecting sloped controls,
 # recessed CRT opening and tall overhanging marquee (user photo references).
 profile=[(.425,.12),(.425,.91),(.46,.99),(.13,1.11),(.08,1.36),(.25,1.70),(.43,1.76),(.43,2.00),(-.425,2.00),(-.425,.12)]
 for side in [-1,1]:
  verts=[(side*.445,-zz,yy) for zz,yy in profile]+[(side*.47,-zz,yy) for zz,yy in profile];n=len(profile)
  faces=[tuple(range(n-1,-1,-1)),tuple(range(n,n*2))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
  mesh=bpy.data.meshes.new('Authentic upright side profile');mesh.from_pydata(verts,[],faces);mesh.update();obj=bpy.data.objects.new('1980 molded cabinet side',mesh);bpy.context.collection.objects.link(obj);obj.data.materials.append(P['wood'] if game=='rahbe' else P['black'])
  deco=bpy.data.meshes.new('Custom printed vinyl side');deco.from_pydata([(side*.472,-zz,yy) for zz,yy in profile],[],[tuple(range(n)) if side>0 else tuple(range(n-1,-1,-1))]);deco.update();uv=deco.uv_layers.new()
  for loop in deco.loops:
   zz,yy=profile[loop.vertex_index];uv.data[loop.index].uv=((1-(zz+.425)/.885) if side>0 else (zz+.425)/.885,yy/2)
  obj=bpy.data.objects.new('Full profile illustrated vinyl',deco);bpy.context.collection.objects.link(obj);obj.data.materials.append(side_art)
  for i,(zz,yy) in enumerate(profile):
   nextz,nexty=profile[(i+1)%n];rod('Continuous colored T-molding',(side*.475,yy,zz),(side*.475,nexty,nextz),.011,accent)
 cube('1980 arcade weighted base',0,.08,0,.91,.13,.85,P['black'])
 cube('Arcade coin-door lower body',0,.52,0,.85,.85,.80,P['black'])
 cube('Coin door',0,.57,.414,.29,.40,.022,P['steel']);cube('Coin return',0,.65,.433,.12,.045,.020,P['gold']);label('Coin slot free play','FREE PLAY',0,.48,.44,.052,P['white'])
 deck=cube('Angled metal control deck',0,1.002,.17,.85,.05,.62,P['black']);deck.rotation_euler.x=-.12
 cube('Retro printed control fascia',0,.966,.439,.85,.09,.05,accent)
 cube('CRT bezel housing',0,1.345,.14,.82,.59,.27,P['black'])
 cube('Curved CRT black glass',0,1.345,.283,.66,.45,.018,P['rubber'])
 label('CRT idle prompt','PRESS PLAY',0,1.33,.30,.08,P['white'])
 cube('Backlit arcade marquee case',0,1.866,.12,.86,.26,.59,P['black']);panel('Printed illuminated arcade marquee',0,1.866,.423,.83,.23,marquee)
 cube('Steel cabinet toe plate',0,.19,.435,.82,.12,.014,P['steel'])
 for xx in [-.107,.107]:
  cube('Twin coin slot bezel',xx,.655,.435,.063,.089,.025,P['black']);cube('Coin slot opening',xx,.67,.45,.007,.030,.012,accent,0);cube('Coin reject button',xx,.60,.45,.03,.027,.011,P['red'])
 for xx in [-.12,.12]:
  for yy in [.405,.745]:ball('Coin door screw',xx,yy,.432,.009,.009,.006,P['steel'])
 for xx in [-.38,.38]:cube('Cabinet rear service foot',xx,.04,-.33,.09,.08,.12,P['rubber'])
 for xx in [-.2,.2]:cube('Speaker grille',xx,1.65,.34,.23,.065,.012,P['steel'])
 # Interactive shafts, ball tops and buttons are Three.js meshes at runtime.
 for xx in ([-.20,.20] if game=='wave' else [-.20]):rod('Joystick mounting disc',(xx,1.012,.37),(xx,1.028,.37),.065,P['steel'],16)
 for xx in ([-.045,.065] if game=='wave' else [.12,.27]):rod('Arcade pushbutton socket',(xx,1.012,.37),(xx,1.028,.37),.048,P['black'],16)
 for o in set(bpy.context.scene.objects)-before:
  loc=o.location.copy();o.location.x=x+math.cos(angle)*loc.x+math.sin(angle)*loc.y;o.location.y=-z-math.sin(angle)*loc.x+math.cos(angle)*loc.y;o.rotation_euler.z+=angle

def finish(name,path,master):
 # Physical metre UVs keep the generated grains and brick courses at retail scale.
 for o in bpy.context.scene.objects:
  if o.type!='MESH' or o.get('surface_uv_done') or len(o.data.materials)!=1:continue
  m=o.data.materials[0]
  if not m or 'texture_metres' not in m:continue
  uv=o.data.uv_layers.active or o.data.uv_layers.new();period=m['texture_metres']
  for polygon in o.data.polygons:
   normal=o.matrix_world.to_3x3()@polygon.normal;axis=max(range(3),key=lambda i:abs(normal[i]));axes=[i for i in range(3) if i!=axis]
   for index in polygon.loop_indices:
    p=o.matrix_world@o.data.vertices[o.data.loops[index].vertex_index].co;uv.data[index].uv=(p[axes[0]]/period,p[axes[1]]/period)
 # Merge static props by material; keep editable source collections in .blend.
 bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(ART/master))
 for m in list(bpy.data.materials):
  objects=[o for o in bpy.context.scene.objects if o.type=='MESH' and len(o.data.materials)==1 and o.data.materials[0]==m]
  if not objects:continue
  bpy.ops.object.select_all(action='DESELECT')
  for o in objects:o.select_set(True)
  bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join();bpy.context.object.name=m.name
 bpy.ops.object.select_all(action='SELECT');bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',export_image_format='AUTO',export_yup=True)
 shutil.copy2(path,ART/(path.stem+'-authoring.glb'))
 meshes=[o for o in bpy.context.scene.objects if o.type=='MESH'];points=[o.matrix_world@Vector(v) for o in meshes for v in o.bound_box]
 info={'name':name,'meshes':len(meshes),'triangles':sum(len(p.vertices)-2 for o in meshes for p in o.data.polygons),'bytes':path.stat().st_size,'min':[min(p[i] for p in points) for i in range(3)],'max':[max(p[i] for p in points) for i in range(3)]}
 print('SWOOP_INTERIOR',json.dumps(info));return info

reports=[]
os.environ['SWOOP_PRODUCTION_INTERIOR']='1'
runpy.run_path(str(ROOT/'art/atwater/build_mack_studio.py'))
P=palette();studio(P)
for o in bpy.context.scene.objects:
 if o.type=='MESH':
  for i,m in enumerate(o.data.materials):
   if m and m.name=='Cream glazed block':o.data.materials[i]=P['ivory']
reports.append(finish('Mack production studio',EXPORT/'atwater/mack-gothtech-studio.glb','Mack_Production_Studio.blend'))
for name,builder,relative,master in [('GothTechnology store',boutique,'boutique/GothTechnology-Store.glb','GothTech_Retail.blend'),('Serengeti gallery + print shop',gallery,'gallery/Serengeti-Galleries.glb','Serengeti_Retail.blend')]:
 bpy.ops.wm.read_factory_settings(use_empty=True);P=palette();builder(P);reports.append(finish(name,EXPORT/relative,master))
bpy.ops.wm.read_factory_settings(use_empty=True);P=palette();lottomind(P);reports.append(finish('LottoMind Mack Avenue store',EXPORT/'atwater/lottomind-store.glb','LottoMind_Store.blend'))
for title,master in [('2084 STATIC WAVE','Arcade_2084_Static_Wave'),('ROBOT RAHBE','Arcade_Robot_Rahbe'),('RAHBE / UNDERGROUND','Arcade_Underground')]:
 bpy.ops.wm.read_factory_settings(use_empty=True);P=palette();arcade_cabinet(0,0,title,P)
 # Complete standalone modeling masters include hardware. Embedded room exports
 # use the animated Three.js hardware instead of duplicating static ball tops.
 for xx,zz in ([(-.2,.37),(.2,.37)] if '2084' in title else [(-.2,.37)]):
  rod('Modeled chrome joystick shaft',(xx,1.025,zz),(xx,1.16,zz),.014,P['steel'],16);ball('Arcade ball top',xx,1.16,zz,.049,.049,.049,P['red'] if xx<0 else P['sage'])
 for xx,mat in ([(-.045,P['yellow']),(.065,P['sage'])] if '2084' in title else [(.12,P['yellow']),(.27,P['sage'])]):rod('Arcade spring pushbutton',(xx,1.025,.37),(xx,1.05,.37),.039,mat,16)
 finish(title,ART/(master+'.glb'),master+'.blend')
(ART/'asset-review.json').write_text(json.dumps(reports,indent=2))
print('SWOOP_PRODUCTION_INTERIORS_SUCCESS')

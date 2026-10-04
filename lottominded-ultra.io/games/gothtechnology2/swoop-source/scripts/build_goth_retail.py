"""Retail fixtures built in Blender around the existing GothTech catalog.
Original room master and GLB are archived before this focused makeover.
"""
import bpy, math, json, shutil
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
source=ROOT/'scripts/build_production_interiors.py';scope={'__file__':str(source)}
exec(compile(source.read_text().split('\nreports=[]')[0],str(source),'exec'),scope)
globals().update({k:v for k,v in scope.items() if k not in ['__file__','__name__']})
for p in [EXPORT/'boutique/GothTechnology-Store.glb',ART/'GothTech_Retail.blend']:
 backup=ART/'before-retail-polish'/p.name;backup.parent.mkdir(exist_ok=True)
 if p.exists() and not backup.exists():shutil.copy2(p,backup)
bpy.ops.wm.read_factory_settings(use_empty=True);P=palette();room(P,True)
P['glass']=material('Retail clear display glazing',(.78,.87,.90),0,.12)
P['glass'].diffuse_color=(.78,.87,.9,.16);P['glass'].node_tree.nodes.get('Principled BSDF').inputs['Alpha'].default_value=.16;P['glass'].surface_render_method='DITHERED'
P['paper']=material('Warm cream price tags and packaging',(.85,.81,.72),0,.9)
P['clay']=material('Retail warm greige plaster',(.36,.32,.27),0,.84)
for o in bpy.context.scene.objects:
 if o.name.startswith(('Retail side wall','Retail rear wall')):o.data.materials.clear();o.data.materials.append(P['ivory'])
 if o.name.startswith(('Window bay back panel','Display podium')):o.data.materials.clear();o.data.materials.append(P['wood'])
# Pale tiled floor, real grout courses, timber skirting and clean threshold.
floor('GothTech warm porcelain retail floor',0,0,17.72,11.72,floor_material('Higgsfield porcelain retail floor'),.074,1.8)
for x in range(-8,9):cube('Porcelain tile fine grout',x,.075,0,.009,.002,11.7,P['clay'],0)
for z in range(-5,6):cube('Porcelain tile fine grout',0,.075,z,17.7,.002,.009,P['clay'],0)
for x in [-8.74,8.74]:cube('Walnut retail skirting',x,.23,0,.08,.27,11.7,P['wood'])
cube('Walnut rear skirting',0,.23,-5.74,17.5,.27,.08,P['wood'])
cube('Store entry woven mat',0,.086,5.30,3.2,.025,1.1,P['rubber'])
label('Entry woven mat identity','GOTHTECH',0,.5,5.40,.14,P['gold'])
arcade_cabinet(2.35,-4.70,'RAHBE / UNDERGROUND',P)

def cap(x,y,z,cloth=P['cloth'],text='DETROIT'):
 # Sewn crown hemisphere, curved visor, six seams and button.
 N=28;M=8;vertices=[]
 for j in range(M+1):
  a=j*math.pi/(2*M)
  for i in range(N):
   p=i*math.tau/N;vertices.append((x+.15*math.sin(a)*math.cos(p),-z+.135*math.sin(a)*math.sin(p),y+.15*math.cos(a)))
 faces=[(j*N+i,j*N+(i+1)%N,(j+1)*N+(i+1)%N,(j+1)*N+i) for j in range(M) for i in range(N)]
 mesh=bpy.data.meshes.new('Six panel cap crown');mesh.from_pydata(vertices,[],faces);mesh.update();o=bpy.data.objects.new('Embroidered retail cap',mesh);bpy.context.collection.objects.link(o);o.data.materials.append(cloth)
 for f in mesh.polygons:f.use_smooth=True
 ball('Curved stitched cap visor',x,y+.006,z+.15,.18,.015,.14,cloth)
 ball('Cap crown button',x,y+.152,z,.015,.011,.015,cloth)
 for i in range(6):
  a=i*math.tau/6
  for j in range(7):
   u=j*math.pi/16;v=(j+1)*math.pi/16
   rod('Cap stitched seam',(x+.151*math.sin(u)*math.cos(a),y+.151*math.cos(u),z-.136*math.sin(u)*math.sin(a)),(x+.151*math.sin(v)*math.cos(a),y+.151*math.cos(v),z-.136*math.sin(v)*math.sin(a)),.0015,P['clay'],6)
 label('Cap embroidered identity',text,x,y+.067,z+.128,.036,P['gold'])

def hoodie(x,y,z,m,text='GOTHTECH',w=.78):
 shirt('GothTech hanging hoodie',x,y,z,m,P,w)
 ball('Structured garment hood',x,y+.27,z-.033,.15,.17,.12,m)
 ball('Hood face opening',x,y+.28,z+.05,.092,.112,.07,P['rubber'])
 cube('Hoodie kangaroo pocket',x,y-.13,z+.06,.28,.105,.022,m,.018)
 for dx in [-.059,.059]:rod('Hoodie drawcord',(x+dx,y+.21,z+.075),(x+dx,y+.07,z+.086),.004,P['cream'],8)
 label('Garment chest embroidery',text,x,y+.066,z+.064,.048,P['gold'])
 cube('Retail swing tag',x+.21,y-.02,z+.086,.042,.065,.005,P['paper'],.002)
 rod('Tag string',(x+.16,y+.14,z+.07),(x+.21,y+.015,z+.08),.0017,P['black'],6)

def fold(x,y,z,m,hood=False):
 cube('Soft folded cotton garment',x,y,z,.52,.048,.42,m,.017)
 cube('Folded garment ribbed hem',x,y-.009,z+.211,.49,.023,.018,m,.004)
 for dx in [-.19,.19]:cube('Folded sleeve seam',x+dx,y+.026,z,.014,.003,.35,P['clay'],0)
 if hood:ball('Folded hoodie neck and hood',x,y+.03,z-.14,.12,.026,.13,m)
 label('Folded garment size tag','M / L / XL',x,y-.007,z+.224,.02,P['paper'])

def garment_rail(x,z,width=3.4):
 for dx in [-width/2,width/2]:
  rod('Clothes rail upright',(x+dx,.12,z),(x+dx,2.18,z),.021,P['black'])
  rod('Clothes rail flat foot',(x+dx,.1,z-.35),(x+dx,.1,z+.35),.025,P['black'])
 rod('Garment brushed rail',(x-width/2,2.18,z),(x+width/2,2.18,z),.022,P['steel'])
 for i in range(6):hoodie(x-width*.38+i*width*.152,1.67,z,[P['cloth'],P['cream'],P['red']][i%3],['KNIGHT','DETROIT','GOTH'][i%3],.58)
 cube('Garment rail shelf',x,.38,z,width+.1,.05,.65,P['wood'])
 for i in range(5):fold(x-width*.36+i*width*.18,.44,z,[P['cloth'],P['cream']][i%2])

# Left wall presents a complete apparel department with timber slat backing.
for x in [-7.8,-6.8,-5.8,-4.8,-3.8]:cube('Apparel walnut slat wall',x,2.13,-5.66,.90,3.8,.08,P['wood'])
garment_rail(-5.9,-2.7,4.3)
garment_rail(5.7,.2,3.2)
label('Apparel wall category','GOTHTECH / STREETWEAR',-5.9,3.55,-5.58,.25,P['black'])
for x in [-7.4,-5.8,-4.2]:
 cube('Wall apparel shelf',x,2.48,-5.4,1.43,.055,.50,P['wood'])
 hoodie(x,1.90,-5.26,P['cloth'] if x<-6 else P['red'],'DETROIT',.82)

# Back wall is a lit accessories shop, rather than a gallery of giant posters.
for x in [-.7,.1,.9]:cube('Accessory slatted wall panel',x,2.25,-5.70,.70,3.7,.065,P['wood'])
label('Hat department sign','HEADWEAR / DETROIT',.1,3.52,-5.62,.18,P['black'])
for y in [1.45,2.22,2.95]:
 cube('Headwear floating wall shelf',.1,y,-5.24,2.5,.06,.70,P['wood'])
 cube('Headwear shelf LED',.1,y-.04,-4.92,2.36,.017,.02,P['warm'],0)
 for i in range(5):cap(-.9+i*.5,y+.048,-5.20,[P['cloth'],P['cream'],P['red']][i%3])
label('Hat department catalog note','CATALOG CONCEPTS / ONLINE AVAILABILITY',.1,1.06,-5.14,.069,P['black'])

# Clear accessory island; solid cabinetry, inset glass and modeled merchandise.
cube('Retail accessory island walnut cabinet',0,.61,-1.1,3.1,1.02,1.35,P['wood'])
cube('Accessory black toe recess',0,.17,-1.1,2.9,.17,1.19,P['black'])
cube('Accessory cream stone counter',0,1.15,-1.1,3.22,.075,1.47,P['ivory'])
for x in [-1.57,1.57]:cube('Accessory showcase side glazing',x,1.45,-1.1,.012,.54,1.44,P['glass'],0)
for z in [-1.81,-.39]:cube('Accessory showcase front and rear glazing',0,1.45,z,3.15,.54,.012,P['glass'],0)
cube('Accessory glass showcase top',0,1.73,-1.1,3.16,.012,1.43,P['glass'],0)
for x in [-1.57,1.57]:
 for z in [-1.80,-.40]:rod('Showcase fine brass upright',(x,1.19,z),(x,1.73,z),.009,P['gold'],8)
cube('Showcase interior linen pad',0,1.205,-1.1,3.05,.015,1.32,P['paper'])
for x in [-1.05,-.52]:
 cap(x,1.235,-1.3,P['cloth'])
 cube('Cap information card',x,1.235,-.6,.23,.025,.13,P['paper'])
for i in range(4):
 x=.18+i*.29
 rod('Armory eau de parfum bottle',(x,1.235,-1.40),(x,1.46,-1.40),.045,P['gold'],24)
 rod('Fragrance matte atomizer',(x,1.46,-1.40),(x,1.50,-1.40),.045,P['black'],20)
 label('Armory bottle label','ARMORY',x,1.35,-1.353,.012,P['black'])
for i in range(4):
 x=.18+i*.29;cube('Charm display padded block',x,1.235,-.72,.20,.05,.22,P['rubber'])
 bpy.ops.mesh.primitive_torus_add(major_radius=.033,minor_radius=.005,major_segments=20,minor_segments=8,location=(x,.72,1.286));o=bpy.context.object;o.name='Metal key charm ring';o.data.materials.append(P['gold'])
 for k in range(3):rod('Charm miniature chain link',(x,1.282,-.75-k*.021),(x,1.282,-.769-k*.021),.003,P['gold'],8)
 cube('GothTechnology luggage charm',x,1.282,-.86,.052,.012,.075,P['gold'],.004)
label('Accessory counter category','THE ARMORY / OBJECTS + SCENT',0,.84,-.411,.12,P['black'])
cube('Accessory island illuminated reveal',0,.40,-.412,2.95,.022,.009,P['warm'],0)

# Folded stacks, sizes, paper packaging and window mannequins.
for x in [-6.5,-3.75]:
 cube('Folded apparel shop display top',x,.87,.5,2.05,.09,1.25,P['wood'])
 for dx in [-.8,.8]:cube('Slim display table leg',x+dx,.47,.5,.06,.75,.94,P['black'])
 cube('Display table lower storage',x,.32,.5,1.94,.05,1.09,P['wood'])
 for i in range(3):
  for k in range(4):fold(x-.60+i*.6,.942+k*.056,.5,[P['cloth'],P['red'],P['cream']][i],True)
  cube('Folded clothing size stand',x-.6+i*.6,1.18,-.04,.21,.14,.018,P['paper'])
  label('Size stand labels',['S / M','L / XL','XXL'][i],x-.6+i*.6,1.19,-.025,.037,P['black'])
 for i in range(3):cube('Packaged apparel box',x-.62+i*.61,.42,.5,.48,.13,.64,P['paper'])
mannequin(-5.55,4.7,P,P['cloth']);mannequin(5.55,4.7,P,P['cream'])
for x in [-5.55,5.55]:
 cap(x,2.12,4.7,P['cloth']);label('Mannequin Detroit shirt graphic','DETROIT 2084',x,1.39,4.845,.05,P['gold'])
 # Thin curtain of timber uprights gives depth without closing the display bay.
 for i in range(9):cube('Window display vertical slats',x-1.7+i*.42,1.94,3.35,.045,3.04,.07,P['wood'])
 label('Window collection banner','DETROIT / THE COLLECTION',x,3.31,3.42,.14,P['gold'])

# Checkout: scanner cradle, receipt printer, card reader, bags and service sign.
cube('Checkout screen pedestal',5.85,1.28,-3.8,.20,.17,.18,P['steel'])
cube('Receipt printer housing',6.55,1.43,-3.64,.32,.22,.30,P['black'])
cube('Receipt paper outlet',6.55,1.49,-3.475,.25,.032,.007,P['paper'],0)
cube('Scanner cradle',4.9,1.32,-3.52,.20,.07,.17,P['black'])
rod('Checkout barcode scanner grip',(4.9,1.33,-3.53),(4.93,1.5,-3.55),.027,P['black'])
cube('Barcode scanner head',4.93,1.5,-3.55,.15,.07,.08,P['black'])
cube('Scanner red optical strip',4.93,1.502,-3.499,.11,.023,.008,P['red'])
for x in [7.13,7.51]:
 cube('GothTech paper shopping bag',x,1.48,-3.65,.28,.39,.15,P['paper'],.008)
 for dx in [-.08,.08]:rod('Shopping bag cord handle',(x+dx,1.67,-3.6),(x+dx,1.78,-3.6),.005,P['black'],8)
 rod('Shopping bag handle arch',(x-.08,1.78,-3.6),(x+.08,1.78,-3.6),.005,P['black'],8)
 label('Paper bag identity','GOTH',x,1.50,-3.569,.05,P['black'])
label('Service counter wayfinding','CHECKOUT / COLLECTION',5.9,3.55,-5.60,.23,P['black'])
label('Shop availability caption','CATALOG PREVIEW / AVAILABILITY ONLINE',5.9,3.21,-5.60,.093,P['black'])

# All approved catalog images in realistic wall lightboxes, with intact proportions.
catalog=json.loads((EXPORT/'boutique/catalog.json').read_text())
for i,p in enumerate(catalog):
 side=-1 if i<10 else 1;n=i if i<10 else i-10;z=-4.75+(n%5)*1.9;y=1.65+(n//5)*1.5;x=side*8.755
 texture=surface('Official GothTech '+p['title'],EXPORT/'boutique'/p['image']);before=set(bpy.context.scene.objects)
 framed_image('Official product lightbox '+p['title'],0,0,0,1.37,1.14,texture,P)
 label('Catalog product caption',p['title'][:30].upper(),0,-.68,.035,.045,P['black'])
 for o in set(bpy.context.scene.objects)-before:
  o.rotation_euler.z+=side*math.pi/2
  px,py,pz=o.location;o.location=(x-math.sin(side*math.pi/2)*py,-z+math.sin(side*math.pi/2)*px,y+pz)

label('Retail top brand wall','GOTHTECHNOLOGY',-4.9,4.06,-5.60,.36,P['black'])
label('Retail subline','DETROIT / WEAR YOUR WORLD',-4.9,3.80,-5.60,.105,P['black'])
report=finish('GothTech complete retail store',EXPORT/'boutique/GothTechnology-Store.glb','GothTech_Retail_20261003.blend')
(ART/'goth-retail-polish.json').write_text(json.dumps(report,indent=2));print('GOTHTECH_RETAIL_COMPLETE')

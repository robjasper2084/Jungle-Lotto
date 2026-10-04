"""Attached auction showroom and game kiosk, original modeled assets.
Retail references: Nintendo San Francisco demo stations (official photo gallery).
Reuses the approved Higgsfield materials; never overwrites the LottoMind master.
"""
import bpy, math, json
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
source=ROOT/'scripts/build_production_interiors.py'
scope={'__file__':str(source)}
exec(compile(source.read_text().split('\nreports=[]')[0],str(source),'exec'),scope)
bpy.ops.wm.read_factory_settings(use_empty=True)
P=scope['palette']()
cube,rod,ball,label,panel,floor=[scope[n] for n in ['cube','rod','ball','label','panel','floor']]
glass=scope['material']('Auction display glass',(.63,.82,.82),.12,.16)
glass.node_tree.nodes.get('Principled BSDF').inputs['Transmission Weight'].default_value=.72
glass.node_tree.nodes.get('Principled BSDF').inputs['Alpha'].default_value=.23
glass.diffuse_color=(.63,.82,.82,.23)
glass.surface_render_method='DITHERED'
wood=scope['floor_material']('Auction showroom walnut',True)
brick=scope['skin']('Auction Detroit brick','brick',.88,metres=1.25)
# Center u=10.8 in the LottoMind frame. The storefront is attached at u=6.7.
floor('Retail walnut plank floor',0,0,7.9,18.8,wood)
cube('Auction slab',0,-.20,0,8.05,.42,18.95,P['steel'])
cube('Right party wall',3.98,2.1,0,.16,4.2,18.8,P['ivory'])
cube('Shared LottoMind party wall',-3.98,2.1,0,.16,4.2,18.8,P['ivory'])
cube('Acoustic retail ceiling',0,4.2,0,8.0,.12,18.8,P['black'])
for side in [-1,1]:
 z=side*9.48
 for x in [-2.65,2.65]:
  cube('Glazed storefront frame',x,1.8,z,2.55,3.6,.16,P['steel'])
  cube('Tall storefront glass',x,1.85,z+side*.095,2.35,3.26,.025,glass)
  cube('Brick storefront base',x,.36,z,2.55,.72,.21,brick)
 cube('Doorway lintel',0,3.83,z,2.75,.55,.18,P['steel'])
 for x in [-1.38,1.38]:cube('Open portal jamb',x,1.65,z,.10,3.3,.25,P['gold'])
 # No door mesh or collider closes the 2.65 m portal.
 cube('Auction illuminated fascia',0,4.98,z,7.7,1.05,.25,P['black'])
 label('Auction fascia','PENNY / EXCHANGE',0,4.85,z+side*.16,.52,P['white'],0 if side==1 else math.pi)
 label('Retail subline','DETROIT MERCH  /  AUCTIONS',0,4.48,z+side*.16,.16,P['gold'],0 if side==1 else math.pi)
 cube('Entry canopy',0,3.52,z+side*.53,7.8,.12,1.1,P['black'])
for x in [-2.5,2.5]:
 for z in [-6,0,6]:
  cube('Linear ceiling diffuser',x,4.08,z,.075,.05,3.3,P['white'])
cube('Service counter',2.68,.61,-4.8,1.5,1.12,3.8,wood)
cube('Counter stone top',2.68,1.19,-4.8,1.64,.10,3.9,P['ivory'])
cube('Checkout monitor',2.65,1.54,-4.65,.65,.40,.065,P['black'])
label('Service desk sign','COLLECT / SUPPORT',2.72,2.25,-7.7,.24,P['black'])
for x,z in [(-2.35,-5),(-2.35,-1),(2.35,3.3)]:
 cube('Display pedestal',x,.52,z,1.7,.95,1.0,P['black'])
 cube('Display cabinet base trim',x,1.03,z,1.75,.08,1.05,P['gold'])
 cube('Display glass top',x,1.74,z,1.7,.018,1.0,glass)
 for xx in [-.83,.83]:cube('Display glass sides',x+xx,1.4,z,.018,.66,1.0,glass)
 for zz in [-.49,.49]:cube('Display glass face',x,1.4,z+zz,1.7,.66,.018,glass)
 # Physical merchandise display samples; exact sale inventory remains unconfirmed.
 cube('Folded Detroit shirt',x-.34,1.17,z,.58,.15,.52,P['cloth'])
 cube('Folded hoodie',x-.34,1.31,z,.58,.13,.51,P['cream'])
 label('Folded merch accent','DETROIT',x-.34,1.34,z+.267,.060,P['gold'])
 ball('Detroit cap crown',x+.37,1.23,z,.22,.13,.20,P['black'])
 cube('Detroit cap brim',x+.37,1.13,z+.17,.35,.025,.26,P['black'])
 label('Cap embroidery','313',x+.37,1.25,z+.195,.047,P['gold'])
 rod('Key charm display hook',(x+.61,1.09,z-.32),(x+.61,1.51,z-.32),.010,P['steel'])
 cube('Key charm body',x+.61,1.32,z-.31,.11,.19,.04,P['gold'])
 label('Display disclosure','DISPLAY SAMPLES',x,.75,z+.52,.13,P['white'])
for x,z in [(-2.35,3.3),(0,0)]:
 cube('Bidding terminal weighted foot',x,.12,z,.8,.18,.6,P['steel'])
 cube('Bidding terminal column',x,.73,z,.3,1.2,.3,P['black'])
 cube('Bidding terminal touchscreen bezel',x,1.5,z,.95,.68,.11,P['black'])
 cube('Bidding terminal screen',x,1.5,z+.065,.86,.57,.018,P['sage'])
 label('Bidding terminal title','PENNY EXCHANGE',x,1.62,z+.078,.09,P['black'])
 label('Bidding terminal prompt','TOUCH / BROWSE',x,1.42,z+.078,.078,P['black'])
 label('Bidding terminal disclaimer','OPEN THE AUCTION DESK',x,1.25,z+.078,.06,P['black'])
for x in [-3.85,3.85]:
 for y in [.24,3.55]:cube('Continuous showroom trim',x,y,0,.035,.045,18.5,P['gold'])
info=scope['finish']('Penny Exchange connected storefront',ROOT/'public/exports/atwater/penny-exchange.glb','Penny_Exchange.blend')
# Separate compact retail kiosk; arcade screen and joystick are interactive runtime meshes.
bpy.ops.wm.read_factory_settings(use_empty=True);P=scope['palette']()
cube('Retail demo pedestal',0,.56,0,1.24,1.08,.78,P['black'])
cube('Retail console service shelf',0,.86,.48,1.22,.08,.42,P['steel'])
cube('Demo kiosk upright',0,1.4,-.22,1.10,1.50,.13,P['black'])
cube('Retail kiosk lower accent',0,.15,.405,1.23,.14,.045,P['sage'])
cube('Retail demo screen housing',0,1.345,.20,.84,.57,.19,P['black'])
cube('Retail demo marquee',0,1.97,.03,1.24,.3,.36,P['black'])
label('Retail kiosk sign','DIGITAL STATIC / PLAY',0,1.91,.225,.075,P['white'])
label('Retail kiosk free play','2084 STATIC WAVE',0,.66,.411,.12,P['white'])
label('Retail kiosk disclosure','FREE PLAY',0,.45,.411,.10,P['gold'])
info2=scope['finish']('LottoMind playable retail game kiosk',ROOT/'public/exports/atwater/lotto-game-kiosk.glb','LottoMind_Game_Kiosk.blend')
(ROOT/'art/studio-retail/penny-assets.json').write_text(json.dumps([info,info2],indent=2))

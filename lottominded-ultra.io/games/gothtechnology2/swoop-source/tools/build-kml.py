from pathlib import Path
import json,math,html
R=Path(__file__).resolve().parents[1];O=R/'public/geospatial'
g=json.loads((R/'src/detroit/cut-geospatial.json').read_text());c=json.loads((R/'src/detroit/city-data.json').read_text());b=json.loads((O/'runtime-buildings.json').read_text())
def gps(p):
 x,z=p;return[-83.0399+(-.5*x-.8660254*z)/(111320*math.cos(math.radians(42.3283))),42.3283+(.8660254*x-.5*z)/111320]
def feature(name,points,kind,source,poly=False):
 coords=' '.join(f'{lon:.10f},{lat:.10f},0' for lon,lat in map(gps,points));lat,lon=g['origin']['gps']
 geom=f'<Polygon><altitudeMode>clampToGround</altitudeMode><outerBoundaryIs><LinearRing><coordinates>{coords}</coordinates></LinearRing></outerBoundaryIs></Polygon>' if poly else f'<LineString><tessellate>1</tessellate><altitudeMode>clampToGround</altitudeMode><coordinates>{coords}</coordinates></LineString>'
 return f'<Placemark><name>{html.escape(name)}</name><description>{html.escape(source)}</description><styleUrl>#{kind}</styleUrl>{geom}</Placemark>'
items=[feature('Motion 2 mapped Cut centerline',c['cut'],'trail','OSM mapped vertices; 2629.24 m route')]
items += [feature(x['name'],x['points'],'bridge',x['source'],True) for x in g['bridges']]
items += [feature(x['name'],x['points'],'ramp',x['source']) for x in g['ramps']]
items += [feature((x['name'] or 'Building')+' OSM '+x['id'],x['points'],'building','Exact active runtime footprint; tagged or estimated height',True) for x in b]
lat,lon=g['origin']['gps']
styles=''.join(f'<Style id="{k}"><LineStyle><color>{v}</color><width>2</width></LineStyle><PolyStyle><fill>0</fill></PolyStyle></Style>' for k,v in dict(trail='ff00ffff',bridge='ff0088ff',ramp='ffffff00',building='ff55ee77').items())
text=f'<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>Digital Static Motion 2 - mapped Cut v0.7</name><description>Active game geometry. Map data © OpenStreetMap contributors, ODbL 1.0. Visual satellite audit; no survey accuracy claim.</description><LookAt><longitude>{lon}</longitude><latitude>{lat}</latitude><range>2600</range><tilt>0</tilt><heading>0</heading><altitudeMode>clampToGround</altitudeMode></LookAt>{styles}'+''.join(items)+'</Document></kml>'
(O/'dequindre-map-audit.kml').write_text(text,encoding='utf-8')
print('KML:',len(items),'active game features')

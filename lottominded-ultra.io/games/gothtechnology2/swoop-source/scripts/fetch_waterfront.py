"""Read-only public OSM reference snapshot, projected with the game's existing datum."""
from pathlib import Path
import urllib.request, xml.etree.ElementTree as ET, json, math
root=Path(__file__).resolve().parents[1]; out=root/'art/waterfront'; out.mkdir(parents=True,exist_ok=True)
url='https://api.openstreetmap.org/api/0.6/map?bbox=-83.0405,42.3272,-83.0195,42.3375'
req=urllib.request.Request(url,headers={'User-Agent':'SwoopDetroit-local-asset-reference/1.0'})
import sys
raw=(out/'osm-reference-20261003.osm').read_bytes() if '--offline' in sys.argv else urllib.request.urlopen(req,timeout=45).read(); (out/'osm-reference-20261003.osm').write_bytes(raw)
xml=ET.fromstring(raw); nodes={n.attrib['id']:(float(n.attrib['lat']),float(n.attrib['lon'])) for n in xml.findall('node')}
def point(p):
 lat,lon=p; e=(lon+83.0399)*111320*math.cos(math.radians(42.3283)); n=(lat-42.3283)*111320
 return [round(-.5*e+.8660254*n,3),round(-.8660254*e-.5*n,3)]
ways=[]
for w in xml.findall('way'):
 tags={t.attrib['k']:t.attrib['v'] for t in w.findall('tag')}
 if not any(k in tags for k in ('building','highway','barrier','water','natural','leisure','man_made')):continue
 pts=[point(nodes[n.attrib['ref']]) for n in w.findall('nd') if n.attrib['ref'] in nodes]
 if len(pts)>1:ways.append({'id':w.attrib['id'],'tags':tags,'points':pts})
river=next(r for r in xml.findall('relation') if r.attrib['id']=='5678328'); shoreids={m.attrib['ref'] for m in river.findall('member') if m.attrib.get('role')=='outer'}
shore=[]
for w in xml.findall('way'):
 if w.attrib['id'] not in shoreids:continue
 pts=[point(nodes[n.attrib['ref']]) for n in w.findall('nd') if n.attrib['ref'] in nodes]
 if len(pts)>1 and any(-650<p[0]<100 and -2250<p[1]<350 for p in pts):shore.append({'id':w.attrib['id'],'points':pts})
gates=[{'id':n.attrib['id'],'point':point(nodes[n.attrib['id']])} for n in xml.findall('node') if any(t.attrib['k']=='barrier' and t.attrib['v'] in ('gate','lift_gate','swing_gate') for t in n.findall('tag'))]
result={'source':url,'retrieved':'2026-10-03','attribution':'© OpenStreetMap contributors, ODbL 1.0','shoreline':shore,'gates':gates,'ways':ways}
(out/'waterfront-reference.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
print(json.dumps({'ways':len(ways),'shoreline':[(w['id'],len(w['points'])) for w in shore],'buildings':sum('building' in w['tags'] for w in ways)},indent=2))

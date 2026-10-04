"""Public OSM site geometry in Swoop's existing metre datum. Read-only request."""
from pathlib import Path
import urllib.request,xml.etree.ElementTree as ET,json,math
root=Path(__file__).resolve().parents[1];out=root/'art/valade';out.mkdir(parents=True,exist_ok=True)
url='https://api.openstreetmap.org/api/0.6/map?bbox=-83.0228,42.3339,-83.0178,42.3366'
raw=urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'SwoopDetroit-local-asset-reference/1.0'}),timeout=45).read()
(out/'osm-reference-20261003.osm').write_bytes(raw)
xml=ET.fromstring(raw);nodes={n.attrib['id']:(float(n.attrib['lat']),float(n.attrib['lon'])) for n in xml.findall('node')}
def point(p):
 lat,lon=p;e=(lon+83.0399)*111320*math.cos(math.radians(42.3283));n=(lat-42.3283)*111320
 return [round(-.5*e+.8660254*n,3),round(-.8660254*e-.5*n,3)]
ways=[]
for w in xml.findall('way'):
 tags={t.attrib['k']:t.attrib['v'] for t in w.findall('tag')}
 if not any(k in tags for k in ('building','highway','water','leisure','natural','amenity','man_made','barrier')):continue
 pts=[point(nodes[n.attrib['ref']]) for n in w.findall('nd') if n.attrib['ref'] in nodes]
 if len(pts)>1:ways.append({'id':w.attrib['id'],'tags':tags,'points':pts})
features=[{'id':n.attrib['id'],'tags':{t.attrib['k']:t.attrib['v'] for t in n.findall('tag')},'point':point(nodes[n.attrib['id']])} for n in xml.findall('node') if n.findall('tag')]
data={'source':url,'retrieved':'2026-10-03','attribution':'© OpenStreetMap contributors, ODbL 1.0','ways':ways,'features':features}
(out/'reference.json').write_text(json.dumps(data,indent=2),encoding='utf-8')
print(json.dumps([{'id':w['id'],'tags':w['tags'],'center':[round(sum(p[k] for p in w['points'])/len(w['points']),1) for k in [0,1]],'points':len(w['points'])} for w in ways if w['tags'].get('highway') not in ('residential','tertiary','unclassified')],indent=2))

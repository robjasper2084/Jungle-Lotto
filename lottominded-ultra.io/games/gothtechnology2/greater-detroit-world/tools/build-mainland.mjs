// Run with Node 22.16+ from any working directory. Pass a cached GeoJSON as argv[2] for offline builds.
import {readFile,writeFile} from 'node:fs/promises';
import {sharedFromGeo,toShared,fromShared} from '../src/connectionMath.ts';

const root=new URL('../../',import.meta.url);
const read=async f=>JSON.parse(await readFile(new URL(f,root),'utf8'));
const city=await read('swoop-source/src/detroit/city-data.json');
const site=await read('elmwood-source/public/elmwood/site.json');
const dem=await read('elmwood-source/public/elmwood/terrain.json');
const placements=await read('elmwood-source/public/elmwood/placements.json');
const park=await read('belle-isle-source/game/public/belle/map.json');
const url=new URL('https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/Detroit_Street_Centerline_Map/FeatureServer/0/query');
url.search=new URLSearchParams({geometry:'-83.035,42.328,-82.996,42.351',geometryType:'esriGeometryEnvelope',inSR:'4326',spatialRel:'esriSpatialRelIntersects',outFields:'FID,STREETNAME,STREETTYPE',outSR:'4326',f:'geojson'}).toString();
const service=process.argv[2]?JSON.parse(await readFile(process.argv[2],'utf8')):await fetch(url).then(r=>{if(!r.ok)throw Error('Detroit GIS '+r.status);return r.json()});
if(!service.features?.length||service.exceededTransferLimit||service.properties?.exceededTransferLimit)throw Error('Incomplete Detroit street records');
const round=n=>Math.round(n*100)/100;
const point=({x,z})=>[round(x),round(z)];
const swoop=([x,z])=>point(toShared('swoop-detroit',{x,z}));
const elm=([x,north])=>point(toShared('elmwood',{x,z:-north}));
const project=([lon,lat])=>point(sharedFromGeo({lon,lat}));
const region=([x,z])=>x>=-2450&&x<=0&&z>=-820&&z<=1280;
const retained=new Set(['Jefferson','Mount Elliott','Lafayette','McDougall','Elmwood','Grand','Concord','Meldrum','Baldwin','Field','Saint Aubin','Chene','Walker','Beaufait']);
const roads=[];
for(const f of service.features){
 const p=f.properties,name=p.STREETNAME.trim(),points=f.geometry.coordinates.map(project);
 if(!retained.has(name)&&p.FID!==35667)continue;
 if(!points.some(region)||!points.every(([x,z])=>x>-2780&&x<210&&z<1600&&z> -1150))continue;
 // Grand on the actual ramp/deck already has Belle's cambered pavement.
 if(name==='Grand'&&points.some(([x,z])=>z>0))continue;
 roads.push({id:'city-'+p.FID,name:name||'Elmwood Cemetery entrance',width:name==='Jefferson'?14:name==='Grand'?10:8,points});
}
const known=new Set(park.roads.map(r=>r.id));
for(const r of city.roads){
 if(known.has(r.id)||!r.name||/motorway|construction|steps/.test(r.kind))continue;
 const points=r.points.map(swoop);
 if(!points.every(region)||!points.some(([x,z])=>x< -1150&&z>380))continue;
 if(r.name.includes('Jefferson')||r.name.includes('Lafayette')||r.name.includes('Mount Elliott')||r.name.includes('McDougall'))continue;
 // The lowered Cut and elevated freeways have separate vertical profiles.
 if(r.bridge||/Dequindre Cut|Freeway/.test(r.name))continue;
 roads.push({id:'swoop-'+r.id,name:r.name,width:Math.min(17,r.width),points});
}
for(const f of site.features.filter(f=>f.kind==='path'))roads.push({id:'elm-'+f.id,name:f.tags.name||'Elmwood cemetery lane',width:f.tags.highway==='footway'?2.6:5.8,points:f.points.map(elm)});
const buildings=[];
const knownBuildings=new Set(park.buildings.map(b=>b.id));
for(const b of city.buildings){
 const points=b.points.map(swoop);
 if(!knownBuildings.has(b.id)&&points.every(region)&&points.some(p=>p[0]< -820))buildings.push({id:b.id,height:b.height,points});
}
for(const b of site.features.filter(f=>f.kind==='building'&&!buildings.some(s=>s.id===f.id)))buildings.push({id:b.id,height:b.tags['building:levels']?3.4*Number(b.tags['building:levels']):7,points:b.points.map(elm)});
const water=site.features.filter(f=>f.kind==='water'&&f.points.length>3&&f.points[0][0]===f.points.at(-1)[0]).map(f=>f.points.map(elm));
const trees=[],stones=[];
for(const item of placements){
 const p=elm(item.position);
 if(/american-elm|walnut|maple|tour-(beech|birch|cedar|spruce|oak|pine)/.test(item.asset))trees.push(p);
 if(/headstone|obelisk|ledger/.test(item.asset))stones.push([...p,round(item.rotation||0)]);
}
// Resample the Elmwood DEM into the host axes. The grid blends gently into the
// existing game's relative ground at its edges. Values are centimetres above/below it.
const coords=site.boundary.map(elm),step=8;
const lo=(i)=>Math.floor((Math.min(...coords.map(p=>p[i]))-40)/step)*step;
const hi=(i)=>Math.ceil((Math.max(...coords.map(p=>p[i]))+40)/step)*step;
const x0=lo(0),z0=lo(1),nx=(hi(0)-x0)/step+1,nz=(hi(1)-z0)/step+1,heights=[];
for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){
 const {x,z}=fromShared('elmwood',{x:x0+i*step,z:z0+j*step});
 const u=(x-dem.x0)/dem.spacing,v=(dem.y0+z)/dem.spacing,a=Math.floor(u),b=Math.floor(v);
 const fade=Math.min(1,i/5,j/5,(nx-1-i)/5,(nz-1-j)/5,Math.max(0,Math.min(u,v,dem.width-u-1,dem.height-v-1))/10);
 let h=0;
 if(fade>0){const t=u-a,s=v-b,k=b*dem.width+a;h=(dem.heights[k]*(1-t)+dem.heights[k+1]*t)*(1-s)+(dem.heights[k+dem.width]*(1-t)+dem.heights[k+dem.width+1]*t)*s;}
 heights.push(Math.round(h*100*fade));
}
const gate=elm(site.features.find(f=>f.id==='624359679').points[8]);
const cut=swoop([246.53,-1248.54]);
const chapel=elm(site.features.find(f=>f.id==='313128826').points[0]);
// Carve the DEM out of the existing flat mainland and extend dry blocks as far as the mapped streets.
const {createRequire}=await import('node:module');
const requireGame=createRequire(new URL('belle-isle-source/game/package.json',root));
const clipping=requireGame('polygon-clipping');
const sorted=[...roads.flatMap(r=>r.points),...coords].sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
function chain(points){const hull=[];for(const p of points){while(hull.length>1&&cross(hull.at(-2),hull.at(-1),p)<=0)hull.pop();hull.push(p);}return hull.slice(0,-1);}
const box=[[x0,z0],[hi(0),z0],[hi(0),hi(1)],[x0,hi(1)]];
const hull=[...chain(sorted),...chain(sorted.toReversed())];
const geo=await read('swoop-source/public/geospatial/placements.json');
const cutLine=city.cut.map(swoop),greenway=[],west=[],east=[];
let travelled=0;
for(let i=0;i<cutLine.length-1;i++){
 const a=cutLine[i],b=cutLine[i+1],length=Math.hypot(b[0]-a[0],b[1]-a[1]),steps=Math.max(1,Math.ceil(length/5));
 for(let j=0;j<(i===cutLine.length-2?steps+1:steps);j++){
  const at=travelled+length*j/steps;
  const k=geo.profile.findIndex(p=>p.at>=at),hi=geo.profile[k<0?geo.profile.length-1:k],lo=geo.profile[Math.max(0,(k<0?geo.profile.length-1:k)-1)];
  const t=Math.min(1,Math.max(0,(at-lo.at)/(hi.at-lo.at||1)));
  const depth=((lo.street-lo.floor)*(1-t)+(hi.street-hi.floor)*t)*.3048;
  greenway.push([round(a[0]+(b[0]-a[0])*j/steps),round(a[1]+(b[1]-a[1])*j/steps),round(depth)]);
 }
 travelled+=length;
}
for(let i=0;i<greenway.length;i++){
 const [x,z]=greenway[i],a=greenway[Math.max(0,i-1)],b=greenway[Math.min(i+1,greenway.length-1)];
 const dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz)||1;
 west.push([round(x-dz*10/len),round(z+dx*10/len)]);
 east.push([round(x+dz*10/len),round(z-dx*10/len)]);
}
const trench=[...west,...east.toReversed()];
const bridges=geo.bridges.map(b=>({name:b.name,points:b.points.map(swoop)}));
const land=clipping.union([park.mainland],[hull],[box],[trench]);
const flat=clipping.difference(land,[box],[trench]);
// The two signed rides follow connected municipal segments. Include all bends,
 // with a shared junction at each municipal segment endpoint.
const graph=new Map();
for(const r of roads.filter(r=>r.id.startsWith('city-'))){
 for(let i=1;i<r.points.length;i++){
  const a=r.points[i-1],b=r.points[i];
  for(const [p,q] of [[a,b],[b,a]]){
   const key=p.join(','),edges=graph.get(key)||[];
   edges.push({q,cost:Math.hypot(p[0]-q[0],p[1]-q[1])});graph.set(key,edges);
  }
 }
}
function route(from,to){
 const nearest=p=>[...graph.keys()].map(k=>k.split(',').map(Number)).reduce((a,b)=>Math.hypot(a[0]-p[0],a[1]-p[1])<Math.hypot(b[0]-p[0],b[1]-p[1])?a:b).join(',');
 const start=nearest(from),end=nearest(to),cost=new Map([[start,0]]),prev=new Map(),queue=new Set([start]);
 while(queue.size){let node;for(const id of queue)if(node===undefined||cost.get(id)<cost.get(node))node=id;
  if(node===end)break;queue.delete(node);
  for(const {q,cost:dist} of graph.get(node)){const id=q.join(','),sum=cost.get(node)+dist;if(sum>=(cost.get(id)??Infinity))continue;prev.set(id,node);cost.set(id,sum);queue.add(id);}
 }
 if(!cost.has(end))throw Error('Disconnected Detroit GIS route to '+end);
 const path=[];for(let k=end;k;k=prev.get(k))path.unshift(k.split(',').map(Number));return path;
}
const junction=roads.find(r=>r.id==='city-27977').points.at(-1);
const gateRoad=site.features.find(f=>f.id==='624359679').points.map(elm);
const routes={
 cut:[park.bridge.b,park.bridge.a,...route(junction,cut),cut],
 elmwood:[cut,...route(cut,gateRoad.at(-1)),...gateRoad.toReversed()]
};
// Fill the gap between the two source maps from Detroit's mapped building polygons.
const buildingsURL='https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/BaseUnitFeatures/FeatureServer/2/query?geometry=-83.016,42.339,-83.000,42.349&geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=OBJECTID&outSR=4326&geometryPrecision=6&f=geojson';
const footprints=process.argv[3]?JSON.parse(await readFile(process.argv[3],'utf8')):await fetch(buildingsURL).then(r=>r.json());
if(!footprints.features?.length||footprints.properties?.exceededTransferLimit)throw Error('Building footprints unavailable or truncated');
const center=ring=>ring.reduce((p,q)=>[p[0]+q[0]/ring.length,p[1]+q[1]/ring.length],[0,0]);
const distance=(p,a,b)=>{const dx=b[0]-a[0],dz=b[1]-a[1];const t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dz)/(dx*dx+dz*dz||1)));return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dz);};
const existing=[...park.buildings,...buildings].map(b=>({center:center(b.points),ring:b.points}));
function insidePoint([x,z],ring){let yes=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;}
for(const f of footprints.features){
 if(f.geometry.type!=='Polygon')continue;
 const ring=f.geometry.coordinates[0].map(project),p=center(ring);
 if(p[0]<-1180||p[0]>50||!routes.cut.some((v,i)=>i&&distance(p,routes.cut[i-1],v)<125))continue;
 if(existing.some(b=>Math.hypot(b.center[0]-p[0],b.center[1]-p[1])<6||insidePoint(p,b.ring)||insidePoint(b.center,ring)))continue;
 buildings.push({id:'detroit-'+(f.properties.objectid??f.properties.OBJECTID),height:6.8,points:ring});
}
const models=placements.filter(p=>['elmwood-gatehouse','elmwood-entrance-sign','elmwood-chapel'].includes(p.asset)).map(p=>({asset:p.asset,point:elm(p.position),yaw:round(p.rotation-Math.atan(Math.tan((site.origin.longitude+81)*Math.PI/180)*Math.sin(site.origin.latitude*Math.PI/180))),scale:p.scale}));
const output={land,flat,routes,models,greenway,bridges,source:'City of Detroit street centerlines, OpenStreetMap contributors (ODbL), Swoop Detroit map and Elmwood USGS MI_WayneCo_2017 DEM',url:url.href,roads,buildings,water,trees,stones,gate,cut,chapel,grid:{x0,z0,nx,nz,step,heights}};
await writeFile(new URL('belle-isle-source/game/src/belle/detroitDistricts.json',root),JSON.stringify(output)+'\n');
console.log({roads:roads.length,buildings:buildings.length,trees:trees.length,stones:stones.length,gate,cut});

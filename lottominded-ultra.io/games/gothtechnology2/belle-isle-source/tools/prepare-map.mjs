import {applyRoadWidths} from './road-widths.mjs';
import {applyHeron} from './heron-layout.mjs';
import {applyOkonoka} from './okonoka-layout.mjs';
import {applyHistoricHouses} from './historic-houses-layout.mjs';
import {applyFacilities} from './facility-layout.mjs';
import {applyDossin} from './dossin-layout.mjs';
import {applyAquarium} from './aquarium-layout.mjs';
import {applyConservatory} from './conservatory-layout.mjs';
import fs from 'node:fs/promises';
import {applyMonuments} from './monument-catalog.mjs';
import {buildWaterTopology,dryArea} from './water-topology.mjs';
const root=new URL('../',import.meta.url);const src=JSON.parse(await fs.readFile(new URL('research/osm-features.json',root),'utf8'));const ways=new Map(src.filter(f=>f.type==='way').map(f=>[f.id,f]));
const origin=[-83.00175,42.34680],scale=111320;const project=([lon,lat])=>[+(scale*Math.cos(origin[1]*Math.PI/180)*(lon-origin[0])).toFixed(2),+(-scale*(lat-origin[1])).toFixed(2)];
function inside(p,poly){let c=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){let a=poly[i],b=poly[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])c=!c;}return c;}
function rings(f,role='outer'){if(f.type==='way')return role==='outer'?[f.points]:[];let pending=f.members.filter(m=>m.type==='way'&&m.role===role).map(m=>ways.get(m.ref)?.points).filter(p=>p?.length>2).map(p=>p.slice());let out=[];const eq=(a,b)=>a[0]===b[0]&&a[1]===b[1];while(pending.length){let p=pending.shift(),more=true;while(more&&!eq(p[0],p.at(-1))){more=false;for(let i=0;i<pending.length;i++){let q=pending[i];if(eq(p.at(-1),q.at(-1)))q=q.slice().reverse();if(eq(p.at(-1),q[0])){p.push(...q.slice(1));pending.splice(i,1);more=true;break;}}}if(eq(p[0],p.at(-1)))out.push(p);}return out;}
const island=ways.get('32613907').points.map(project);const outerIslets=[{id:'32613908',name:'Detroit Yacht Club islet',points:ways.get('32613908').points.map(project)}];const onIsland=p=>inside(p,island)||outerIslets.some(i=>inside(p,i.points));const mainA=project([-83.00060,42.34535]),mainB=project([-82.99648,42.33985]);const dx=mainB[0]-mainA[0],dz=mainB[1]-mainA[1],len=Math.hypot(dx,dz),ux=dx/len,uz=dz/len;const basis=(across,along)=>[mainA[0]+uz*across+ux*along,mainA[1]-ux*across+uz*along];const shoreline=[...ways.get('55477025').points,...ways.get('157713209').points.slice(1)].map(project);const inland=(p)=>[p[0]-ux*1800,p[1]-uz*1800];const mainland=[...shoreline,inland(shoreline.at(-1)),inland(shoreline[0])];const near=p=>onIsland(p)||(inside(p,mainland)&&Math.hypot(...p)<750);
const center=f=>{const pts=f.points.length?f.points:rings(f).flat();return pts.length?project(pts.reduce((s,p)=>[s[0]+p[0]/pts.length,s[1]+p[1]/pts.length],[0,0])):null};
let roads=[],buildings=[],water=[],areas=[],pois=[];const waterMember=new Set(src.filter(f=>f.type==='relation'&&f.tags.natural==='water').flatMap(f=>f.members.map(m=>m.ref)));
for(const f of src){const t=f.tags,p=f.points.map(project),c=center(f);if(f.type==='way'&&t.highway&&t.area!=='yes'&&p.some(near)&&!['construction','proposed','steps'].includes(t.highway)){const foot=['footway','path','cycleway','pedestrian','track','corridor'].includes(t.highway);roads.push({id:f.id,name:t.name||'Park path',points:p,width:(parseFloat(t.width)>0?Math.min(30,parseFloat(t.width)):foot?(t.highway==='cycleway'?3.6:t.footway==='sidewalk'?2:2.6):Math.min(18,Math.max(5,(+t.lanes||2)*3.15))),foot,bridge:!!t.bridge&&t.bridge!=='no'||+t.layer>0,surface:t.surface||(t.bridge==='covered'?'wood':t.footway==='sidewalk'||['footway','corridor','pedestrian'].includes(t.highway)?'concrete':['path','track'].includes(t.highway)?'ground':'asphalt'),surfaceEvidence:t.surface?'OSM surface tag':'Material inferred from route type',sidewalk:t.footway==='sidewalk',highway:t.highway,oneway:t.oneway==='yes'?1:t.oneway==='-1'?-1:0,lanes:+t.lanes||2,maxspeed:t.maxspeed||'',cycleSide:t['cycleway:left']?'left':t['cycleway:right']?'right':''});}
if(f.type==='way'&&t.area==='yes'&&t.highway&&p.some(onIsland))areas.push({id:f.id,name:t.name||'Pedestrian plaza',kind:'pedestrian',points:p});
if(f.type==='way'&&t.building&&c&&near(c))buildings.push({id:f.id,name:t.name||'',points:p,height:+t.height||(+t['building:levels']||1)*3.7,material:t['building:material']||'brick'});
if(t.natural==='water'&&(!waterMember.has(f.id)||f.type==='relation'))for(const ring of rings(f)){let rp=ring.map(project);if(rp.some(onIsland))water.push({id:f.id,name:t.name||'Lagoon',points:rp,holes:rings(f,'inner').map(r=>r.map(project))});}
if(f.type==='way'&&c&&onIsland(c)&&((t.leisure&&t.leisure!=='nature_reserve')||t.natural==='wood'||t.natural==='beach'||t.landuse==='forest'||t.landuse==='grass'))areas.push({id:f.id,name:t.name||'',kind:t.natural||t.leisure||t.landuse,points:p});
if(c&&onIsland(c)&&t.name&&(t.tourism||t.historic||t.building||t.amenity==='fountain'||t.man_made==='lighthouse'))pois.push({id:f.id,name:t.name.replaceAll('\u00a0',' '),x:c[0],z:c[1],kind:t.historic||t.tourism||t.man_made||'building',source:'OpenStreetMap',confidence:'mapped footprint or point; model dimensions approximate'});
}
const named=['106948123','107192915','107227742','107310050','264321737','107205459','659605208','107208288','368859182','509207568','106966327','106966337','106948207','9146545','4894381950'];
let landmarks=pois.filter(p=>named.includes(p.id));for(const id of ['107192915','264321737']){let f=ways.get(id),c=center(f);if(!landmarks.some(l=>l.id===id))landmarks.push({id,name:f.tags.name,x:c[0],z:c[1],kind:'building',source:'OpenStreetMap',confidence:'mapped footprint; dimensions approximate'});if(!buildings.some(b=>b.id===id))buildings.push({id,name:f.tags.name,points:f.points.map(project),height:(+f.tags['building:levels']||2)*3.7,material:'stucco'});}for(const [id,name] of [['368854132','Belle Isle Beach'],['882942799','Oudolf Garden Detroit'],['51476983','Lake Muskoday'],['32613819','Blue Heron Lagoon'],['420959','Lake Okonoka'],['420953','Lake Tacoma'],['842521472','Coast Guard Station']]){let f=src.find(f=>f.id===id),c=f&&center(f);if(c)landmarks.push({id,name,x:c[0],z:c[1],kind:'landscape',source:'OpenStreetMap',confidence:'mapped'});}
// Giant Slide has no mapped name. Locate the tagged playground slide, not an invented architectural position.
const slide=src.find(f=>f.tags.playground==='slide'&&center(f)&&onIsland(center(f)));if(slide){let c=center(slide);landmarks.push({id:slide.id,name:'Giant Slide',x:c[0],z:c[1],kind:'slide',outline:slide.points.map(project),source:'OSM playground geometry; official park map; Wikimedia exterior photograph',confidence:'Mapped outline; photo-informed reconstruction, dimensions approximate'});}
landmarks.push({id:'macarthur-overlook',name:'MacArthur Bridge overlook',x:495.75,z:787.1,kind:'viewpoint',source:'OSM path near island bridge approach',confidence:'safe mapped path viewpoint'});
// DNR May 2026: two-way cycle track on Casino Way and The Strand.
// Existing OSM widths count motor lanes only. Add a 3.4 m reconstruction allowance.
for(const r of roads)if(!r.foot&&['Casino Way','Strand Drive'].includes(r.name)){r.cycleTrack=true;r.width+=3.4;}
const traffic=src.filter(f=>f.type==='node'&&['crossing','stop','traffic_signals'].includes(f.tags.highway)&&f.points.length&&near(project(f.points[0]))).map(f=>({id:f.id,p:project(f.points[0]),kind:f.tags.highway,markings:f.tags['crossing:markings']||f.tags.crossing||'',direction:f.tags.direction||f.tags['traffic_signals:direction']||''}));
const waterwayRoutes=src.filter(f=>f.type==='way'&&f.tags.waterway==='canal'&&!f.tags.tunnel&&f.points.map(project).some(onIsland)).map(f=>({id:f.id,name:f.tags.name||'Island canal',points:f.points.map(project),width:+f.tags.width||8,widthEvidence:f.tags.width?'OSM width tag':'Approximate 8 m where no water polygon exists'}));
const waterSources=water;const hydro=buildWaterTopology(island,water,waterwayRoutes);water=hydro.water;
// Woodland multipolygons matter: Belle Isle Flatwoods is not a single tagged way.
for(const f of src.filter(f=>f.type==='relation'&&(f.tags.natural==='wood'||f.tags.landuse==='forest'))){let part=0;for(const ring of rings(f)){const points=ring.map(project);if(!points.some(onIsland))continue;for(const poly of dryArea(points,water))areas.push({id:f.id+'-'+part++,name:f.tags.name||'',kind:'wood',points:poly[0],holes:poly.slice(1)});}}
areas=areas.flatMap(a=>a.kind==='pedestrian'?dryArea(a.points,water).map((p,i)=>({...a,id:a.id+'-'+i,points:p[0],holes:p.slice(1)})):[a]);
const entranceSign={id:'11390626964',point:project([-83.0015405,42.346752]),direction:55,source:'OSM welcome sign; Alamy 2FM1TFX and Middle Journey photographs'};
pois.unshift({id:entranceSign.id,name:'Belle Isle Park welcome sign',x:entranceSign.point[0],z:entranceSign.point[1],kind:'entrance',source:entranceSign.source});
for(const c of waterwayRoutes.filter(c=>c.name!=='Island canal')){const p=c.points[Math.floor(c.points.length/2)];pois.push({id:c.id,name:c.name,x:p[0],z:p[1],kind:'water',source:'OpenStreetMap canal route'});}
for(const w of waterSources.filter(w=>/Model Yacht|Koi/.test(w.name))){const p=w.points.reduce((s,p)=>[s[0]+p[0]/w.points.length,s[1]+p[1]/w.points.length],[0,0]);pois.push({id:w.id,name:w.name,x:p[0],z:p[1],kind:'water',source:'OpenStreetMap water polygon'});}
const result={entranceSign,outerIslets,waterwayRoutes,waterSources,landPolygons:[...hydro.landPolygons,...outerIslets.map(i=>[i.points])],traffic,version:2,origin,axes:'x east, y up, z south; metres; river 0 m, island 2 m',source:'OpenStreetMap contributors; ODbL 1.0; downloaded 2026-11-01',island,mainland,shoreline,bridge:{a:mainA,b:mainB,length:len,width:26,arches:19},spawn:{x:0,z:0,heading:Math.atan2(dx,dz)},roads,buildings,water,areas,landmarks,pois};
applyMonuments(result,src);
applyConservatory(result);
applyAquarium(result);
applyDossin(result);
applyFacilities(result,src);
applyHistoricHouses(result);
applyOkonoka(result);
applyHeron(result);
applyRoadWidths(result);
await fs.mkdir(new URL('game/public/belle/',root),{recursive:true});await fs.writeFile(new URL('game/public/belle/map.json',root),JSON.stringify(result));await fs.writeFile(new URL('research/landmark-inventory.json',root),JSON.stringify(landmarks,null,2));console.log(JSON.stringify({bridge:len,roads:roads.length,buildings:buildings.length,water:water.length,landmarks:landmarks.map(l=>l.name)}));

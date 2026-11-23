import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const referenceDirectory=process.argv[2]||path.join(root,'research');
const map=JSON.parse(fs.readFileSync(path.join(root,'game/public/belle/map.json')));
const nodes=new Map(),ways=new Map();
const attrs=s=>Object.fromEntries([...s.matchAll(/([\w:]+)="([^"]*)"/g)].map(m=>[m[1],m[2]]));
const decode=s=>s.replaceAll('&amp;','&').replaceAll('&quot;','"').replaceAll('&apos;',"'");
for(let i=0;i<3;i++){
 const xml=fs.readFileSync(path.join(referenceDirectory,`windsor-waterfront-${i}.osm`),'utf8');
 for(const m of xml.matchAll(/<node\s([^>]+)>/g)){const a=attrs(m[1]);nodes.set(a.id,[+a.lon,+a.lat]);}
 for(const m of xml.matchAll(/<way\s([^>]+)>([\s\S]*?)<\/way>/g)){const a=attrs(m[1]),tags=Object.fromEntries([...m[2].matchAll(/<tag\s([^>]+)\/>/g)].map(v=>{const t=attrs(v[1]);return[t.k,decode(t.v)];}));if(tags.building||tags['building:part'])ways.set(a.id,{id:a.id,tags,refs:[...m[2].matchAll(/<nd ref="([^"]+)"/g)].map(v=>v[1])});}
}
const project=([lon,lat])=>[+( (lon-map.origin[0])*111320*Math.cos(map.origin[1]*Math.PI/180)).toFixed(2),+(-(lat-map.origin[1])*111320).toFixed(2)];
const buildings=[];
for(const w of ways.values()){
 const p=w.refs.map(r=>nodes.get(r));if(p.some(v=>!v)||p.length<4||w.refs[0]!==w.refs.at(-1))continue;
 const lon=p.reduce((s,v)=>s+v[0],0)/p.length,lat=p.reduce((s,v)=>s+v[1],0)/p.length;
 // South-bank corridor only. Do not duplicate Detroit or add far inland blocks.
 if(lon< -83.045||lon> -82.955||lat<42.316||lat>42.322+(lon+83.04)*.27)continue;
 const height=parseFloat(w.tags.height)||(+w.tags['building:levels']||3)*3.4,base=parseFloat(w.tags.min_height)||0;
 const points=p.map(project),area=Math.abs(points.slice(1).reduce((sum,q,i)=>sum+points[i][0]*q[1]-q[0]*points[i][1],0))/2;
 const shoreDistance=42.322+(lon+83.04)*.27-lat;
 if((height<12&&(area<700||shoreDistance>.004))||height<=base)continue;
 buildings.push({id:w.id,name:w.tags.name||'',points,height:+height.toFixed(2),base,part:!!w.tags['building:part'],material:w.tags['building:material']==='glass'||height>60?'glass':'stone',heightSource:w.tags.height?'OSM height':w.tags['building:levels']?'OSM levels, 3.4m per floor':'approximate 3-storey backdrop'});
}
const data={source:'OpenStreetMap contributors, ODbL 1.0',sourceUrl:'https://www.openstreetmap.org/copyright',retrieved:'2026-11-15',bounds:[[-83.045,42.316,-83.015,42.332],[-83.015,42.323,-82.985,42.34],[-82.985,42.328,-82.955,42.35]],buildings};
fs.writeFileSync(path.join(root,'game/src/belle/windsorSkyline.json'),JSON.stringify(data));
console.log('Windsor waterfront:',buildings.length,'mapped buildings;',buildings.filter(b=>b.height>50).map(b=>({name:b.name,height:b.height})));

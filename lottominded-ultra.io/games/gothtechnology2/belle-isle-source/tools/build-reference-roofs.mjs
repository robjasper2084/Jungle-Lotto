import fs from 'node:fs';
const base=new URL('../',import.meta.url),map=JSON.parse(fs.readFileSync(new URL('game/public/belle/map.json',base),'utf8'));
const xml=fs.readFileSync(new URL('research/detroit-skyline.osm',base),'utf8'),nodes=new Map();
const attributes=s=>Object.fromEntries([...s.matchAll(/([\w:]+)="([^"]*)"/g)].map(m=>[m[1],m[2]]));
const project=(lon,lat)=>[(lon-map.origin[0])*111320*Math.cos(map.origin[1]*Math.PI/180),-(lat-map.origin[1])*111320];
for(const match of xml.matchAll(/<node\s+([^>]+)>?/g)){const a=attributes(match[1]);nodes.set(a.id,project(Number(a.lon),Number(a.lat)));}
const ren=project(-83.03978,42.328964),roofs=[],features=[];
for(const match of xml.matchAll(/<way\s+([^>]+)>([\s\S]*?)<\/way>/g)){
 const tags=Object.fromEntries([...match[2].matchAll(/<tag\s+([^>]+)\/>/g)].map(m=>{const a=attributes(m[1]);return[a.k,a.v];}));
 const h=parseFloat(tags.height||String(parseFloat(tags['building:levels']||'3')*3.6));if(!tags.building&&!tags['building:part'])continue;
 const p=[...match[2].matchAll(/<nd ref="(\d+)"\/>/g)].map(m=>nodes.get(m[1])).filter(Boolean);if(p.length<4)continue;
 const x=p.slice(0,-1).reduce((s,p)=>s+p[0],0)/(p.length-1),z=p.slice(0,-1).reduce((s,p)=>s+p[1],0)/(p.length-1);
 features.push({tags,h,p,x,z,low:parseFloat(tags.min_height||'0')});
}
function inside(x,z,p){let c=false;for(let i=0,j=p.length-1;i<p.length;j=i++){const a=p[i],b=p[j];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])c=!c;}return c;}
const parts=features.filter(f=>f.tags['building:part']);
for(const f of features){if(Math.hypot(f.x-ren[0],f.z-ren[1])>220)continue;const children=f.tags['building:part']?[]:parts.filter(p=>p!==f&&inside(p.x,p.z,f.p));const h=children.length?Math.min(f.h,Math.max(3,Math.min(...children.map(p=>p.low)))):f.h;if(h<=90||h<=f.low)continue;roofs.push({height:h+2,points:f.p.map(p=>p.map(n=>Math.round(n*100)/100))});}
fs.writeFileSync(new URL('game/src/belle/referenceRoofs.json',base),JSON.stringify({source:'Existing Detroit OSM skyline footprints; Renaissance Center towers, visual trim only.',roofs},null,1)+'\n');
console.log('Mapped crown outlines:',roofs.length);

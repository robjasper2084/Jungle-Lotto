import fs from 'node:fs/promises';
import {dryArea} from './water-topology.mjs';
const base=new URL('../',import.meta.url),map=JSON.parse(await fs.readFile(new URL('game/public/belle/map.json',base),'utf8'));
const features=JSON.parse(await fs.readFile(new URL('research/osm-features.json',base),'utf8')),ways=new Map(features.filter(f=>f.type==='way').map(f=>[f.id,f]));
const relation=features.find(f=>f.type==='relation'&&f.id==='17884436');if(!relation)throw Error('Missing Belle Isle Flatwoods relation');
const pending=relation.members.filter(m=>m.role==='outer').map(m=>ways.get(m.ref)?.points.slice());if(pending.some(p=>!p))throw Error('Missing woodland member');
const rings=[],same=(a,b)=>a[0]===b[0]&&a[1]===b[1];
while(pending.length){const ring=pending.shift();let changed=true;while(changed&&!same(ring[0],ring.at(-1))){changed=false;for(let i=0;i<pending.length;i++){let q=pending[i];if(same(ring.at(-1),q.at(-1)))q=q.slice().reverse();if(same(ring.at(-1),q[0])){ring.push(...q.slice(1));pending.splice(i,1);changed=true;break;}}}if(!same(ring[0],ring.at(-1)))throw Error('Unclosed woodland boundary');rings.push(ring);}
const project=([lon,lat])=>[+(111320*Math.cos(map.origin[1]*Math.PI/180)*(lon-map.origin[0])).toFixed(2),+(-111320*(lat-map.origin[1])).toFixed(2)];
map.areas=map.areas.filter(a=>!a.id.startsWith('17884436-'));
let i=0;for(const ring of rings)for(const polygon of dryArea(ring.map(project),map.water))map.areas.push({id:'17884436-'+i++,name:'Belle Isle Flatwoods',kind:'wood',points:polygon[0],holes:polygon.slice(1),source:'OpenStreetMap relation 17884436; water-clipped woodland boundary'});
await fs.writeFile(new URL('game/public/belle/map.json',base),JSON.stringify(map));console.log('Restored flatwoods polygons:',i);

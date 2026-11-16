/** Read-only distribution inventory for existing deterministic nature placements.
 * It NEVER scatters objects into production or increases existing instance counts.
 * Collect all content-family counts without inventing a new material/LOD.
 */
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import zones from '../game/src/belle/environmentZones.json' with {type:'json'};
const root=resolve(import.meta.dirname,'..'),read=async p=>JSON.parse(await readFile(resolve(root,p),'utf8'));
const map=await read('game/public/belle/map.json');
const nature=await read('game/public/belle/nature/placements.json');
const treeManifest=await read('game/public/belle/nature/manifest.json');
const destination=(id,name)=>[...map.landmarks,...map.pois].find(p=>p.id===id&&p.name===name);
const locations=zones.zones.flatMap(zone=>zone.stops.map(stop=>({zone:zone.id,stop:stop.id,point:destination(stop.destinationId,stop.destinationName)})));
if(locations.some(s=>!s.point))throw Error('Zone audit requires all 8 mapped destinations');
const counters=Object.fromEntries(zones.zones.map(z=>[z.id,{trees:0,groundcover:0,treeVariants:{},groundVariants:{}}]));
const assign=(items,label,variantKey)=>{
 for(const plant of items){
  if(!Number.isFinite(plant.x)||!Number.isFinite(plant.z))throw Error('Invalid nature placement');
  const near=locations.reduce((best,item)=>Math.hypot(plant.x-item.point.x,plant.z-item.point.z)<Math.hypot(plant.x-best.point.x,plant.z-best.point.z)?item:best);
  const record=counters[near.zone];record[label]++;record[variantKey][plant.id]=(record[variantKey][plant.id]||0)+1;
 }
};
assign(nature.trees,'trees','treeVariants');assign(nature.ground,'groundcover','groundVariants');
const report={stage:'read-only; existing LOD/atlas assets unchanged',zones:counters,treeCount:nature.trees.length,groundCount:nature.ground.length,treeSpecies:treeManifest.trees?.map(t=>({id:t.id,triangles:t.triangles})),groundAssets:treeManifest.ground?.map(t=>({id:t.id,triangles:t.triangles})),createdAt:new Date().toISOString()};
if(Object.values(counters).some(c=>c.trees===0))throw Error('At least one zone lacks assigned existing trees; review map and placement coverage');
const output=resolve(root,'game/output/island-zones/distribution.json');
await mkdir(resolve(root,'game/output/island-zones'),{recursive:true});await writeFile(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({zoneCount:Object.keys(counters).length,trees:nature.trees.length,ground:nature.ground.length,output}));

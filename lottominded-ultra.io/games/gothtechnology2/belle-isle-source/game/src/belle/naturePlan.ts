import {inside,segment,ParkTerrain,type ParkMap,type Point} from './terrain.ts';
export type Plant={id:string;x:number;y:number;z:number;scale:number;heightScale?:number;yaw:number;tint:number};
export type NaturePlan={version:1;trees:Plant[];ground:Plant[];placementEvidence:string};
export const natureBudget={smooth:{trees:20,treeRadius:75,ground:160,groundRadius:35},automatic:{trees:36,treeRadius:105,ground:360,groundRadius:55},high:{trees:48,treeRadius:140,ground:560,groundRadius:75}};
// Executed at build time. No polygon tests or thousands of route scans on a ride.
export function makeNaturePlan(map:ParkMap):NaturePlan{
 const terrain=new ParkTerrain(map);let seed=72621;
 const rand=()=>{seed=Math.imul(seed,1664525)+1013904223|0;return(seed>>>0)/4294967296;};
 const round=(v:number)=>Math.round(v*1000)/1000;
 const trees:Plant[]=[],ground:Plant[]=[];
 const roads=map.roads.flatMap(r=>r.points.slice(1).map((b,i)=>({a:r.points[i],b,w:r.width}))) ;
 const shore=[map.island,...map.water.map(w=>w.points)].flatMap(p=>p.slice(1).map((b,i)=>({a:p[i],b})));
 const noPlants=map.areas.filter(a=>['pitch','track','pedestrian','playground','golf_course','swimming_pool','outdoor_seating','fitness_station','beach','marina'].includes(a.kind));
 const woods=map.areas.filter(a=>['wood','forest'].includes(a.kind));
 const gardens=map.areas.filter(a=>a.kind==='garden');
 const ringDistance=(x:number,z:number,p:Point[])=>Math.min(...p.slice(1).map((b,i)=>segment(x,z,p[i],b).d));
 function clear(x:number,z:number,margin:number){
  if(!inside(x,z,map.island)||!terrain.land(x,z)||terrain.bridge(x,z).active)return false;
  if(map.entranceSign&&Math.hypot(x-map.entranceSign.point[0],z-map.entranceSign.point[1])<14)return false;
  if((map.monuments||[]).some(m=>Math.hypot(x-m.x,z-m.z)<m.radius+margin+1))return false;
  if(noPlants.some(a=>inside(x,z,a.points)))return false;
  if(map.buildings.some(b=>inside(x,z,b.points)||ringDistance(x,z,b.points)<margin+1))return false;
  return !roads.some(r=>segment(x,z,r.a,r.b).d<r.w/2+margin);
 }
 function plant(id:string,x:number,z:number,scale:number):Plant{return{id,x:round(x),y:round(terrain.height(x,z)),z:round(z),scale:round(scale),yaw:round(rand()*Math.PI*2),tint:round(.88+rand()*.16)};}
 for(let attempt=0;attempt<22000&&trees.length<1300;attempt++){
  const x=-450+rand()*4450,z=-750+rand()*2450;
  if(!clear(x,z,4))continue;
  const woodland=woods.some(a=>inside(x,z,a.points));
  if(!woodland&&rand()>.26)continue;
  if(gardens.some(a=>inside(x,z,a.points)))continue;
  if(trees.some(t=>Math.hypot(t.x-x,t.z-z)<7))continue;
  const wet=shore.some(s=>segment(x,z,s.a,s.b).d<32),r=rand();
  const type=wet&&r<.68?'willow':r<.48?'maple':r<.85?'birch':'pine';
  trees.push(plant(type,x,z,.62+rand()*.42));
 }
 // Beach approach: soften the empty rear lawns with irregular canopy groups.
 // Positions are artistic planting inside mapped land, not a tree survey.
 const beach=map.areas.find(a=>a.id==='368854132');
 if(beach){let planted=0;for(let attempt=0;attempt<700&&planted<30;attempt++){
  const x=1740+rand()*350,z=65+rand()*365,near=ringDistance(x,z,beach.points);
  if(near<6||near>55||!clear(x,z,4)||trees.some(t=>Math.hypot(t.x-x,t.z-z)<10))continue;
  trees.push(plant(rand()<.65?'willow':'maple',x,z,.65+rand()*.3));planted++;
 }}
 // FDR's Okonoka aerial photographs show wooded islands. Reuse the existing
 // tree assets and near-detail budget; retain every mapped island outline.
 const okonoka=map.waterSources?.find(w=>w.id==='420959');
 for(const island of okonoka?.holes||[]){
  const xs=island.map(p=>p[0]),zs=island.map(p=>p[1]);let planted=0;
  for(let attempt=0;attempt<400&&planted<18&&trees.length<1300;attempt++){
   const x=Math.min(...xs)+rand()*(Math.max(...xs)-Math.min(...xs)),z=Math.min(...zs)+rand()*(Math.max(...zs)-Math.min(...zs));
   if(!inside(x,z,island)||ringDistance(x,z,island)<2.5||!clear(x,z,4)||trees.some(t=>Math.hypot(t.x-x,t.z-z)<6))continue;
   trees.push(plant(rand()<.6?'willow':rand()<.6?'maple':'birch',x,z,.6+rand()*.32));planted++;
  }
 }
 // Supplied Blue Heron aerials show a wooded fringe, not a bare lawn bank.
 const heron=map.waterSources?.find(w=>w.id==='32613819');let heronTrees=0;
 if(heron)for(let attempt=0;attempt<1800&&heronTrees<55&&trees.length<1300;attempt++){
  const edge=Math.floor(rand()*(heron.points.length-1)),a=heron.points[edge],b=heron.points[edge+1],t=rand(),angle=rand()*Math.PI*2,offset=5+rand()*22;
  const x=a[0]+(b[0]-a[0])*t+Math.cos(angle)*offset,z=a[1]+(b[1]-a[1])*t+Math.sin(angle)*offset;
  if(!clear(x,z,4)||ringDistance(x,z,heron.points)<3||trees.some(p=>Math.hypot(p.x-x,p.z-z)<8))continue;
  trees.push(plant(rand()<.6?'willow':'maple',x,z,.6+rand()*.35));heronTrees++;
 }
 // Near-path meadow patches, not uniform flower rows. Measured lawn/wood polygons
 // constrain planting; individual plants/species are an artistic reconstruction.
 for(let attempt=0;attempt<15000&&ground.length<3800;attempt++){
  const tree=trees[Math.floor(rand()*trees.length)];if(!tree)break;
  const a=rand()*Math.PI*2,r=2+rand()*22,x=tree.x+Math.cos(a)*r,z=tree.z+Math.sin(a)*r;
  if(!clear(x,z,1.4))continue;
  const n=1+Math.floor(rand()*3),flower=rand()<.20;
  ground.push(plant((flower?'dandelion_':'grass_')+n,x,z,flower?1.2+rand()*1.3:1.7+rand()*1.4));
 }
 // Purple flowering groundcover is confined to planted garden areas. This is
 // visual variety, not a claim that this imported species grows at each site.
 for(const garden of gardens){
  const xs=garden.points.map(p=>p[0]),zs=garden.points.map(p=>p[1]);
  for(let i=0;i<90;i++){
   const x=Math.min(...xs)+rand()*(Math.max(...xs)-Math.min(...xs)),z=Math.min(...zs)+rand()*(Math.max(...zs)-Math.min(...zs));
   if(!inside(x,z,garden.points)||!clear(x,z,1.4))continue;
   ground.push(plant('periwinkle_'+(1+Math.floor(rand()*3)),x,z,1.2+rand()*1.2));
  }
 }
 let rocks=0;
 for(const edge of shore){
  const dx=edge.b[0]-edge.a[0],dz=edge.b[1]-edge.a[1],length=Math.hypot(dx,dz);
  for(let d=8;d<length&&rocks<260;d+=18+rand()*22){
   const t=d/length;
   for(const side of [-1,1]){
    const x=edge.a[0]+dx*t+side*dz/length*2.8,z=edge.a[1]+dz*t-side*dx/length*2.8;
    if(!clear(x,z,2.5))continue;
    const p=plant('rock_'+(1+Math.floor(rand()*3)),x,z,.26+rand()*.36);p.y-=.12;
    ground.push(p);rocks++;break;
   }
  }
 }
 for(let i=0;i<trees.length;i++){const p=trees[i];p.scale=round(.86+rand()*.38);p.heightScale=round(1.16+rand()*.25);}
 return{version:1,trees,ground,placementEvidence:'Mapped woodland/garden/water polygons; plant species and exact positions approximated. Roads, landmarks, sports and play areas kept clear.'};
}

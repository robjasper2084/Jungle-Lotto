import type {ParkMap} from './terrain.ts';

type Pose={x:number;z:number;headingY:number;speed:number};
type MapLocation=Readonly<{x:number;z:number;accuracy:number}>;
export type ReferenceMapOverlay={
 position:()=>MapLocation|null|undefined;
 draw:(ctx:CanvasRenderingContext2D,px:(x:number)=>number,pz:(z:number)=>number)=>void;
};
/** Keep a live location and its uncertainty inside the circular map's label margin. */
export function referenceLocationRange(selected:number,pose:Pick<Pose,'x'|'z'>,location?:MapLocation|null){
 if(!location||![pose.x,pose.z,location.x,location.z,location.accuracy].every(Number.isFinite)||location.accuracy<0)return selected;
 const extent=Math.hypot(location.x-pose.x,location.z-pose.z)+location.accuracy;
 return Math.max(selected,Math.ceil(extent/.7/50)*50);
}
function mapBounds(points:readonly [number,number][]){
 let minX=Infinity,minZ=Infinity,maxX=-Infinity,maxZ=-Infinity;
 for(const [x,z] of points){minX=Math.min(minX,x);minZ=Math.min(minZ,z);maxX=Math.max(maxX,x);maxZ=Math.max(maxZ,z);}
 return {minX,minZ,maxX,maxZ};
}
/** North-up local navigation, drawn from the same mapped geometry as the full island guide. */
export function createReferenceHud(map:ParkMap,overlay?:ReferenceMapOverlay){
 const panel=document.createElement('section');panel.id='reference-hud';panel.setAttribute('aria-label','Local navigation');
 panel.innerHTML='<button type="button" class="reference-map" aria-label="Change local map range"><canvas width="320" height="320" role="img" aria-label="Local island map, north at the top"></canvas><span>N ↑</span><small>350 m</small></button><div class="reference-readout"><output class="reference-speed" aria-label="Speed">0 <small>MPH</small></output><strong class="reference-place"></strong><span class="reference-objective"></span></div>';
 document.body.append(panel);panel.hidden=true;
 const canvas=panel.querySelector('canvas')!,ctx=canvas.getContext('2d')!,button=panel.querySelector('button')!,rangeLabel=button.querySelector('small')!,ranges=[350,700,180];let index=0;
 button.onclick=()=>{index=(index+1)%ranges.length;rangeLabel.textContent=ranges[index]+' m';button.setAttribute('aria-label',`Local map range ${ranges[index]} metres. Click to change range.`);};
 const speed=panel.querySelector('.reference-speed')!,place=panel.querySelector('.reference-place')!,objective=panel.querySelector('.reference-objective')!;
 const land='#657554',water='#254a59';
 const polygons=[
  {points:map.island,fill:land},
  ...(map.outerIslets||[]).map(i=>({points:i.points,fill:land})),
  ...map.water.flatMap(w=>[{points:w.points,fill:water},...w.holes.map(points=>({points,fill:land}))])
 ].map(p=>({...p,bounds:mapBounds(p.points)}));
 const roads=map.roads.map(road=>({road,bounds:mapBounds(road.points)}));
 return{update(p:Pose,visible:boolean,destination:{x:number;z:number;name:string}|undefined,location:string,competition:boolean){
  panel.hidden=!visible;panel.classList.toggle('reference-competition',competition);if(!visible)return;
  const range=referenceLocationRange(ranges[index],p,overlay?.position()),scale=160/range,px=(x:number)=>160+(x-p.x)*scale,pz=(z:number)=>160+(z-p.z)*scale;
  rangeLabel.textContent=range+' m'+(range>ranges[index]?' · GPS':'');
  button.setAttribute('aria-label',`Local map range ${range} metres. Click to change range.`);
  ctx.clearRect(0,0,320,320);ctx.fillStyle='#254a59';ctx.fillRect(0,0,320,320);
  const polygon=(points:readonly [number,number][],fill:string)=>{ctx.beginPath();points.forEach((v,i)=>i?ctx.lineTo(px(v[0]),pz(v[1])):ctx.moveTo(px(v[0]),pz(v[1])));ctx.closePath();ctx.fillStyle=fill;ctx.fill();};
  const intersects=(b:ReturnType<typeof mapBounds>,radius:number)=>
   b.minX<=p.x+radius && b.maxX>=p.x-radius && b.minZ<=p.z+radius && b.maxZ>=p.z-radius;
  const pixel=1/scale;
  for(const shape of polygons)if(intersects(shape.bounds,range+pixel))polygon(shape.points,shape.fill);
  for(const {road,bounds} of roads){
   const width=road.foot?1.2:Math.max(2,road.width*scale);
   // Keep the antialiased edge and even the longest allowed miter at bends.
   if(!intersects(bounds,range+pixel*(1+width*ctx.miterLimit)))continue;
   ctx.strokeStyle=road.foot?'#aeac86':'#e9d1a9';ctx.lineWidth=width;
   ctx.beginPath();road.points.forEach((v,i)=>i?ctx.lineTo(px(v[0]),pz(v[1])):ctx.moveTo(px(v[0]),pz(v[1])));ctx.stroke();
  }
  for(const l of map.landmarks){ctx.fillStyle='#e6c880';ctx.beginPath();ctx.arc(px(l.x),pz(l.z),3,0,Math.PI*2);ctx.fill();}
  if(destination){const dx=destination.x-p.x,dz=destination.z-p.z,d=Math.hypot(dx,dz),f=Math.min(1,range*.85/Math.max(1,d));ctx.strokeStyle='#ffcf79';ctx.lineWidth=2;ctx.setLineDash([5,6]);ctx.beginPath();ctx.moveTo(160,160);ctx.lineTo(160+dx*scale*f,160+dz*scale*f);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle='#ffcf79';ctx.beginPath();ctx.arc(160+dx*scale*f,160+dz*scale*f,7,0,Math.PI*2);ctx.fill();}
  ctx.save();ctx.translate(160,160);ctx.rotate(-p.headingY);ctx.fillStyle='#a0fffa';ctx.strokeStyle='#15232c';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(0,13);ctx.lineTo(-9,-10);ctx.lineTo(0,-5);ctx.lineTo(9,-10);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();
  // GPS is local presentation only; draw after the game rider so a matching
  // position stays visible. The overlay owns validity and clears itself on Stop.
  overlay?.draw(ctx,px,pz);
  speed.innerHTML=Math.round(Math.abs(p.speed)*2.23694)+' <small>MPH</small>';place.textContent=location;
  objective.textContent=competition?'Follow the numbered gates':destination?`${destination.name} · ${Math.round(Math.hypot(destination.x-p.x,destination.z-p.z))} m`:'Explore Belle Isle';
 }};
}

import type {BeachProfile} from './beachProfile.ts';

/** Deterministic, sparse coastal dressing based on the mapped beach footprint.
 * This is visualization only: no new ride collision solids, texture downloads
 * or user-generated/random placements during gameplay.
 */
export type BeachDecoration={x:number;y:number;z:number;yaw:number;sx:number;sy:number;sz:number;color:number};
export type BeachDetailGround={height:(x:number,z:number)=>number;land:(x:number,z:number)=>boolean;obstructed:(x:number,z:number,margin:number)=>boolean};
export const BEACH_DETAIL_CAPS={stones:170,grasses:230,driftwood:30} as const;

function inside(x:number,z:number,p:readonly (readonly [number,number])[]){
 let isInside=false;
 for(let i=0,j=p.length-1;i<p.length;j=i++){
  const a=p[i],b=p[j];
  if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])isInside=!isInside;
 }
 return isInside;
}

export function planBeachDetails(profiles:readonly BeachProfile[],ground:BeachDetailGround,roadBlocked:(x:number,z:number,margin:number)=>boolean=()=>false){
 const stones:BeachDecoration[]=[],grasses:BeachDecoration[]=[],driftwood:BeachDecoration[]=[];
 let seed=0x0b31e15e;
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)|0;return(seed>>>0)/4294967296;};
 const stoneColors=[0x9f9688,0x7d807a,0xb3a89b,0x8a8580],grassColors=[0x898f61,0x777f4f,0x9c9872,0x747d54],woodColors=[0x846d55,0x67584b,0x988268];
 for(const profile of profiles)for(const [coastal,edges] of [[true,profile.waterside],[false,profile.back]] as const){
  for(const edge of edges){
   const dx=edge.b[0]-edge.a[0],dz=edge.b[1]-edge.a[1],length=Math.hypot(dx,dz);
   if(length<2.5)continue;
   const tx=dx/length,tz=dz/length,nx=tz,nz=-tx,steps=Math.min(400,Math.ceil(length/5.4));
   for(let i=0;i<steps;i++){
    const t=(i+.20+random()*.60)/steps,x=edge.a[0]+dx*t,z=edge.a[1]+dz*t;
    const inward=inside(x+nx*1.2,z+nz*1.2,profile.points)?1:inside(x-nx*1.2,z-nz*1.2,profile.points)?-1:0;
    if(!inward)continue;
    const roll=random();
    const kind=coastal?(roll<.34?'stone':roll<.40?'wood':'none'):(roll<.52?'grass':roll<.64?'stone':roll<.69?'wood':'none');
    if(kind==='none')continue;
    if(kind==='stone'&&stones.length>=BEACH_DETAIL_CAPS.stones||kind==='grass'&&grasses.length>=BEACH_DETAIL_CAPS.grasses||kind==='wood'&&driftwood.length>=BEACH_DETAIL_CAPS.driftwood)continue;
    const offset=coastal?1.6+random()*4.2:1+random()*4.4,along=(random()-.5)*1.5;
    const px=x+nx*inward*offset+tx*along,pz=z+nz*inward*offset+tz*along;
    if(!inside(px,pz,profile.points)||!ground.land(px,pz))continue;
    const margin=kind==='wood'?.6:kind==='grass'?.5:.4;
    if(roadBlocked(px,pz,margin+1)||ground.obstructed(px,pz,margin))continue;
    const y=ground.height(px,pz),yaw=random()*Math.PI*2;
    if(kind==='stone'){
     const r=.14+random()*.25;
     stones.push({x:px,y:y+r*.16,z:pz,yaw,sx:r*(1.1+random()*.6),sy:r*.42,sz:r,color:stoneColors[Math.floor(random()*stoneColors.length)]});
    }else if(kind==='grass'){
     const size=.85+random()*.8;
     grasses.push({x:px,y:y+.014,z:pz,yaw,sx:size,sy:.45+random()*.38,sz:size,color:grassColors[Math.floor(random()*grassColors.length)]});
    }else{
     const size=1.0+random()*1.7;
     driftwood.push({x:px,y:y+.09,z:pz,yaw,sx:size,sy:.23+random()*.13,sz:.22+random()*.14,color:woodColors[Math.floor(random()*woodColors.length)]});
    }
   }
  }
 }
 return{stones,grasses,driftwood};
}

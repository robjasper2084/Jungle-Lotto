import {SegmentIndex} from './segmentIndex.ts';
import R from '@dimforge/rapier3d-compat';
import {bankHeight,type BankSurface} from './elmwood-bank.ts';
import {makeElmwoodCurbs,curbContains,ELMWOOD_GATE,ELMWOOD_YOUNG,ELMWOOD_PARKING,inRing,type Curb} from './elmwood-details.ts';
import type {TerrainSampler,GroundSample,Vec3,ObstacleHit} from '../simulation/world.ts';
export type ElmwoodGrid={width:number;height:number;x0:number;y0:number;spacing:number;heights:number[]};
type Feature={id:string;kind:string;points:number[][];tags:Record<string,string>};
type Placement={asset:string;position:number[];rotation:number;scale:number;layer:string;footprint?:number[];bankSurface?:BankSurface};
type Segment={a:number[];b:number[];feature:Feature};
export function inElmwoodPond(x:number,north:number,features:Feature[]){
 for(const f of features.filter(f=>f.tags.water==='pond')){let inside=false;for(let i=0,j=f.points.length-1;i<f.points.length;j=i++){
  const a=f.points[i],b=f.points[j];if((a[1]>north)!=(b[1]>north)&&x<(b[0]-a[0])*(north-a[1])/(b[1]-a[1])+a[0])inside=!inside;
 }if(inside)return true;}return false;
}
/** Uses the same DEM, path offsets and bridge transitions as the visible foundation. */
export class ElmwoodTerrain implements TerrainSampler{
 physics!:R.World;segments:Segment[]=[];private laneIndex:SegmentIndex;decks=new Map<string,number>();
 curbs:Curb[]=[];curbTiles=new Map<string,Curb[]>();
 readonly banks:Placement[];
 readonly grid:ElmwoodGrid;readonly features:Feature[];readonly placements:Placement[];
 constructor(grid:ElmwoodGrid,features:Feature[],placements:Placement[]){
  this.grid=grid;this.features=features;this.placements=placements.filter(p=>p.layer==='mapped'||Math.hypot(p.position[0]-ELMWOOD_YOUNG.x,p.position[1]-ELMWOOD_YOUNG.north)>4);
  this.banks=this.placements.filter(p=>p.bankSurface);
  this.curbs=makeElmwoodCurbs(features);for(const c of this.curbs){const x=Math.floor(c.x/10),n=Math.floor(c.north/10);for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++){const key=(x+i)+','+(n+j),bucket=this.curbTiles.get(key)??[];bucket.push(c);this.curbTiles.set(key,bucket);}}
  for(const f of features.filter(f=>f.kind==='path')){
   if(f.tags.bridge==='yes'){const h=Math.max(...f.points.map(p=>this.ground(p[0],p[1])))+.25;this.decks.set(f.points[0].slice(0,2).join(','),h);this.decks.set(f.points.at(-1)!.slice(0,2).join(','),h);}
   for(let i=1;i<f.points.length;i++)this.segments.push({a:f.points[i-1],b:f.points[i],feature:f});
  }
  this.laneIndex=new SegmentIndex(this.segments.map(s=>({ax:s.a[0],ay:s.a[1],bx:s.b[0],by:s.b[1]})));
 }
 async init(){await R.init();this.physics=new R.World({x:0,y:-9.81,z:0});
  const young=ELMWOOD_YOUNG;this.physics.createCollider(R.ColliderDesc.cuboid(1.05,.86,.43).setTranslation(young.x,this.ground(young.x,young.north)+.86,-young.north).setRotation({x:0,y:Math.sin(young.heading/2),z:0,w:Math.cos(young.heading/2)}));
  for(const side of [-1,1]){const x=ELMWOOD_GATE.x+Math.cos(ELMWOOD_GATE.heading)*side*(ELMWOOD_GATE.opening/2+.4),n=ELMWOOD_GATE.north+Math.sin(ELMWOOD_GATE.heading)*side*(ELMWOOD_GATE.opening/2+.4);this.physics.createCollider(R.ColliderDesc.cuboid(.55,1.5,.55).setTranslation(x,this.ground(x,n)+1.5,-n));}
  for(const f of this.features.filter(f=>f.kind==='building')){const v:number[]=[];const z=Math.min(...f.points.map(p=>p[2]));for(const dz of [0,12])for(const p of f.points)v.push(p[0],z+dz,-p[1]);const hull=R.ColliderDesc.convexHull(new Float32Array(v));if(hull)this.physics.createCollider(hull);}
  for(const p of this.placements.filter(p=>p.layer==='estimated')){const tree=['white-oak','red-maple','american-elm','white-pine','weeping-willow','black-walnut','tour-beech','tour-birch','tour-spruce','tour-cedar','tour-flowering'].includes(p.asset);const d=tree?R.ColliderDesc.cylinder(2,.65*p.scale):R.ColliderDesc.cuboid(.6*p.scale,p.asset==='ledger'?.15:p.scale,p.asset==='ledger'?1.05*p.scale:.45*p.scale);d.setTranslation(p.position[0],p.position[2]+(tree?2:p.asset==='ledger'?.15:p.scale),-p.position[1]);this.physics.createCollider(d);}
  for(const p of this.placements){if(!p.footprint)continue;const [w,d,h]=p.footprint;this.physics.createCollider(R.ColliderDesc.cuboid(w/2,h/2,d/2).setTranslation(p.position[0],p.position[2]+h/2,-p.position[1]).setRotation({x:0,y:Math.sin(p.rotation/2),z:0,w:Math.cos(p.rotation/2)}));}
  for(const p of this.placements.filter(p=>p.asset==='elmwood-park-bench'))this.physics.createCollider(R.ColliderDesc.cuboid(1,.52,.4).setTranslation(p.position[0],p.position[2]+.56,-p.position[1]).setRotation({x:0,y:Math.sin(p.rotation/2),z:0,w:Math.cos(p.rotation/2)}));
  for(const f of this.features.filter(f=>f.tags.bridge==='yes')){
   const a=f.points[0],b=f.points.at(-1)!,dx=b[0]-a[0],dn=b[1]-a[1],length=Math.hypot(dx,dn),x=(a[0]+b[0])/2,n=(a[1]+b[1])/2;
   const width=f.tags.highway==='footway'?3.4:4.4,heading=Math.atan2(-dx,dn),height=this.decks.get(a.slice(0,2).join(','))!+.045;
   for(const side of [-1,1])this.physics.createCollider(R.ColliderDesc.cuboid(.22,.56,length/2).setTranslation(x+Math.cos(heading)*side*width/2,height+.56,-n-Math.sin(heading)*side*width/2).setRotation({x:0,y:Math.sin(heading/2),z:0,w:Math.cos(heading/2)}));
  }
  for(const p of this.placements.filter(p=>p.asset==='firemen-memorial'||p.asset==='firemen-hydrant')){
   if(p.asset==='firemen-hydrant')this.physics.createCollider(R.ColliderDesc.cylinder(.5,.38).setTranslation(p.position[0],p.position[2]+.5,-p.position[1]));
   else for(const [width,depth,halfHeight,centre] of [[1.7,1.7,.65,.60],[1.1,1.1,1.65,2.95],[.84,.84,1.9,6.48],[.65,.65,1.1,9.44]])this.physics.createCollider(R.ColliderDesc.cuboid(width,halfHeight,depth).setTranslation(p.position[0],p.position[2]+centre,-p.position[1]).setRotation({x:0,y:Math.sin(p.rotation/2),z:0,w:Math.cos(p.rotation/2)}));
  }
  this.physics.step();
 }
 ground(x:number,north:number){const g=this.grid,u=Math.max(0,Math.min(g.width-1,(x-g.x0)/g.spacing)),v=Math.max(0,Math.min(g.height-1,(g.y0-north)/g.spacing));const i=Math.floor(u),j=Math.floor(v),a=u-i,b=v-j,i1=Math.min(i+1,g.width-1),j1=Math.min(j+1,g.height-1);return(g.heights[j*g.width+i]*(1-a)+g.heights[j*g.width+i1]*a)*(1-b)+(g.heights[j1*g.width+i]*(1-a)+g.heights[j1*g.width+i1]*a)*b;}
 /** Exact NW-SE triangle interpolation used by the visible foundation mesh. */
 surfaceGround(x:number,north:number){
  const g=this.grid,u=Math.max(0,Math.min(g.width-1,(x-g.x0)/g.spacing)),v=Math.max(0,Math.min(g.height-1,(g.y0-north)/g.spacing));
  const i=Math.floor(u),j=Math.floor(v),a=u-i,b=v-j,i1=Math.min(i+1,g.width-1),j1=Math.min(j+1,g.height-1);
  const nw=g.heights[j*g.width+i],ne=g.heights[j*g.width+i1],sw=g.heights[j1*g.width+i],se=g.heights[j1*g.width+i1];
  return a>=b?nw+(ne-nw)*a+(se-ne)*b:nw+(se-sw)*a+(sw-nw)*b;
 }
 nearest(x:number,north:number){const p=this.laneIndex.nearest(x,north);return {distance:p.distance,segment:this.segments[p.index],x:p.x,north:p.y};}
 height(x:number,north:number){let height=this.baseHeight(x,north);for(const bank of this.banks)height=Math.max(height,bankHeight(bank,x,north)??-Infinity);return height;}
 private baseHeight(x:number,north:number){const close=this.nearest(x,north),f=close.segment.feature;let h=this.ground(x,north);if(inRing(x,north,ELMWOOD_PARKING))return this.surfaceGround(x,north)+.046;const half=f.tags.bridge==='yes'&&f.tags.highway==='footway'?1.5:2;if(close.distance>half){const tile=this.curbTiles.get(Math.floor(x/10)+','+Math.floor(north/10));return h+(tile?.some(c=>curbContains(c,x,north))?.155:0);}if(f.tags.bridge==='yes')return this.decks.get(f.points[0].slice(0,2).join(','))!+.045;h=this.surfaceGround(x,north);for(const p of [f.points[0],f.points.at(-1)!]){const z=this.decks.get(p.slice(0,2).join(','));if(z!==undefined){const blend=Math.max(0,1-Math.hypot(x-p[0],north-p[1])/5);h=h*(1-blend)+z*blend;}}return h+.045;}
 sampleGround(x:number,z:number,out:GroundSample){out.height=this.height(x,-z);const dx=(this.height(x+.25,-z)-this.height(x-.25,-z))/.5,dz=(this.height(x,-z-.25)-this.height(x,-z+.25))/.5,len=Math.hypot(dx,1,dz);out.normal.x=-dx/len;out.normal.y=1/len;out.normal.z=-dz/len;out.surface=this.nearest(x,-z).distance<=2||inRing(x,-z,ELMWOOD_PARKING)?'pavement':'grass';const g=this.grid;out.offCourse=x<g.x0||x>g.x0+(g.width-1)*g.spacing||-z>g.y0||-z<g.y0-(g.height-1)*g.spacing||inElmwoodPond(x,-z,this.features);return out;}
 raycastObstacle(origin:Vec3,direction:Vec3,max:number,halfWidth=0,lateral?:Vec3,out?:ObstacleHit){let distance:number|null=null;for(const side of halfWidth?[0,-1,1]:[0]){const axis=lateral??{x:direction.z,y:0,z:-direction.x},o={x:origin.x+axis.x*halfWidth*side,y:origin.y+axis.y*halfWidth*side,z:origin.z+axis.z*halfWidth*side};const hit=this.physics.castRay(new R.Ray(o,direction),max,true);if(hit&&(distance===null||hit.timeOfImpact<distance))distance=hit.timeOfImpact;}if(distance!==null&&out){out.distance=distance;out.halfExtentX=.6;out.halfExtentZ=.5;}return distance;}
 raycast(origin:Vec3,direction:Vec3,max:number){const obstacle=this.raycastObstacle(origin,direction,max);let d=0;for(;d<(obstacle??max);d+=.25)if(origin.y+direction.y*d<this.height(origin.x+direction.x*d,-origin.z-direction.z*d))return d;return obstacle;}
}

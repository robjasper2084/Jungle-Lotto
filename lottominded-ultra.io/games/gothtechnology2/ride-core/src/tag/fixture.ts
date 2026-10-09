import R from '@dimforge/rapier3d-compat';
import type {TerrainSampler,GroundSample,Vec3,ObstacleHit} from '../terrain.ts';
let rapierReady:Promise<void>|undefined;
async function ready(){try{R.version();return;}catch{}await (rapierReady??=R.init());}
export type TagProduct='swoop-detroit'|'elmwood-explorer';
export type Lane={a:Vec3;b:Vec3;width:number};
export type TagFixture={version:1;product:TagProduct;arena:string;revision:string;hash:string;physicsVersion:string;
  transform:{sx:number;tx:number;ty:number;tz:number};physics:string;
  grid:{x:number;z:number;spacing:number;width:number;height:number;heights:number[]};
  /** Optional full-map support mask, bit-packed row-major. Legacy fixtures use lanes. */
  walkable?:string;groundRays?:boolean;roam?:Vec3[];
  navigation?:{nodes:Vec3[];edges:[number,number,number][]};
  lanes:Lane[];spawns:{position:Vec3;headingY:number}[]};
export const lanePoint=(p:Vec3,l:Lane)=>{const dx=l.b.x-l.a.x,dz=l.b.z-l.a.z,t=Math.max(0,Math.min(1,((p.x-l.a.x)*dx+(p.z-l.a.z)*dz)/(dx*dx+dz*dz||1)));
  return {x:l.a.x+t*dx,y:l.a.y+t*(l.b.y-l.a.y),z:l.a.z+t*dz};};
/** Exported Rapier colliders and sampled map heights are identical on server and client. */
export class TagTerrain implements TerrainSampler{
  private readonly support?:Uint8Array;
  private constructor(readonly fixture:TagFixture,readonly physics:R.World){if(fixture.walkable)this.support=Uint8Array.from(atob(fixture.walkable),c=>c.charCodeAt(0));}
  static async create(fixture:TagFixture,physicsBytes?:Uint8Array){await ready();let bytes=physicsBytes;if(!bytes){const binary=atob(fixture.physics);bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);}return new TagTerrain(fixture,R.World.restoreSnapshot(bytes));}
  height(x:number,z:number){const g=this.fixture.grid,u=Math.max(0,Math.min(g.width-1,(x-g.x)/g.spacing)),v=Math.max(0,Math.min(g.height-1,(z-g.z)/g.spacing));
    const i=Math.floor(u),j=Math.floor(v),a=u-i,b=v-j,i1=Math.min(i+1,g.width-1),j1=Math.min(j+1,g.height-1);
    return (g.heights[j*g.width+i]*(1-a)+g.heights[j*g.width+i1]*a)*(1-b)+(g.heights[j1*g.width+i]*(1-a)+g.heights[j1*g.width+i1]*a)*b;}
  nearest(p:Vec3){let best={distance:Infinity,point:p,lane:this.fixture.lanes[0]};for(const lane of this.fixture.lanes){const q=lanePoint(p,lane),distance=Math.hypot(p.x-q.x,p.z-q.z);if(distance<best.distance)best={distance,point:q,lane};}return best;}
  private supported(x:number,z:number){const g=this.fixture.grid,u=(x-g.x)/g.spacing,v=(z-g.z)/g.spacing;
    if(u<0||v<0||u>g.width-1||v>g.height-1)return false;
    // Conservatively require the four cell corners, keeping an entire wheel
    // footprint clear of masked water instead of rounding it into the pond.
    for(const i of [Math.floor(u),Math.ceil(u)])for(const j of [Math.floor(v),Math.ceil(v)]){const index=j*g.width+i;if(!(this.support![index>>3]&(1<<(index&7))))return false;}return true;}
  legal(p:Vec3){if(this.support)return this.supported(p.x,p.z)&&Math.abs(p.y-this.floor(p.x,p.z,p.y).height)<3;
    return Math.abs(p.y-this.height(p.x,p.z))<3&&this.fixture.lanes.some(l=>{const q=lanePoint(p,l);return Math.hypot(p.x-q.x,p.z-q.z)<=l.width/2;});}
  private floor(x:number,z:number,referenceY?:number){let height=this.height(x,z),normal={x:0,y:1,z:0};
    if(this.fixture.groundRays){const o=this.point({x,y:60-this.fixture.transform.ty,z});
      const hit=this.physics.castRayAndGetNormal(new R.Ray(o,{x:0,y:-1,z:0}),100,true,undefined,0xffff0001);
      if(hit){height=60-hit.timeOfImpact-this.fixture.transform.ty;normal={x:hit.normal.x*this.fixture.transform.sx,y:hit.normal.y,z:hit.normal.z};}
      if(referenceY!==undefined){const start=referenceY+.4,deck=this.physics.castRayAndGetNormal(new R.Ray(this.point({x,y:start,z}),{x:0,y:-1,z:0}),100,false,undefined,0xffff0004);
        if(deck&&deck.normal.y>.5&&start-deck.timeOfImpact>=height-.03){height=start-deck.timeOfImpact;normal={x:deck.normal.x*this.fixture.transform.sx,y:deck.normal.y,z:deck.normal.z};}}
    }else {const dx=(this.height(x+.25,z)-this.height(x-.25,z))/.5,dz=(this.height(x,z+.25)-this.height(x,z-.25))/.5,n=Math.hypot(dx,1,dz);normal={x:-dx/n,y:1/n,z:-dz/n};}
    return {height,normal};}
  sampleGround(x:number,z:number,out:GroundSample,referenceY?:number){const f=this.floor(x,z,referenceY);out.height=f.height;Object.assign(out.normal,f.normal);out.surface='pavement';out.offCourse=this.support?!this.supported(x,z):!this.legal({x,y:out.height,z});return out;}
  private point(p:Vec3){const t=this.fixture.transform;return {x:t.tx+t.sx*p.x,y:p.y+t.ty,z:p.z+t.tz};}
  sweep(origin:Vec3,delta:Vec3,radius=0){const length=Math.hypot(delta.x,delta.y,delta.z);if(length<1e-9)return null;const t=this.fixture.transform;
    const velocity={x:t.sx*delta.x/length,y:delta.y/length,z:delta.z/length};
    const hit=this.physics.castShape(this.point(origin),{x:0,y:0,z:0,w:1},velocity,new R.Ball(Math.max(.001,radius)),0,length,true,undefined,this.fixture.groundRays?0xffff0002:undefined);
    return hit?hit.time_of_impact/length:null;}
  raycastObstacle(origin:Vec3,direction:Vec3,max:number,halfWidth=0,_lateral?:Vec3,out?:ObstacleHit){
    const length=Math.hypot(direction.x,direction.y,direction.z);if(length<1e-9)return null;
    const hit=this.sweep(origin,{x:direction.x/length*max,y:direction.y/length*max,z:direction.z/length*max},halfWidth);
    let distance=hit===null?null:hit*max;
    // Mounted wheel/body and navigation sweeps stop at unsupported terrain.
    // Heart-sized sweeps retain real scenery collision only, so water is not
    // an invisible projectile wall. This runs before controller movement.
    if(this.support&&halfWidth>=.25&&Math.abs(direction.y/length)<.2){
      const dx=direction.x/length,dz=direction.z/length,limit=distance??max;
      for(let d=0;d<=limit;d+=.12){const x=origin.x+dx*d,z=origin.z+dz*d;
        if([[0,0],[halfWidth,0],[-halfWidth,0],[0,halfWidth],[0,-halfWidth]].some(([u,v])=>!this.supported(x+u,z+v))){distance=d;break;}}
    }
    if(distance===null)return null;if(out)Object.assign(out,{distance,halfExtentX:.5,halfExtentZ:.5});return distance;
  }
  raycast(origin:Vec3,direction:Vec3,max:number){const solid=this.raycastObstacle(origin,direction,max);const n=Math.hypot(direction.x,direction.y,direction.z)||1;
    for(let d=0;d<(solid??max);d+=.08)if(origin.y+direction.y/n*d<this.height(origin.x+direction.x/n*d,origin.z+direction.z/n*d))return d;return solid;}
  dispose(){this.physics.free();}
}

import {ParkTerrain as BelleParkTerrain} from '../../../lottominded-ultra.io/games/gothtechnology2/belle-isle-source/game/src/belle/terrain.ts';
import type {ParkMap,Point,Landmark,Monument,BoulderCollision} from '../../../lottominded-ultra.io/games/gothtechnology2/belle-isle-source/game/src/belle/terrain.ts';
import {districts as originalDistricts} from '../../../lottominded-ultra.io/games/gothtechnology2/belle-isle-source/game/src/belle/detroitGround.ts';
import {inside,segment as distanceToSegment} from '../../../lottominded-ultra.io/games/gothtechnology2/belle-isle-source/game/src/belle/terrain.ts';
import type {DetroitWorld,TerrainChunk} from '../../../lottominded-ultra.io/games/gothtechnology2/swoop-source/src/detroit/world.ts';
import type {GeoTerrain} from '../../../lottominded-ultra.io/games/gothtechnology2/swoop-source/src/detroit/geo-terrain.ts';
import type {TerrainSampler,GroundSample,ObstacleHit,NavigationObstacle} from '../../../lottominded-ultra.io/games/gothtechnology2/swoop-source/src/detroit/terrain.ts';
import {fromSwoop,toSwoop,fromSwoopDirection,toSwoopDirection,fromSwoopNormal,toSwoopMap,toSwoopMapDirection,toSwoopHeading,toSwoopRay,SWOOP_LOCAL_HEIGHT_OFFSET,SWOOP_MIN_SCALE,SWOOP_MAX_SCALE,type Vector,type SourceRay} from './geo.ts';

export {inside,segment} from '../../../lottominded-ultra.io/games/gothtechnology2/belle-isle-source/game/src/belle/terrain.ts';
export type {ParkMap,Point,Landmark,Monument,BoulderCollision};

type Triangle=readonly [number,number,number,number,number,number];
export type CoverageSegment={start:number;end:number;source:boolean};
const GRID=100;
const vec=():Vector=>({x:0,y:0,z:0});
const sample=():GroundSample=>({height:0,normal:vec(),surface:'pavement',offCourse:false});

/** Exact union of source ground tiles and added rideable triangles, in MAP space.
 * Empty space between disjoint tiles never becomes a guessed rectangular world.
 * Dynamic scenery adds its real triangles through the instance hooks below. */
export class SwoopCoverage {
  readonly mapCells=new Set<string>();
  private readonly triangles=new Map<string,Triangle[]>();
  private minX=Infinity;private minZ=Infinity;private maxX=-Infinity;private maxZ=-Infinity;
  private readonly point=vec();
  constructor(chunks:readonly Pick<TerrainChunk,'x'|'z'>[]=[]){
    for(const c of chunks){const ix=Math.floor(c.x/GRID),iz=Math.floor(c.z/GRID);this.mapCells.add(ix+','+iz);this.extend(ix*GRID,iz*GRID,(ix+1)*GRID,(iz+1)*GRID);}
  }
  private extend(x0:number,z0:number,x1:number,z1:number){this.minX=Math.min(this.minX,x0);this.minZ=Math.min(this.minZ,z0);this.maxX=Math.max(this.maxX,x1);this.maxZ=Math.max(this.maxZ,z1);}
  get bounds(){return {minX:this.minX,minZ:this.minZ,maxX:this.maxX,maxZ:this.maxZ};}
  get cellCount(){return this.mapCells.size;}
  /** Snapshot after every source loader has registered its actual ride surfaces.
   * Callers project these MAP-space polygons once for visual overlap removal. */
  mapFootprintPolygons():Point[][][]{
    const polygons:Point[][][]=[];
    for(const key of this.mapCells){const [ix,iz]=key.split(',').map(Number),x=ix*GRID,z=iz*GRID;polygons.push([[[x,z],[x+GRID,z],[x+GRID,z+GRID],[x,z+GRID],[x,z]]]);}
    const seen=new Set<Triangle>();
    for(const list of this.triangles.values())for(const t of list){if(seen.has(t))continue;seen.add(t);polygons.push([[[t[0],t[1]],[t[2],t[3]],[t[4],t[5]],[t[0],t[1]]]]);}
    return polygons;
  }
  addRideTriangles(vertices:ArrayLike<number>,indices?:ArrayLike<number>,upwardOnly=false){
    const count=indices?.length??vertices.length/3;
    for(let i=0;i+2<count;i+=3){
      const ai=(indices?.[i]??i)*3,bi=(indices?.[i+1]??i+1)*3,ci=(indices?.[i+2]??i+2)*3;
      const ax=vertices[ai],az=vertices[ai+2],bx=vertices[bi],bz=vertices[bi+2],cx=vertices[ci],cz=vertices[ci+2];
      const ux=bx-ax,uy=vertices[bi+1]-vertices[ai+1],uz=bz-az,vx=cx-ax,vy=vertices[ci+1]-vertices[ai+1],vz=cz-az;
      const nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;
      if(![ax,az,bx,bz,cx,cz,ny].every(Number.isFinite)||Math.abs(ny)<1e-9)continue;
      if(upwardOnly&&ny<=.5*Math.hypot(nx,ny,nz))continue;
      const triangle:Triangle=[ax,az,bx,bz,cx,cz];
      const x0=Math.min(ax,bx,cx),z0=Math.min(az,bz,cz),x1=Math.max(ax,bx,cx),z1=Math.max(az,bz,cz);
      this.extend(x0,z0,x1,z1);
      for(let ix=Math.floor(x0/GRID);ix<=Math.floor(x1/GRID);ix++)for(let iz=Math.floor(z0/GRID);iz<=Math.floor(z1/GRID);iz++){
        const key=ix+','+iz;if(this.mapCells.has(key))continue;
        const list=this.triangles.get(key)??[];list.push(triangle);this.triangles.set(key,list);
      }
    }
  }
  containsMap(x:number,z:number){
    if(!Number.isFinite(x)||!Number.isFinite(z)||x<this.minX||x>this.maxX||z<this.minZ||z>this.maxZ)return false;
    const ix=Math.floor(x/GRID),iz=Math.floor(z/GRID),key=ix+','+iz;
    if(this.mapCells.has(key))return true;
    // A shared outer tile edge belongs to its closed terrain surface too.
    const edgeX=Math.abs(x/GRID-Math.round(x/GRID))<1e-10,edgeZ=Math.abs(z/GRID-Math.round(z/GRID))<1e-10;
    if(edgeX&&this.mapCells.has((ix-1)+','+iz)||edgeZ&&this.mapCells.has(ix+','+(iz-1))||edgeX&&edgeZ&&this.mapCells.has((ix-1)+','+(iz-1)))return true;
    return (this.triangles.get(key)??[]).some(t=>{
      const a=(t[2]-t[0])*(z-t[1])-(t[3]-t[1])*(x-t[0]);
      const b=(t[4]-t[2])*(z-t[3])-(t[5]-t[3])*(x-t[2]);
      const c=(t[0]-t[4])*(z-t[5])-(t[1]-t[5])*(x-t[4]);
      return (a>=-1e-8&&b>=-1e-8&&c>=-1e-8)||(a<=1e-8&&b<=1e-8&&c<=1e-8);
    });
  }
  containsWorld(x:number,z:number){const p=toSwoopMap(x,0,z,this.point);return this.containsMap(p.x,p.z);}
  intersectsRay(origin:Vector,direction:Vector,max:number,padding=0){
    if(!Number.isFinite(this.minX))return false;
    let t0=0,t1=max;
    for(const [p,v,lo,hi] of [[origin.x,direction.x,this.minX-padding,this.maxX+padding],[origin.z,direction.z,this.minZ-padding,this.maxZ+padding]]){
      if(Math.abs(v)<1e-12){if(p<lo||p>hi)return false;}
      else{const a=(lo-p)/v,b=(hi-p)/v;t0=Math.max(t0,Math.min(a,b));t1=Math.min(t1,Math.max(a,b));if(t0>t1)return false;}
    }
    return t1>=t0;
  }
  /** Exact source-only query fast path. A complete source tile contains every
   * centre-line and lateral sample; a partial triangle cell cannot qualify. */
  coversRayInOneTile(origin:Vector,direction:Vector,max:number,padding=0){
    const ix=Math.floor(origin.x/GRID),iz=Math.floor(origin.z/GRID);
    if(!this.mapCells.has(ix+','+iz))return false;
    const x=origin.x+direction.x*max,z=origin.z+direction.z*max;
    return Math.min(origin.x,x)-padding>=ix*GRID&&Math.max(origin.x,x)+padding<=(ix+1)*GRID&&Math.min(origin.z,z)-padding>=iz*GRID&&Math.max(origin.z,z)+padding<=(iz+1)*GRID;
  }
  /** Split a ray at tile AND triangle edges, so a collision query cannot silently
   * fall through a source bridge into Belle's old simplified greenway surface. */
  segments(origin:Vector,direction:Vector,max:number):CoverageSegment[]{
    if(!Number.isFinite(max)||max<0)throw new RangeError('Invalid coverage ray length');
    if(!this.intersectsRay(origin,direction,max))return [{start:0,end:max,source:false}];
    const cuts=[0,max];
    for(const [p,v,min,maxBound] of [[origin.x,direction.x,this.minX,this.maxX],[origin.z,direction.z,this.minZ,this.maxZ]]){
      if(Math.abs(v)<1e-12)continue;
      for(const bound of [min,maxBound]){const t=(bound-p)/v;if(t>0&&t<max)cuts.push(t);}
      const end=p+v*max,low=Math.max(min,Math.min(p,end)),high=Math.min(maxBound,Math.max(p,end));
      for(let edge=Math.floor(low/GRID)+1;edge*GRID<high;edge++){const t=(edge*GRID-p)/v;if(t>0&&t<max)cuts.push(t);}
    }
    // Usually empty: terrain tiles cover almost all scenery. Only added floors
    // beyond those tiles require triangle-edge subdivisions.
    const seen=new Set<Triangle>();
    for(const t of [...cuts].sort((a,b)=>a-b)){
      const px=origin.x+direction.x*Math.min(max,t+1e-7),pz=origin.z+direction.z*Math.min(max,t+1e-7);
      for(const triangle of this.triangles.get(Math.floor(px/GRID)+','+Math.floor(pz/GRID))??[]){
        if(seen.has(triangle))continue;seen.add(triangle);
        for(let i=0;i<3;i++){
          const j=(i+1)%3,ax=triangle[i*2],az=triangle[i*2+1],dx=triangle[j*2]-ax,dz=triangle[j*2+1]-az;
          const determinant=direction.x*dz-direction.z*dx;if(Math.abs(determinant)<1e-12)continue;
          const ox=ax-origin.x,oz=az-origin.z,along=(ox*dz-oz*dx)/determinant,edge=(ox*direction.z-oz*direction.x)/determinant;
          if(along>0&&along<max&&edge>=0&&edge<=1)cuts.push(along);
        }
      }
    }
    cuts.sort((a,b)=>a-b);const result:CoverageSegment[]=[];
    for(let i=1;i<cuts.length;i++){
      const start=cuts[i-1],end=cuts[i];if(end-start<1e-10)continue;const mid=(start+end)/2;
      const source=this.containsMap(origin.x+direction.x*mid,origin.z+direction.z*mid),previous=result.at(-1);
      if(previous?.source===source)previous.end=end;else result.push({start,end,source});
    }
    return result.length?result:[{start:0,end:max,source:this.containsMap(origin.x,origin.z)}];
  }
}

/** Projects the unmodified GeoTerrain contract into the Belle frame. */
export class ProjectedTerrain implements TerrainSampler {
  readonly local:TerrainSampler;
  private readonly point=vec();private readonly lateral=vec();
  private readonly ray:SourceRay={origin:vec(),direction:vec(),maxDistance:0,scale:1};
  constructor(local:TerrainSampler){this.local=local;}
  sampleGround(x:number,z:number,out:GroundSample,referenceY?:number){
    const p=toSwoop(x,0,z,this.point);
    this.local.sampleGround(p.x,p.z,out,referenceY===undefined?undefined:referenceY-SWOOP_LOCAL_HEIGHT_OFFSET);
    out.height+=SWOOP_LOCAL_HEIGHT_OFFSET;
    fromSwoopNormal(out.normal.x,out.normal.y,out.normal.z,out.normal);return out;
  }
  waterAt(x:number,z:number,referenceY:number){const p=toSwoop(x,referenceY,z,this.point);return this.local.waterAt?.(p.x,p.z,p.y)??false;}
  riderProtectionAt(x:number,z:number){const p=toSwoop(x,0,z,this.point);return this.local.riderProtectionAt?.(p.x,p.z)??false;}
  raycast(origin:Vector,direction:Vector,maxDistance:number){
    const ray=toSwoopRay(origin,direction,maxDistance,this.ray);if(!ray)return null;
    const hit=this.local.raycast(ray.origin,ray.direction,ray.maxDistance);return hit===null?null:hit/ray.scale;
  }
  raycastObstacle(origin:Vector,direction:Vector,maxDistance:number,half=0,lateral?:Vector,out?:ObstacleHit){
    const ray=toSwoopRay(origin,direction,maxDistance,this.ray);if(!ray)return null;
    const length=Math.hypot(direction.x,direction.y,direction.z);
    // Passing the transformed lateral vector, without renormalizing it, keeps
    // all five source sweep samples at the exact requested world offsets.
    if(lateral)toSwoopDirection(lateral.x,lateral.y,lateral.z,this.lateral);
    else toSwoopDirection(direction.z/length,0,-direction.x/length,this.lateral);
    const hit=this.local.raycastObstacle(ray.origin,ray.direction,ray.maxDistance,half,this.lateral,out);
    if(hit===null)return null;
    if(out){out.distance=hit/ray.scale;out.halfExtentX*=SWOOP_MAX_SCALE;out.halfExtentZ*=SWOOP_MAX_SCALE;}
    return hit/ray.scale;
  }
  mountedClear(p:Vector,heading:number,radius:number,height:number){
    const q=toSwoop(p.x,p.y,p.z,this.point);
    // The destination projection contracts easting by ~0.032%. Expanding the
    // source query by its inverse minimum scale is conservative, never weaker.
    return this.local.mountedClear?.(q,toSwoopHeading(heading),radius/SWOOP_MIN_SCALE,height)??false;
  }
  reserveRecoverySpace(p:Vector,radius:number,height:number){const q=toSwoop(p.x,p.y,p.z,this.point);this.local.reserveRecoverySpace?.(q,radius/SWOOP_MIN_SCALE,height);}
  navigationObstacles(x:number,z:number,radius:number):NavigationObstacle[]{
    const p=toSwoop(x,0,z,this.point);
    return (this.local.navigationObstacles?.(p.x,p.z,radius/SWOOP_MIN_SCALE)??[]).map(o=>{
      const at=fromSwoop(o.x,o.y,o.z),v=fromSwoopDirection(o.vx,0,o.vz);
      return {...o,...at,vx:v.x,vz:v.z,radius:o.radius*SWOOP_MAX_SCALE,onImpact:o.onImpact?impact=>{const velocity=toSwoopDirection(impact.vx,0,impact.vz);o.onImpact!({...impact,vx:velocity.x,vz:velocity.z});}:undefined};
    });
  }
}

/** Preview-only composite. Production ParkTerrain and its original callers are untouched. */
export class ParkTerrain extends BelleParkTerrain {
  private prepared?:Promise<void>;
  private source?:DetroitWorld;private local?:GeoTerrain;private projected?:ProjectedTerrain;
  private coverage?:SwoopCoverage;
  private readonly ground=sample();
  private readonly compositeDirection=vec();private readonly mapRayOrigin=vec();private readonly mapRayDirection=vec();private readonly baseRayOrigin=vec();
  private readonly replacedHostPolygons=new Set<Point[]>();
  private readonly suppressedHostBoxes:BelleParkTerrain['boxes']=[];
  readonly toSwoop=toSwoop;readonly fromSwoop=fromSwoop;
  get sourceWorld(){if(!this.source)throw new Error('Swoop terrain has not been prepared');return this.source;}
  get localTerrain(){if(!this.local)throw new Error('Swoop terrain has not been prepared');return this.local;}
  get swoopCoverage(){if(!this.coverage)throw new Error('Swoop coverage has not been prepared');return this.coverage;}
  /** Match the renderer's verified replacements by stable building ID and exact
   * original polygon reference. Until configured, every host box stays solid. */
  configureReplacedHostBuildings(ids:ReadonlySet<string>){
    this.replacedHostPolygons.clear();
    for(const b of [...this.map.buildings,...originalDistricts.buildings])if(ids.has(b.id))this.replacedHostPolygons.add(b.points);
    const districtPolygons=new Set(originalDistricts.buildings.map(b=>b.points));
    // Remove hidden originals from the inherited query path too: an outside
    // ray can cross a replaced building before entering the terrain footprint.
    // Preserve object identity and restore previously suppressed objects before
    // reconfiguration, including all boxes appended by scene loaders.
    for(const box of this.suppressedHostBoxes)if(!this.boxes.includes(box))this.boxes.push(box);
    this.suppressedHostBoxes.length=0;let active=0;
    for(const box of this.boxes){
      if(box.points&&this.replacedHostPolygons.has(box.points)){this.suppressedHostBoxes.push(box);continue;}
      this.boxes[active++]=box;
      if(box.points&&districtPolygons.has(box.points)&&!this.replacedHostPolygons.has(box.points)){
        // detroitScene positions each retained building on the composite ground
        // at this same first polygon vertex. Preserve its original 0.1m visual
        // foundation inset; the original collision base sits on that ground.
        box.base=this.height(...box.points[0]);
      }
    }
    this.boxes.length=active;
  }
  prepareSwoop():Promise<void>{
    if(this.prepared)return this.prepared;
    this.prepared=(async()=>{
      const [{DetroitWorld},{GeoTerrain}]=await Promise.all([
        import('../../../lottominded-ultra.io/games/gothtechnology2/swoop-source/src/detroit/world.ts'),
        import('../../../lottominded-ultra.io/games/gothtechnology2/swoop-source/src/detroit/geo-terrain.ts')
      ]);
      const world=new DetroitWorld(),coverage=new SwoopCoverage(world.chunks);
      const addMesh=world.addMesh,addRideSurface=world.addRideSurface;
      world.addMesh=function(vertices,indices,rideable=false){const collider=addMesh.call(this,vertices,indices,rideable);if(rideable)coverage.addRideTriangles(vertices,indices,true);return collider;};
      world.addRideSurface=function(vertices,foundation=false,indices){const collider=addRideSurface.call(this,vertices,foundation,indices);coverage.addRideTriangles(vertices,indices);return collider;};
      try{await world.init();}catch(error){world.physics?.free();throw error;}
      this.source=world;this.local=new GeoTerrain(world);this.projected=new ProjectedTerrain(this.local);this.coverage=coverage;
    })();return this.prepared;
  }
  containsSwoop(x:number,z:number){return this.coverage?.containsWorld(x,z)??false;}
  override sampleGround(x:number,z:number,out:GroundSample,referenceY?:number){
    if(!this.containsSwoop(x,z))return super.sampleGround(x,z,out,referenceY);
    this.projected!.sampleGround(x,z,out,referenceY);
    out.offCourse||=this.projected!.waterAt(x,z,referenceY??out.height);return out;
  }
  override height(x:number,z:number,referenceY?:number){
    if(!this.containsSwoop(x,z))return super.height(x,z,referenceY);
    return this.projected!.sampleGround(x,z,this.ground,referenceY).height;
  }
  override land(x:number,z:number,referenceY?:number){
    if(!this.containsSwoop(x,z))return super.land(x,z,referenceY);
    return !this.sampleGround(x,z,this.ground,referenceY).offCourse;
  }
  override obstructed(x:number,z:number,margin=0){
    if(!this.containsSwoop(x,z))return super.obstructed(x,z,margin);
    const height=this.height(x,z);return this.retainedHostBlocked(x,z,margin)||!this.projected!.mountedClear({x,y:height,z},0,Math.max(.01,margin),1.8);
  }
  navigationObstacles(x:number,z:number,radius:number){return this.containsSwoop(x,z)?this.projected!.navigationObstacles(x,z,radius):[];}
  mountedClear(p:Vector,heading:number,radius:number,height:number){return this.containsSwoop(p.x,p.z)?!this.retainedHostBlocked(p.x,p.z,radius)&&this.projected!.mountedClear(p,heading,radius,height):!super.obstructed(p.x,p.z,radius);}
  reserveRecoverySpace(p:Vector,radius:number,height:number){if(this.containsSwoop(p.x,p.z))this.projected!.reserveRecoverySpace(p,radius,height);}
  override raycast(origin:Vector,direction:Vector,max:number){return this.compositeRay('ground',origin,direction,max,0);}
  override raycastObstacle(origin:Vector,direction:Vector,max:number,half=.4,lateral?:Vector,out?:ObstacleHit){return this.compositeRay('obstacle',origin,direction,max,half,lateral,out);}
  override raycastCamera(origin:Vector,direction:Vector,max:number,half=.16){return this.compositeRay('camera',origin,direction,max,half);}
  override raycastFlight(origin:Vector,direction:Vector,max:number,half=1.35){return this.compositeRay('flight',origin,direction,max,half);}
  private baseRay(kind:'ground'|'obstacle'|'camera'|'flight',o:Vector,d:Vector,max:number,half:number){
    return kind==='ground'?super.raycast(o,d,max):kind==='camera'?super.raycastCamera(o,d,max,half):kind==='flight'?super.raycastFlight(o,d,max,half):super.raycastObstacle(o,d,max,half);
  }
  private retainedHostBlocked(x:number,z:number,margin:number){
    for(const box of this.boxes){
      if(box.points&&this.replacedHostPolygons.has(box.points))continue;
      if(x<=box.minX-margin||x>=box.maxX+margin||z<=box.minZ-margin||z>=box.maxZ+margin)continue;
      if(!box.points||inside(x,z,box.points)||box.points.some((p,j)=>j>0&&distanceToSegment(x,z,box.points![j-1],p).d<=margin))return true;
    }
    return false;
  }
  /** Same original host box/polygon collision semantics, retained only where
   * there is still a corresponding visible host building. Read live box values
   * on every query so in-place mutations and later scene registrations stay safe. */
  private retainedHostRay(o:Vector,d:Vector,max:number,half:number):number|null {
    const endX=o.x+d.x*max,endZ=o.z+d.z*max,roundoff=8*Number.EPSILON*Math.max(1,Math.abs(o.x),Math.abs(o.z),Math.abs(endX),Math.abs(endZ),Math.abs(half));
    const minX=Math.min(o.x,endX)-roundoff,maxX=Math.max(o.x,endX)+roundoff,minZ=Math.min(o.z,endZ)-roundoff,maxZ=Math.max(o.z,endZ)+roundoff;
    let hit=max+1;
    for(const b of this.boxes){
      if(b.points&&this.replacedHostPolygons.has(b.points)||maxX<b.minX-half||minX>b.maxX+half||maxZ<b.minZ-half||minZ>b.maxZ+half)continue;
      const base=b.base??2;if(Math.min(o.y,o.y+d.y*max)>base+b.height+.2||Math.max(o.y,o.y+d.y*max)<base)continue;
      let t0=0,t1=max;
      for(let axis=0;axis<3;axis++){
        const p=axis===0?o.x:axis===1?o.z:o.y,v=axis===0?d.x:axis===1?d.z:d.y,lo=axis===0?b.minX-half:axis===1?b.minZ-half:base,hi=axis===0?b.maxX+half:axis===1?b.maxZ+half:base+b.height;
        if(Math.abs(v)<1e-7){if(p<lo||p>hi){t0=max+1;break;}}
        else{const a=(lo-p)/v,c=(hi-p)/v;t0=Math.max(t0,Math.min(a,c));t1=Math.min(t1,Math.max(a,c));}
      }
      if(t0>t1||t0>=hit)continue;
      if(!b.points){hit=t0;continue;}
      const end=Math.min(t1,max),steps=Math.max(1,Math.ceil((end-t0)/.15));
      for(let i=0;i<=steps;i++){
        const t=t0+(end-t0)*i/steps,x=o.x+d.x*t,z=o.z+d.z*t;
        if(inside(x,z,b.points)||b.points.some((p,j)=>j>0&&distanceToSegment(x,z,b.points![j-1],p).d<=half)){hit=t;break;}
      }
    }
    return hit<=max?hit:null;
  }
  private compositeRay(kind:'ground'|'obstacle'|'camera'|'flight',origin:Vector,direction:Vector,max:number,half:number,lateral?:Vector,out?:ObstacleHit){
    if(!this.coverage||!this.projected)return this.baseRay(kind,origin,direction,max,half);
    const length=Math.hypot(direction.x,direction.y,direction.z);if(length<1e-12||!Number.isFinite(length)||!Number.isFinite(max)||max<0)return null;
    const d=this.compositeDirection;d.x=direction.x/length;d.y=direction.y/length;d.z=direction.z/length;
    const mapOrigin=toSwoopMap(origin.x,origin.y,origin.z,this.mapRayOrigin),mapDirection=toSwoopMapDirection(d.x,d.y,d.z,this.mapRayDirection);
    const padding=Math.abs(half)*(lateral?Math.hypot(lateral.x,lateral.z):1)/SWOOP_MIN_SCALE;
    const sourceOnly=this.coverage.coversRayInOneTile(mapOrigin,mapDirection,max,padding);
    if(!sourceOnly&&!this.coverage.intersectsRay(mapOrigin,mapDirection,max,200+padding))return this.baseRay(kind,origin,direction,max,half);
    const previousExtentX=out?.halfExtentX,previousExtentZ=out?.halfExtentZ;
    let hit=kind==='ground'?this.projected.raycast(origin,d,max):this.projected.raycastObstacle(origin,d,max,half,lateral,out);
    let sourceHit=hit!==null;
    if(!sourceOnly)for(const segment of this.coverage.segments(mapOrigin,mapDirection,max)){
      if(segment.source||segment.start>(hit??max))continue;
      const start=segment.start,o=this.baseRayOrigin;o.x=origin.x+d.x*start;o.y=origin.y+d.y*start;o.z=origin.z+d.z*start;
      const base=this.baseRay(kind,o,d,Math.min(segment.end,hit??max)-start,half);
      if(base!==null){const t=start+base;if(!this.containsSwoop(origin.x+d.x*t,origin.z+d.z*t)&&(hit===null||t<hit)){hit=t;sourceHit=false;}}
    }
    if(kind!=='ground'){const retained=this.retainedHostRay(origin,d,hit??max,half);if(retained!==null&&(hit===null||retained<hit)){hit=retained;sourceHit=false;}}
    // Belle's ground vehicles rely on obstacle rays to stop at water; its camera
    // and flying vehicles deliberately omit that boundary, as in production.
    if(kind==='obstacle')for(let t=.2;t<=Math.min(max,hit??max);t+=.35){
      const x=origin.x+d.x*t,z=origin.z+d.z*t;if(this.containsSwoop(x,z)&&!this.land(x,z,origin.y)){hit=t;sourceHit=false;break;}
    }
    if(hit!==null&&out){out.distance=hit;if(!sourceHit){out.halfExtentX=previousExtentX!;out.halfExtentZ=previousExtentZ!;}}return hit;
  }
}

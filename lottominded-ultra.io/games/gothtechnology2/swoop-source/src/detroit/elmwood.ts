import RAPIER from '@dimforge/rapier3d-compat';
import {DetroitWorld,trafficBounds,type TerrainChunk} from './world.ts';
import {MAP_ORIGIN} from './geo-profile.ts';
import {mappedSpline} from './mapped-spline.ts';
import {ELM_DEM,ELM_ELEVATIONS} from './elmwood-dem.ts';
import type {GroundSample,Vec3} from './terrain.ts';

// Hand-traced from the official Elmwood plan, using its 500-foot scale bar.
// Approximate plan geometry; heights use manually satellite-aligned USGS 3DEP.
// Lane corridors are graded for riding. Monuments remain authored estimates.
export const ELMWOOD_SOURCE='https://www.elmwoodhistoriccemetery.org/images/elmwood_cemetery_map-1.pdf';
export const PLAN_METRES=152.4/222;
export const ELM_POND=[[794,373],[803,365],[846,359],[865,372],[897,372],[904,386],[875,400],[838,411],[815,402],[795,386]];
export const ELM_CREEKS=[[[1040,405],[1023,426],[994,410],[990,386],[938,377],[910,387]],[[797,410],[757,429],[717,451],[691,460],[687,493],[624,497],[551,490],[514,502],[447,515]]];
export function polylineDistance(px:number,pz:number,points:number[][]){let best=Infinity;for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((px-a[0])*dx+(pz-a[1])*dz)/(dx*dx+dz*dz)));best=Math.min(best,Math.hypot(px-a[0]-dx*t,pz-a[1]-dz*t));}return best*PLAN_METRES;}
export function elmCreekDistance(px:number,pz:number){return Math.min(...ELM_CREEKS.map(c=>polylineDistance(px,pz,c)));}
export function inPond(x:number,z:number){const p=planPoint(x,z);let inside=false;for(let i=0,j=ELM_POND.length-1;i<ELM_POND.length;j=i++){const a=ELM_POND[i],b=ELM_POND[j];if((a[1]>p.z)!==(b[1]>p.z)&&p.x<(b[0]-a[0])*(p.z-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;}
export const elmPoint=(x:number,z:number)=>({x:MAP_ORIGIN.x+(x-1075)*PLAN_METRES,z:MAP_ORIGIN.z+(z-475)*PLAN_METRES});
export const planPoint=(x:number,z:number)=>({x:(x-MAP_ORIGIN.x)/PLAN_METRES+1075,z:(z-MAP_ORIGIN.z)/PLAN_METRES+475});
export const ELM_BOUNDARY=[[28,118],[1090,122],[1091,166],[1169,166],[1191,475],[1098,475],[1098,510],[810,530],[685,560],[560,570],[411,627],[60,627]];
export const ELM_ROADS=[
 [[1075,490],[1075,453],[1091,385],[1080,327],[1058,302],[1015,313],[970,334],[910,329],[845,316],[788,321],[756,342],[775,386],[799,414],[855,414],[930,427],[1003,450],[1045,472],[950,477],[820,483],[788,492]],
 [[1075,453],[1100,429],[1155,428],[1172,405],[1160,350],[1158,303],[1163,259],[1155,226],[1142,218],[1110,230],[1068,229],[1010,229],[960,231],[948,244],[933,231],[944,211],[961,218]],
 [[1068,229],[1050,174],[1020,155],[945,150],[845,153],[781,152],[717,153],[681,168],[650,194],[628,235],[615,287],[602,335],[587,388],[598,414],[635,421],[671,410],[705,382],[729,353],[735,316],[735,255],[718,243],[689,235],[628,235]],
 [[845,153],[841,207],[842,259],[842,316]],[[945,150],[947,199],[947,213]],[[960,240],[985,273],[1016,291],[1058,302],[1068,269],[1068,229]],
 [[628,235],[593,227],[573,252],[553,290],[534,336],[512,385],[487,433],[465,454],[446,451],[426,428],[412,394],[416,365],[442,329],[479,281],[520,238],[534,233],[556,249]],
 [[593,227],[600,204],[596,174],[576,147],[526,145],[451,146],[420,150],[446,179],[478,203],[520,226]],
 [[628,235],[606,226]],[[576,147],[605,157],[633,147],[651,143],[680,157]],
 [[420,150],[412,179],[412,259],[411,331],[412,394]],[[420,150],[389,160],[361,187],[340,229],[332,268],[349,331],[357,381],[381,415],[398,405],[407,369],[412,331]],
 [[420,150],[402,142],[336,141],[282,142],[254,151],[247,186],[249,273],[249,339],[285,308],[332,268]],
 [[254,151],[236,149],[211,164],[180,197],[160,198],[132,201],[122,224],[125,288],[125,349],[125,425],[135,452],[148,456],[164,437],[180,424],[205,429],[232,436],[240,455],[231,493],[195,497],[140,488],[113,475],[88,450],[69,423],[63,401],[73,391],[88,393],[100,406],[114,425],[118,405],[120,351]],
 [[180,197],[180,241],[180,313],[180,368],[180,424]],[[240,155],[246,234],[246,312],[249,339],[249,390],[232,436]],
 [[132,201],[102,216],[63,220],[58,232],[58,312],[58,352],[87,342],[120,317]],
 [[249,390],[276,377],[309,378],[347,394],[379,426],[385,446],[369,463],[320,477],[278,477],[260,461],[252,432],[249,390]],
 [[140,488],[94,489],[52,480]],[[140,488],[126,514],[112,548],[127,574],[172,589],[212,621],[226,620],[244,599],[247,550],[239,521],[223,510],[183,506],[140,488]],
 [[239,521],[270,517],[340,520],[399,517],[434,510],[450,493],[489,480],[548,465],[601,470],[665,477],[714,465],[756,446],[799,414]],
 [[788,492],[775,517],[739,535],[684,546],[611,550],[552,550],[508,563],[485,564],[466,544],[445,530],[434,510]],
 [[247,550],[249,575],[269,585],[316,586],[343,578],[386,583],[418,575],[461,576],[480,568]],
 [[398,405],[410,420],[426,469],[435,485],[450,493]]
];
export const ELM_PATHS=ELM_ROADS.map(ps=>mappedSpline(ps.map(([x,z])=>{const p=elmPoint(x,z);return[p.x,p.z];})));
export const ELM_SPOTS=[{name:'Elmwood · Entrance',px:1075,pz:485},{name:'Pond / Lake View',px:799,pz:414},{name:'Indian Mound',px:735,pz:235},{name:'Hazel Dell',px:577,pz:280},{name:'West garden lanes',px:180,pz:424}].map(s=>{const target=elmPoint(s.px,s.pz);let best=Infinity,point=ELM_PATHS[0].sample(0);for(const path of ELM_PATHS){let d=0;for(let i=0;i<path.samples.length;i++){if(i)d+=path.samples[i].distanceTo(path.samples[i-1]);const p=path.sample(d),distance=Math.hypot(p.x-target.x,p.z-target.z);if(distance<best){best=distance;point=p;}}}return{name:s.name,...point};});
export function elmDistance(x:number,z:number){let best=Infinity;for(const path of ELM_PATHS)for(let i=1;i<path.samples.length;i++){const a=path.samples[i-1],b=path.samples[i],dx=b.x-a.x,dz=b.z-a.z,t=Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz)));best=Math.min(best,Math.hypot(x-a.x-dx*t,z-a.z-dz*t));}return best;}
export function elmInside(x:number,z:number){const p=planPoint(x,z);let inside=false;for(let i=0,j=ELM_BOUNDARY.length-1;i<ELM_BOUNDARY.length;j=i++){const a=ELM_BOUNDARY[i],b=ELM_BOUNDARY[j];if((a[1]>p.z)!==(b[1]>p.z)&&p.x<(b[0]-a[0])*(p.z-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;}
export function elmElevation(px:number,pz:number){
 const u=Math.max(0,Math.min(ELM_DEM.width-1.001,(px-ELM_DEM.planX)/ELM_DEM.step)),v=Math.max(0,Math.min(ELM_DEM.height-1.001,(pz-ELM_DEM.planZ)/ELM_DEM.step)),i=Math.floor(u),j=Math.floor(v),fx=u-i,fz=v-j,k=j*ELM_DEM.width;
 const a=ELM_ELEVATIONS[k+i]*(1-fx)+ELM_ELEVATIONS[k+i+1]*fx,b=ELM_ELEVATIONS[k+ELM_DEM.width+i]*(1-fx)+ELM_ELEVATIONS[k+ELM_DEM.width+i+1]*fx;
 return a*(1-fz)+b*fz;
}
export const ELM_WATER_Y=MAP_ORIGIN.y+178.55-ELM_DEM.datum+1.8;
function rawHeight(x:number,z:number){const p=planPoint(x,z),h=MAP_ORIGIN.y+elmElevation(p.x,p.z)-ELM_DEM.datum+1.8;
 const distance=polylineDistance(p.x,p.z,[...ELM_POND,ELM_POND[0]]);
 if(inPond(x,z))return ELM_WATER_Y-.15-Math.min(.55,distance*.18);
 // Only the immediate shoreline is authored. Never cap an entire hillside to
 // a cone around the pond: that erased measured relief across the cemetery.
 if(distance>=70)return h;
 const shore=Math.min(h,ELM_WATER_Y+.10+distance*.15);
 const t=Math.max(0,Math.min(1,(distance-50)/20)),blend=t*t*(3-2*t);
 return shore*(1-blend)+h*blend;
}
// Match the actual 2 m collision triangles, including road edges and spawns.
export function elmHeight(x:number,z:number){const start=elmPoint(0,100),gx=Math.floor((x-start.x)/2)*2+start.x,gz=Math.floor((z-start.z)/2)*2+start.z,u=(x-gx)/2,v=(z-gz)/2;
 const a=rawHeight(gx,gz),b=rawHeight(gx+2,gz),c=rawHeight(gx,gz+2),d=rawHeight(gx+2,gz+2);
 return u+v<=1?a+(b-a)*u+(c-a)*v:d+(c-d)*(1-u)+(b-d)*(1-v);
}
export function elmChunks(){const chunks:TerrainChunk[]=[];const start=elmPoint(0,100);for(let x0=start.x;x0<start.x+840;x0+=60)for(let z0=start.z;z0<start.z+420;z0+=60){const vertices:number[]=[],indices:number[]=[];const n=30;for(let j=0;j<=n;j++)for(let i=0;i<=n;i++){const x=x0+i*2,z=z0+j*2;vertices.push(x,elmHeight(x,z),z);}for(let j=0;j<n;j++)for(let i=0;i<n;i++){const a=j*(n+1)+i,b=a+1,c=a+n+1,d=c+1;indices.push(a,c,b,b,c,d);}chunks.push({x:x0+30,z:z0+30,vertices:new Float32Array(vertices),indices:new Uint32Array(indices),surfaces:[]});}return chunks;}
export class ElmwoodWorld extends DetroitWorld{
  private walkers=new Map<number,{d:number;x:number;y:number;z:number;heading:number}>();private walkClock=-1;
  constructor(){super();this.chunks=elmChunks();this.solids=[];this.geoMeshes=[];this.buildingMeshes=[];}
  protected override staticTraffic(){return [];}
  override sampleGround(x:number,z:number,out:GroundSample){super.sampleGround(x,z,out);out.surface=elmDistance(x,z)<3?'pavement':'grass';out.offCourse=!elmInside(x,z)||inPond(x,z);return out;}
  override updateTraffic(time:number,px:number,pz:number){
    if(time<this.walkClock)this.walkers.clear();const dt=this.walkClock<0?0:Math.max(0,Math.min(.1,time-this.walkClock));this.walkClock=time;
    this.advanceTrafficFalls(time,px,pz);
    this.traffic=[];const active=new Set<number>();
    // Closed garden circuit: walkers keep a consistent direction instead of turning at endpoints.
    const path=ELM_PATHS[17];
    for(let id=0;id<10;id++){
      let p=this.walkers.get(id);if(!p){const d=(id*87+time*1.1)%path.length,at=path.sample(d,1.3);p={...at,d,y:elmHeight(at.x,at.z)};this.walkers.set(id,p);}
      if(!this.trafficFalls.has(id)){
        const goal=path.sample(p.d,1.3),gap=Math.hypot(goal.x-p.x,goal.z-p.z);
        if(gap<.15){p.d=(p.d+dt*1.1)%path.length;const next=path.sample(p.d,1.3);Object.assign(p,next);}
        else{const f=Math.min(1,dt*1.1/gap);p.x+=(goal.x-p.x)*f;p.z+=(goal.z-p.z)*f;}
        p.y=elmHeight(p.x,p.z);
      }
      const t=this.applyTrafficFall({id,kind:'pedestrian',...p,speed:1.1});if(Math.hypot(t.x-px,t.z-pz)>140||!this.trafficMayActivate(t))continue;
      this.traffic.push(t);active.add(id);let c=this.trafficBodies.get(id);const b=t.fall?{hx:.65,hy:.38,hz:.9}:trafficBounds('pedestrian');
      if(!c){c=this.physics.createCollider(RAPIER.ColliderDesc.cuboid(b.hx,b.hy,b.hz).setCollisionGroups(0x0002ffff));this.trafficBodies.set(id,c);this.metadata.set(c.handle,b);}
      const size=c.halfExtents();if(size&&Math.abs(size.y-b.hy)>.001)c.setShape(new RAPIER.Cuboid(b.hx,b.hy,b.hz));
      const at=this.trafficFalls.get(id)?.fall.position??t;c.setTranslation({x:at.x,y:elmHeight(at.x,at.z)+b.hy,z:at.z});
    }
    for(const[id,c]of this.trafficBodies)if(!active.has(id)){this.physics.removeCollider(c,true);this.trafficBodies.delete(id);this.metadata.delete(c.handle);}
  }
  protected override onTrafficRecovered(id:number,position:Vec3){
    const path=ELM_PATHS[17];let distance=Infinity,d=0;
    for(let s=0;s<path.length;s+=1){const p=path.sample(s,1.3),gap=Math.hypot(p.x-position.x,p.z-position.z);if(gap<distance){distance=gap;d=s;}}
    this.walkers.set(id,{...position,d,heading:path.sample(d,1.3).heading});
  }
}





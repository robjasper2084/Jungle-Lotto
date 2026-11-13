import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {WATERFOWL,waterfowlPose,type WaterfowlRoute} from './waterfowlPlan.ts';
import canalResidents from './canalWaterfowl.json';
import {LAKE_SWANS,avianFlightHeight} from './avianPopulationPlan.ts';
import {createBirdImpostor} from './birdImpostor.ts';

/** Original small meshes; a single vertex-colour draw per bird, no asset download. */
export function waterfowlGeometry(kind:WaterfowlRoute['plumage']){
 const parts:T.BufferGeometry[]=[];
 const add=(g:T.BufferGeometry,color:number)=>{const c=new T.Color(color),a=new Float32Array(g.attributes.position.count*3);for(let i=0;i<a.length;i+=3){a[i]=c.r;a[i+1]=c.g;a[i+2]=c.b;}g.setAttribute('color',new T.BufferAttribute(a,3));if(g.index){parts.push(g.toNonIndexed());g.dispose();}else parts.push(g);};
 const ell=(color:number,p:number[],s:number[],tilt=0)=>{const g=new T.SphereGeometry(1,14,10);g.scale(s[0],s[1],s[2]);g.rotateX(tilt);g.translate(p[0],p[1],p[2]);add(g,color);};
 const white=0xe9e7da,shadow=0xc9cbbf,black=0x151b18;
 if(kind==='white'){
  ell(white,[0,.15,-.08],[.34,.29,.62]);
  for(const s of [-1,1]){ell(0xf4f1e7,[s*.22,.28,-.14],[.16,.24,.45],-.10);for(let i=0;i<4;i++)ell(i%2?white:shadow,[s*(.25+i*.012),.20-i*.016,-.34-i*.045],[.065,.08,.22],-.2);}
  ell(white,[0,.22,-.64],[.12,.12,.24],-.35);
  const curve=new T.CatmullRomCurve3([[0,.22,.34],[0,.48,.47],[0,.76,.39],[0,1.02,.37],[0,1.13,.52],[0,1.1,.67]].map(p=>new T.Vector3(...p as [number,number,number])));
  add(new T.TubeGeometry(curve,22,.075,8,false),white);
  ell(white,[0,1.09,.65],[.105,.105,.15],.2);
  ell(0xe68d46,[0,1.055,.815],[.055,.041,.12],.25);ell(black,[0,1.10,.737],[.067,.06,.05]);
  for(const s of [-1,1])ell(black,[s*.094,1.11,.69],[.013,.015,.016]);
 }else{
  const drake=kind==='drake',body=drake?0x9a9c8e:0x786a4c;
  ell(body,[0,.10,0],[.18,.17,.32]);ell(drake?0x625241:0x594a34,[0,.17,.17],[.15,.17,.14]);
  ell(drake?0x244c36:0x8b7652,[0,.30,.28],[.095,.115,.115]);
  if(drake)ell(white,[0,.20,.22],[.104,.025,.092]);
  ell(drake?0xbca842:0xa57640,[0,.282,.418],[.071,.025,.095]);
  for(const s of [-1,1]){ell(drake?0x777e73:0x5f503b,[s*.135,.16,-.035],[.064,.115,.23],-.13);ell(0x3f4c87,[s*.178,.14,-.07],[.017,.04,.075]);ell(black,[s*.087,.329,.32],[.011,.012,.012]);for(let i=0;i<4;i++)ell(drake?0xabb0a4:0xa28c62,[s*.17,.10+i*.023,-.04-i*.04],[.01,.012,.07],-.25);}
  ell(black,[0,.14,-.30],[.075,.06,.13],-.35);
 }
 const g=mergeGeometries(parts)!;parts.forEach(p=>p.dispose());g.computeBoundingSphere();return g;
}
export function addWaterfowl(scene:T.Scene){
 const group=new T.Group();group.name='Lagoon and canal swans and ducks';scene.add(group);
 const material=new T.MeshStandardMaterial({vertexColors:true,roughness:.72,metalness:0});
 const geometries=new Map<WaterfowlRoute['plumage'],T.BufferGeometry>();
 const wakeMaterial=new T.LineBasicMaterial({color:0xc1d7ce,transparent:true,opacity:.18,depthWrite:false});
 const routes:WaterfowlRoute[]=[...WATERFOWL,...canalResidents as WaterfowlRoute[],...LAKE_SWANS];
 const birds=routes.map((route,i)=>{
  if(!geometries.has(route.plumage))geometries.set(route.plumage,waterfowlGeometry(route.plumage));
  const holder=new T.Group(),body=new T.Mesh(geometries.get(route.plumage),material);body.scale.setScalar(route.species==='swan'?.93+(i%4)*.035:.98+(i%3)*.035);holder.add(body);body.receiveShadow=false;body.castShadow=false;body.name=route.species+' '+(i+1);group.add(holder);
  const size=route.species==='swan'?1:.5,points:T.Vector3[]=[];
  for(const s of [-1,1])for(let k=0;k<8;k++){const t=k/8,t2=(k+1)/8;points.push(new T.Vector3(s*(.15+t*.6)*size,.015,-(.32+t*1.9)*size),new T.Vector3(s*(.15+t2*.6)*size,.015,-(.32+t2*1.9)*size));}
  const wake=new T.LineSegments(new T.BufferGeometry().setFromPoints(points),wakeMaterial);holder.add(wake);return {holder,body,wake,route,lastTakeoff:-Infinity};
 });
 const farSwans=createBirdImpostor(scene,'swan',16),farDucks=createBirdImpostor(scene,'duck',12);
 let lastUpdate=-Infinity,nearLimit=9,farLimit=12;
 const stats={swans:routes.filter(r=>r.species==='swan').length,lakeSwans:LAKE_SWANS.length,ducks:routes.filter(r=>r.species==='duck').length,maxVisible:nearLimit,visible:0,billboards:0,triangles:birds.reduce((n,b)=>n+b.body.geometry.attributes.position.count/3,0),updateIntervalMs:125};
 return{stats,
  setQuality(quality:string){nearLimit=quality==='smooth'?5:quality==='high'?12:9;farLimit=quality==='smooth'?6:quality==='high'?12:10;stats.maxVisible=nearLimit;lastUpdate=-Infinity;},
  update(time:number,x:number,z:number){
   if(!Number.isFinite(time)||time-lastUpdate<.125)return;lastUpdate=time;
   const candidates=birds.map(bird=>({bird,distance:Math.hypot(x-bird.route.x,z-bird.route.z)})).sort((a,b)=>a.distance-b.distance);
   let close=0,farS=0,farD=0;
   for(const {bird,distance} of candidates){
    bird.holder.visible=false;
    if(distance<100&&close<nearLimit){
     if(distance<22&&time-bird.lastTakeoff>19)bird.lastTakeoff=time;
     const p=waterfowlPose(bird.route,time);
     bird.holder.position.set(p.x,p.y+avianFlightHeight(time-bird.lastTakeoff,'swan'),p.z);
     bird.holder.rotation.y=p.heading;bird.body.rotation.z=p.roll;
     bird.wake.visible=distance<42&&time-bird.lastTakeoff>4.5;
     bird.holder.visible=true;close++;
    }else if(distance>=100&&distance<250){
     const far=bird.route.species==='swan'?farSwans:farDucks;
     const index=bird.route.species==='swan'?farS:farD;
     const max=bird.route.species==='swan'?16:12;
     if(index>=farLimit||index>=max)continue;
     const p=waterfowlPose(bird.route,time),swan=bird.route.species==='swan';
     far.place(index,p.x,p.y+(swan?.9:.5),p.z,swan?2:1,swan?2:1,x,z);
     if(swan)farS++;else farD++;
    }
   }
   farSwans.finish(farS);farDucks.finish(farD);
   stats.visible=close;stats.billboards=farS+farD;
  }
 };

}

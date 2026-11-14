import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import type {ParkTerrain} from './terrain.ts';
import {SHORE_BIRDS,shoreBirdWander,avianFlightHeight} from './avianPopulationPlan.ts';
import {createBirdImpostor} from './birdImpostor.ts';

function colored(g:T.BufferGeometry,color:number){
 const c=new T.Color(color),a=new Float32Array(g.attributes.position.count*3);
 for(let i=0;i<a.length;i+=3){a[i]=c.r;a[i+1]=c.g;a[i+2]=c.b;}
 g.setAttribute('color',new T.BufferAttribute(a,3));
 if(g.index){const out=g.toNonIndexed();g.dispose();return out;}
 return g;
}
function makeGeometry(kind:'goose'|'wader'){
 const parts:T.BufferGeometry[]=[];
 const ell=(color:number,x:number,y:number,z:number,sx:number,sy:number,sz:number)=>{
  const g=new T.SphereGeometry(1,8,6);g.scale(sx,sy,sz);g.translate(x,y,z);parts.push(colored(g,color));
 };
 const rod=(color:number,a:T.Vector3,b:T.Vector3,r:number)=>{
  const d=b.clone().sub(a),g=new T.CylinderGeometry(r,r*.9,d.length(),6,1);
  g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),d.clone().normalize()));
  const mid=a.clone().add(b).multiplyScalar(.5);g.translate(mid.x,mid.y,mid.z);parts.push(colored(g,color));
 };
 if(kind==='goose'){
  ell(0x8d7c67,0,.63,0,.34,.27,.55);ell(0xb2a18b,0,.75,-.1,.31,.17,.35);
  for(const s of [-1,1])ell(0x645a4c,s*.27,.67,-.07,.065,.18,.32);
  rod(0x1d2929,new T.Vector3(0,.70,.33),new T.Vector3(0,1.17,.51),.09);
  ell(0x202d2c,0,1.23,.52,.11,.11,.12);ell(0xe5e5dc,0,1.14,.49,.09,.042,.07);
  ell(0xe2a663,0,1.20,.70,.065,.036,.14);
 }else{
  ell(0x959a94,0,.51,0,.17,.15,.27);
  for(const s of [-1,1])rod(0xb99c6e,new T.Vector3(s*.065,.41,0),new T.Vector3(s*.075,.03,.02),.013);
  rod(0x606a68,new T.Vector3(0,.55,.13),new T.Vector3(0,.79,.26),.046);
  ell(0x68716c,0,.82,.27,.075,.07,.085);
  rod(0xc2ab86,new T.Vector3(0,.81,.35),new T.Vector3(0,.77,.61),.014);
 }
 const result=mergeGeometries(parts)!;parts.forEach(p=>p.dispose());result.computeBoundingSphere();return result;
}

/** Two bounded near mesh pools plus two billboard pools, never bird physics. */
export function addShoreBirds(scene:T.Scene,terrain:ParkTerrain){
 const birds=SHORE_BIRDS.map((bird,i)=>({
  ...bird,height:terrain.height(bird.x,bird.z),lastTakeoff:-Infinity,
  scale:i%3===0?1:i%3===1?.94:1.05
 }));
 const goose=makeGeometry('goose'),wader=makeGeometry('wader');
 const mat=new T.MeshLambertMaterial({vertexColors:true,side:T.DoubleSide});
 const nearGoose=new T.InstancedMesh(goose,mat,16),nearWader=new T.InstancedMesh(wader,mat,12);
 for(const mesh of [nearGoose,nearWader]){mesh.frustumCulled=false;mesh.castShadow=false;mesh.receiveShadow=false;mesh.visible=false;mesh.count=0;mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);scene.add(mesh);}
 nearGoose.name='Coastal geese high detail';nearWader.name='Beach waders high detail';
 const farGoose=createBirdImpostor(scene,'goose',16),farWader=createBirdImpostor(scene,'wader',12);
 const dummy=new T.Object3D();
 let lastUpdate=-Infinity,maxGoose=10,maxWader=6,maxFar=10;
 const stats={total:birds.length,geese:birds.filter(b=>b.kind==='goose').length,waders:birds.filter(b=>b.kind==='wader').length,active:0,billboards:0,maxDraws:4,updateIntervalMs:125};
 function updateKind(kind:'goose'|'wader',nearLimit:number,viewX:number,viewZ:number,time:number){
  const mesh=kind==='goose'?nearGoose:nearWader,billboard=kind==='goose'?farGoose:farWader;
  const candidates=birds.filter(b=>b.kind===kind).map(b=>({bird:b,dist:Math.hypot(viewX-b.x,viewZ-b.z)}))
   .filter(c=>c.dist<245).sort((a,b)=>a.dist-b.dist);
  let nearCount=0,farCount=0;
  for(const {bird:b,dist} of candidates){
   if(dist<24&&time-b.lastTakeoff>14)b.lastTakeoff=time;
   const rise=avianFlightHeight(time-b.lastTakeoff,kind),wander=shoreBirdWander(b.phase,time);
   const x=b.x+wander.along,z=b.z+wander.across,y=b.height+rise;
   if(dist<100&&nearCount<nearLimit){
    dummy.position.set(x,y,z);
    dummy.rotation.set(Math.sin(time*.8+b.phase)*.12*(rise>0?1:0),b.yaw+Math.sin(time*.22+b.phase)*.20,0);
    dummy.scale.setScalar(b.scale);dummy.updateMatrix();mesh.setMatrixAt(nearCount++,dummy.matrix);
   }else if(dist>=100&&farCount<maxFar){
    const size=kind==='goose'?2.15:1.25;
    billboard.place(farCount++,x,y+(kind==='goose'?.92:.54),z,size,size,viewX,viewZ);
   }
  }
  mesh.count=nearCount;mesh.visible=nearCount>0;if(nearCount)mesh.instanceMatrix.needsUpdate=true;
  billboard.finish(farCount);return {nearCount,farCount};
 }
 return{stats,
  setQuality(quality:string){maxGoose=quality==='smooth'?6:quality==='high'?14:10;maxWader=quality==='smooth'?4:quality==='high'?10:6;maxFar=quality==='smooth'?6:quality==='high'?12:10;lastUpdate=-Infinity;},
  update(time:number,x:number,z:number){
   if(!Number.isFinite(time)||!Number.isFinite(x)||!Number.isFinite(z)||time-lastUpdate<.125)return;
   lastUpdate=time;
   const g=updateKind('goose',maxGoose,x,z,time),w=updateKind('wader',maxWader,x,z,time);
   stats.active=g.nearCount+w.nearCount;stats.billboards=g.farCount+w.farCount;
  }
 };
}

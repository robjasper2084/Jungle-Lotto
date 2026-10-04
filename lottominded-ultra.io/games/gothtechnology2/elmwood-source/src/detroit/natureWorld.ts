import * as T from 'three';
import {GLTFLoader} from './compressedGLTFLoader.ts';

export type NatureAnchor={x:number;y:number;z:number;scale?:number};
const smooth=(t:number)=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
/** A closed flight between perches; eased lift/landing, with a short glide. */
export function birdFlight(age:number,index:number,scareUntil=0){
 const period=25+index%3*3,t=(age+index*7)%period,flight=t>12||age<scareUntil;
 const u=flight?(age<scareUntil?(1-(scareUntil-age)/7):((t-12)/(period-12))):0;
 const f=smooth(u),a=f*Math.PI*2,arc=Math.sin(Math.PI*f);
 return {flight,f,x:Math.sin(a)*5,z:(1-Math.cos(a))*4,lift:arc*3,bank:Math.sin(a)*.22,
  flap:flight?(f>.28&&f<.6?.14:1):0,land:smooth(Math.min(f,1-f)*8)};
}

/** Blender GLBs, shared geometry/materials, one instanced petal draw, bounded work. */
export class NatureWorld {
 readonly root=new T.Group();loaded=false;error='';
 private trees:T.Group[]=[];private birds:{root:T.Group;left?:T.Object3D;right?:T.Object3D;home:T.Vector3;index:number;scareUntil:number;cooldown:number;epoch:number;fleeStart:number}[]=[];
 private petals?:T.InstancedMesh;private elapsed=0;private scratch=new T.Object3D();
 readonly anchors:NatureAnchor[];private floor:(x:number,z:number)=>number;
 constructor(parent:T.Object3D,anchors:NatureAnchor[],floor:(x:number,z:number)=>number){
  this.anchors=anchors;this.floor=floor;
  this.root.name='Cherry groves and songbirds';parent.add(this.root);
 }
 async load(){
  const loader=new GLTFLoader();
  try{
   const [a,b,bird,petal]=await Promise.all(['cherry-blossom-1','cherry-blossom-2','american-robin','cherry-petal'].map(n=>loader.loadAsync('/exports/nature/'+n+'.glb')));
   for(const [i,p]of this.anchors.entries()){
    const tree=(i%2?b:a).scene.clone(true);tree.position.set(p.x,p.y,p.z);tree.scale.setScalar(p.scale??1);tree.rotation.y=i*2.4;tree.name='Cherry blossom tree '+(i+1);
    tree.traverse(o=>{if(o instanceof T.Mesh){o.castShadow=true;o.receiveShadow=true;}});this.root.add(tree);this.trees.push(tree);
    // Same branch tip used by the native Blender tree generator, in glTF Y-up.
    const angle=i%2?.25:0,tip=new T.Vector3(Math.cos(angle)*1.4,3.2,-Math.sin(angle)*1.45).multiplyScalar(p.scale??1).applyAxisAngle(new T.Vector3(0,1,0),tree.rotation.y).add(tree.position);
    const robin=bird.scene.clone(true);robin.name='American robin '+(i+1);this.root.add(robin);
    this.birds.push({root:robin,left:robin.getObjectByName('WingLeft'),right:robin.getObjectByName('WingRight'),home:tip,index:i,scareUntil:0,cooldown:0,epoch:0,fleeStart:0});
   }
   let mesh:T.Mesh|undefined;petal.scene.traverse(o=>{if(o instanceof T.Mesh)mesh=o;});if(!mesh)throw Error('Cherry petal mesh missing');
   this.petals=new T.InstancedMesh(mesh.geometry,mesh.material,128);this.petals.name='Falling cherry petals';this.petals.instanceMatrix.setUsage(T.DynamicDrawUsage);this.petals.frustumCulled=false;this.root.add(this.petals);this.loaded=true;
  }catch(e){this.error=String(e);console.warn('Nature assets unavailable',e);}
 }
 update(dt:number,focus:{x:number;z:number},paused:boolean,low=false,reduced=false){
  if(!this.loaded)return;if(!paused)this.elapsed+=Math.min(.1,Math.max(0,dt));
  const now=this.elapsed,distance=low?90:160;
  for(const tree of this.trees)tree.visible=Math.hypot(tree.position.x-focus.x,tree.position.z-focus.z)<distance;
  for(const b of this.birds){
   b.root.visible=Math.hypot(b.home.x-focus.x,b.home.z-focus.z)<distance;
   if(!b.root.visible)continue;
   const near=Math.hypot(b.home.x-focus.x,b.home.z-focus.z)<5;
   // Do not retrigger while the player stands below a perched bird.
   if(b.scareUntil&&now>=b.scareUntil){b.scareUntil=0;b.epoch=now+b.index*7;}
   if(!paused&&!reduced&&near&&now>b.cooldown&&!birdFlight(now-b.epoch,b.index).flight){b.scareUntil=now+7;b.fleeStart=now;b.cooldown=now+22;}
   const f=reduced?birdFlight(0,0):b.scareUntil?birdFlight(now-b.fleeStart,0,7):birdFlight(now-b.epoch,b.index);
   b.root.position.copy(b.home).add(new T.Vector3(f.x,f.lift,f.z));
   b.root.rotation.set(f.flight?-.10:0,f.flight?Math.atan2(Math.cos(f.f*Math.PI*2),Math.sin(f.f*Math.PI*2)*.8):b.index*1.7,f.bank);
   const flap=f.flap*f.land*Math.sin(now*(10.5+b.index*.17))* .65,fold=f.flight?(1-f.land)*1.2:1.2;
   if(b.left)b.left.rotation.z=fold+flap;if(b.right)b.right.rotation.z=-fold-flap;
  }
  const petals=this.petals!;petals.visible=!reduced;const near=this.anchors.map((p,i)=>({p,i,d:Math.hypot(p.x-focus.x,p.z-focus.z)})).filter(a=>a.d<24).sort((a,b)=>a.d-b.d).slice(0,3);
  petals.count=reduced||!near.length?0:low?24:128;
  for(let i=0;i<petals.count;i++){
   const {p}=near[i%near.length],scale=p.scale??1,life=(now*.11+i*.6180339)%1,phase=i*2.399;
   const x=p.x+Math.cos(phase)*1.35*scale+Math.sin(now*.6+phase)*.65+life*.6,z=p.z+Math.sin(phase)*1.35*scale+Math.cos(now*.35+phase)*.45;
   const ground=this.floor(x,z)+.025,start=p.y+3.55*scale,y=Math.max(ground,start-(start-ground)*life);
   this.scratch.position.set(x,y,z);this.scratch.rotation.set(now*.9+phase,phase,now*.7+phase);this.scratch.scale.setScalar(.7+(i%5)*.13);this.scratch.updateMatrix();petals.setMatrixAt(i,this.scratch.matrix);
  }
  petals.instanceMatrix.needsUpdate=true;
 }
 get status(){return {loaded:this.loaded,trees:this.trees.length,birds:this.birds.length,visibleBirds:this.birds.filter(b=>b.root.visible).length,petals:this.petals?.count??0,error:this.error};}
}

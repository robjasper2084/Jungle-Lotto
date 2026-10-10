import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

/** Installed Living Birds mesh and wingbeat, exported through Unity and Blender. */
export class LivingBirdFlock {
 readonly root=new T.Group();private birds:{root:T.Group;mixer:T.AnimationMixer;home:T.Vector3;phase:number}[]=[];
 private previous=0;loaded=false;error='';
 readonly sites:{x:number;y:number;z:number}[];
 constructor(parent:T.Object3D,sites:{x:number;y:number;z:number}[]){this.sites=sites;this.root.name='Living Birds crow flock';parent.add(this.root);}
 async load(url:string){try{
  const data=await new GLTFLoader().loadAsync(url);
  if(!data.animations.length)throw Error('Living Birds flight animation missing');
  for(const [i,p]of this.sites.entries()){
   const root=data.scene.clone(true),mixer=new T.AnimationMixer(root);
   mixer.clipAction(data.animations[0]).play();mixer.setTime(i*.137);
   root.traverse(o=>{if(o instanceof T.Mesh){o.castShadow=false;o.receiveShadow=false;}});
   this.root.add(root);this.birds.push({root,mixer,home:new T.Vector3(p.x,p.y,p.z),phase:i*2.399});
  }this.loaded=true;
 }catch(e){this.error=String(e);console.warn('Living Birds unavailable',e);}}
 update(time:number,focus:{x:number;z:number},low:boolean,reduced:boolean){
  const dt=Math.min(.1,Math.max(0,time-this.previous));this.previous=time;
  this.birds.forEach((b,i)=>{
   b.root.visible=(!low||i%2===0)&&Math.hypot(b.home.x-focus.x,b.home.z-focus.z)<(low?95:180);
   if(!b.root.visible)return;
   const phase=b.phase+(reduced?0:time*.18),radius=9+i%3*2;
   b.root.position.copy(b.home).add(new T.Vector3(Math.sin(phase)*radius,Math.sin(phase*2)*.4,Math.cos(phase)*radius));
   b.root.rotation.set(0,phase+Math.PI/2,reduced?0:Math.sin(phase)*.12);
   if(!reduced)b.mixer.update(dt);
  });
 }
 get status(){return {source:'Dinopunch Living Birds',loaded:this.loaded,visible:this.birds.filter(b=>b.root.visible).length,count:this.birds.length,error:this.error};}
}

import * as T from 'three';
import type {Lamp} from './bridgeLightPlan.ts';

export type LocalLight={position:readonly number[];color:number;intensity:number;distance:number;decay:number};
type PreparedLight={position:T.Vector3;color:T.Color;intensity:number;distance:number;decay:number};
type Interior={lights:PreparedLight[];x:number;z:number};
type StreetSlot={index:number;level:number};

/** Four permanent lights serve both the nearby road and enterable interiors.
 * Visibility never changes their shader count; static lamp pools stay intact. */
export class LocalLightPool {
 readonly lights:T.PointLight[];
 private roadColor=new T.Color(0xffe0a7);
 private posts:readonly Lamp[]=[];
 private slots:readonly StreetSlot[]=[];
 private night=0;
 private interior:Interior|null=null;
 private nearestInterior=Infinity;
 private x=0;private z=0;
 constructor(scene:T.Scene){
  this.lights=Array.from({length:4},(_,i)=>{
   const light=new T.PointLight(0xffe0a7,0,42,2);light.name='Nearby local light '+(i+1);scene.add(light);return light;
  });
 }
 registerInterior(definitions:readonly LocalLight[],root?:T.Object3D){
  if(definitions.length!==3)throw Error('An interior requires its three authored lights');
  root?.updateWorldMatrix(true,false);
  const lights=definitions.map(definition=>{
   const position=new T.Vector3().fromArray(definition.position);
   if(root)position.applyMatrix4(root.matrixWorld);
   return{position,color:new T.Color(definition.color),intensity:definition.intensity,distance:definition.distance,decay:definition.decay};
  });
  const interior:Interior={lights,x:lights.reduce((sum,light)=>sum+light.position.x,0)/3,z:lights.reduce((sum,light)=>sum+light.position.z,0)/3};
  return {request:(active:boolean)=>{
   if(!active)return;
   const distance=(interior.x-this.x)**2+(interior.z-this.z)**2;
   if(distance<this.nearestInterior){this.nearestInterior=distance;this.interior=interior;}
  }};
 }
 beginFrame(x:number,z:number){this.x=x;this.z=z;this.interior=null;this.nearestInterior=Infinity;}
 setStreet(posts:readonly Lamp[],slots:readonly StreetSlot[],night:number){this.posts=posts;this.slots=slots;this.night=night;}
 update(){
  if(this.interior){
   for(let i=0;i<3;i++){
    const light=this.lights[i],source=this.interior.lights[i];
    light.position.copy(source.position);light.color.copy(source.color);light.intensity=source.intensity;light.distance=source.distance;light.decay=source.decay;
   }
   // Keep the nearest exterior lamp available through doors and windows. The
   // full-island static road pools still illuminate every other fixture.
   let nearest=-1,distance=65*65;
   for(let i=0;i<this.posts.length;i++){
    const p=this.posts[i].p,d=(p[0]-this.x)**2+(p[2]-this.z)**2;
    if(d<distance){distance=d;nearest=i;}
   }
   this.streetLight(3,nearest,nearest<0?0:1-T.MathUtils.clamp((Math.sqrt(distance)-30)/35,0,1));
  }else{
   for(let i=0;i<4;i++){const slot=this.slots[i];this.streetLight(i,slot?.index??-1,slot?.level??0);}
  }
 }
 private streetLight(index:number,post:number,level:number){
  const light=this.lights[index],source=this.posts[post];
  light.color.copy(this.roadColor);light.distance=42;light.decay=2;light.intensity=source?this.night*95*level:0;
  if(source)light.position.fromArray(source.p);
 }
}

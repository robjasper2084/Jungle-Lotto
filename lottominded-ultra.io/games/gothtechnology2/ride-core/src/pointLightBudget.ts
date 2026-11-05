import * as T from 'three';

/** Keep interior lighting shader counts fixed as rooms stream in and out.
 * Original emitters keep their transforms, visibility and intensity; only their
 * direct render layer is suppressed. The nearest four illuminate each view. */
export class PointLightBudget {
 readonly pool:T.PointLight[]=[];
 private watched=new Set<T.Object3D>();
 private emitters=new Map<T.PointLight,{mask:number;position:T.Vector3;distance:number}>();
 private own=new Set<T.Object3D>();
 private eye=new T.Vector3();
 private previous:T.Scene['onBeforeRender'];
 private hook:T.Scene['onBeforeRender'];
 private added=({child}:{child:T.Object3D})=>this.watch(child);
 private removed=({child}:{child:T.Object3D})=>this.release(child);
 get status(){return {emitters:this.emitters.size,slots:this.pool.length,active:this.pool.filter(l=>l.intensity>0).length};}
 constructor(private scene:T.Scene,count=4){
  // Reserve shader slots during startup too. Switching 0 -> 4 when the first
  // shop streams in recompiles every already-visible lit material mid-ride.
  for(let i=0;i<count;i++){const light=new T.PointLight('#ffffff',0);light.name='Nearby interior light '+i;this.pool.push(light);this.own.add(light);scene.add(light);}
  this.watch(scene);this.previous=scene.onBeforeRender;
  this.hook=(...args)=>{this.previous.apply(scene,args);this.update(args[2]);};scene.onBeforeRender=this.hook;
 }
 private watch(node:T.Object3D){
  if(this.own.has(node)||this.watched.has(node))return;this.watched.add(node);
  node.addEventListener('childadded',this.added);node.addEventListener('childremoved',this.removed);
  if((node as T.PointLight).isPointLight&&!node.castShadow){const light=node as T.PointLight;this.emitters.set(light,{mask:light.layers.mask,position:new T.Vector3(),distance:0});light.layers.mask=0;}
  node.children.forEach(child=>this.watch(child));
 }
 private release(node:T.Object3D){
  node.children.forEach(child=>this.release(child));if(!this.watched.delete(node))return;
  node.removeEventListener('childadded',this.added);node.removeEventListener('childremoved',this.removed);
  const record=this.emitters.get(node as T.PointLight);if(record){node.layers.mask=record.mask;this.emitters.delete(node as T.PointLight);}
 }
 update(camera:T.Camera){
  camera.getWorldPosition(this.eye);
  const nearby:[T.PointLight,{mask:number;position:T.Vector3;distance:number}][]=[];
  for(const [light,record]of this.emitters){
   if(light.intensity<=0||!(record.mask&camera.layers.mask))continue;
   let visible=true;for(let node:T.Object3D|null=light;node;node=node.parent){if(!node.visible){visible=false;break;}if(node===this.scene)break;}
   if(!visible)continue;light.getWorldPosition(record.position);record.distance=record.position.distanceToSquared(this.eye);
   // Unlimited-distance lights remain eligible. Finite lights get a 30m view margin.
   if(light.distance>0&&record.distance>(light.distance+30)**2)continue;nearby.push([light,record]);
  }
  nearby.sort((a,b)=>a[1].distance-b[1].distance);
  this.pool.forEach((copy,i)=>{copy.layers.mask=camera.layers.mask;const next=nearby[i];if(!next){copy.intensity=0;return;}const [light,record]=next;copy.position.copy(record.position);copy.color.copy(light.color);copy.intensity=light.intensity;copy.distance=light.distance;copy.decay=light.decay;copy.updateMatrixWorld();});
 }
 dispose(){if(this.scene.onBeforeRender===this.hook)this.scene.onBeforeRender=this.previous;this.release(this.scene);this.pool.forEach(l=>{this.scene.remove(l);l.dispose();});}
}

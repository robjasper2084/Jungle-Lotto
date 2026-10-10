import * as T from 'three';
import {GLTFLoader} from './compressedGLTFLoader.ts';
import {FOOD_TRUCK_SITES,FOOD_CART_SITES,VENDORS,foodTruckSolids,type VendorId} from './foodTruckSites.ts';
import {FoodVendorMedia} from './foodVendorMedia.ts';
import {assetConcurrency,loadAssetQueue} from './assetQueue.ts';
import type {SceneryWorld} from './sceneryWorld.ts';
import {heightAt} from './world.ts';
export async function buildFoodTrucks(scene:T.Scene,world:SceneryWorld){
 const models=new Map<string,T.Object3D>();await loadAssetQueue([...Object.values(VENDORS).map(v=>v.asset),'paradise-cart'],assetConcurrency(),async id=>models.set(id,(await new GLTFLoader().loadAsync('/exports/street-life/'+id+'.glb')).scene));const media=new FoodVendorMedia();
 // The original Detroit map reflects X. Reflect the asset's longitudinal axis
 // as well so signs stay readable while the service side still faces the path.
 const contactMaterial=new T.ShaderMaterial({transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,uniforms:{},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec2 vUv;void main(){vec2 q=abs(vUv-.5)*2.;float a=(1.-smoothstep(.55,1.,q.x))*(1.-smoothstep(.65,1.,q.y));gl_FragColor=vec4(.055,.065,.05,a*.24);}' });
 const trucks=FOOD_TRUCK_SITES.map(p=>{const root=models.get(VENDORS[p.vendor].asset)!.clone(true);root.name=VENDORS[p.vendor].name+' · '+p.name;root.scale.z=-1;root.position.set(p.x,p.y,p.z);root.rotation.y=p.yaw;root.traverse(o=>{if(o instanceof T.Mesh){o.castShadow=true;o.receiveShadow=true;}});media.add(root);scene.add(root);
  // Soft contact remains on Smooth where dynamic shadows are disabled. Follow
  // the real ground at every vertex instead of laying a flat rectangle over it.
  const geometry=new T.PlaneGeometry(3.8,7.7,2,4);geometry.rotateX(-Math.PI/2);geometry.rotateY(p.yaw);geometry.translate(p.x,0,p.z);
  const positions=geometry.attributes.position;for(let i=0;i<positions.count;i++)positions.setY(i,heightAt(positions.getX(i),positions.getZ(i))+(p.curbside?.05:.018));geometry.computeBoundingSphere();
  const contact=new T.Mesh(geometry,contactMaterial);contact.name='Sauce Pitt soft ground contact';scene.add(contact);return {root,p,contact};});
 const carts=FOOD_CART_SITES.map(p=>{const root=models.get('paradise-cart')!.clone(true);root.name=p.name;root.scale.z=-1;root.position.set(p.x,p.y,p.z);root.rotation.y=p.yaw;root.traverse(o=>{if(o instanceof T.Mesh)o.castShadow=o.receiveShadow=true;});media.add(root);scene.add(root);return {root,p};});
 for(const solid of foodTruckSolids())world.addBox(solid);
 const dots=new Float32Array(trucks.length*12*3),g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(dots,3));
 const m=new T.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{},vertexShader:'varying float opacity;attribute float life;void main(){opacity=sin(life*3.14159265)*.11;vec4 mv=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mv;gl_PointSize=clamp((35.+life*80.)/max(1.,-mv.z),2.,35.);}',fragmentShader:'varying float opacity;void main(){float r=length(gl_PointCoord-.5);gl_FragColor=vec4(.73,.76,.78,opacity*exp(-r*r*16.));}'});
 const life=new Float32Array(trucks.length*12);g.setAttribute('life',new T.BufferAttribute(life,1));const smoke=new T.Points(g,m);smoke.name='Sauce Pitt light grill smoke';smoke.frustumCulled=false;scene.add(smoke);
 return {count:trucks.length,cartCount:carts.length,update(time:number,focus:{x:number;z:number},low:boolean,reduced:boolean){
  let nearest=Infinity,vendor:VendorId='paradise';for(const {root,p}of [...trucks,...carts]){const d=Math.hypot(p.x-focus.x,p.z-focus.z);root.visible=d<(low?115:200);if(d<nearest){nearest=d;vendor=p.vendor;}}media.update(nearest,vendor,reduced);
  let count=0;for(const {root,p,contact}of trucks){const d=Math.hypot(p.x-focus.x,p.z-focus.z);root.visible=d<(low?115:200);contact.visible=root.visible;if(!root.visible||reduced)continue;
   const stackX=p.x-Math.cos(p.yaw)*.55+Math.sin(p.yaw)*2.5,stackZ=p.z+Math.sin(p.yaw)*.55+Math.cos(p.yaw)*2.5;
   for(let j=0;j<(low?5:12);j++){const t=(time*.12+j/12)%1;dots[count*3]=stackX+t*1.5+Math.sin(j*2.4+time*.3)*.12;dots[count*3+1]=p.y+3.8+t*2.6;dots[count*3+2]=stackZ+t*.5;life[count]=t;count++;}
  }g.setDrawRange(0,count);g.attributes.position.needsUpdate=g.attributes.life.needsUpdate=true;smoke.visible=count>0;
 }};
}

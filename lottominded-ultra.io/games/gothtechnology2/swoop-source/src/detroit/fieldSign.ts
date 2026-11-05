import * as T from 'three';
import {GLTFLoader} from './compressedGLTFLoader.ts';
import type {SceneryWorld} from './sceneryWorld.ts';
import {heightAt} from './world.ts';
/** User-selected Milliken field, observed at local hero (1754.76,161.29).
 * Source-map coordinate and facing are shared by exploration and Royale. */
export const DETROIT_FIELD_SIGN={x:-118.5,z:-1176.6,yaw:Math.PI/2,width:24};
export function fieldSignSightline(x:number,z:number){return x>=DETROIT_FIELD_SIGN.x-3&&x<=-87&&Math.abs(z-DETROIT_FIELD_SIGN.z)<17;}
export function fieldSignSolids(){const p=DETROIT_FIELD_SIGN,parts=[...Array.from({length:12},(_,i)=>({u:-11+i*2,y:3.1,hx:.85,hy:3.1})),{u:-5.6,y:12.0,hx:1.3,hy:4.5},{u:2.2,y:12,hx:5.2,hy:4.4},{u:2.2,y:7.2,hx:3.7,hy:1.7}];return parts.map(({u,y,hx,hy})=>{const x=p.x+Math.cos(p.yaw)*u,z=p.z-Math.sin(p.yaw)*u;return{x,y:heightAt(x,z)+y,z,hx,hy,hz:.40,yaw:p.yaw,kind:'I Love Detroit field sign'};});}
export async function buildFieldSign(scene:T.Scene,world:SceneryWorld){const p=DETROIT_FIELD_SIGN,model=await new GLTFLoader().loadAsync('/exports/street-life/i-love-detroit-field-sign.glb'),root=model.scene;root.name='I Love Detroit · Milliken field landmark';root.position.set(p.x,heightAt(p.x,p.z),p.z);root.rotation.y=p.yaw;root.scale.x=-1;root.traverse(o=>{if(o instanceof T.Mesh)o.castShadow=o.receiveShadow=true;});scene.add(root);for(const s of fieldSignSolids())world.addBox(s);return{update(x:number,z:number,low:boolean){root.visible=Math.hypot(x-p.x,z-p.z)<(low?180:420);}};}

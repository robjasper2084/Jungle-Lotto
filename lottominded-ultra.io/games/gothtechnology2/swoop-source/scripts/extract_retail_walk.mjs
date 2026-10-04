import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {writeFile,mkdir} from 'node:fs/promises';
const root=resolve(import.meta.dirname,'..'),require=createRequire(resolve(root,'scripts/asset-tools/package.json'));
const {NodeIO}=require('@gltf-transform/core'),{ALL_EXTENSIONS}=require('@gltf-transform/extensions');
const T=await import('three'),io=new NodeIO().registerExtensions(ALL_EXTENSIONS);
const original=await io.read('C:/Users/digit/Documents/phone/Digital_Static_Street_Asset_Pack/exports/glb/DS_Man_01/DS_Man_01_LOD0.glb');
const baked=await io.read(resolve(root,'art/animation-polish/gothtech-hero-walk-authoring.glb'));
const animation=baked.getRoot().listAnimations()[0];if(!animation)throw Error('Missing baked animation');
const tracks=new Map(animation.listChannels().map(c=>[c.getTargetNode().getName()+':'+c.getTargetPath(),c.getSampler()]));
const times=Array.from(animation.listSamplers()[0].getInput().getArray());
const bones=baked.getRoot().listSkins()[0].listJoints(),originalBones=original.getRoot().listSkins()[0].listJoints();
const byName=new Map(originalBones.map(n=>[n.getName(),n]));
const matrix=n=>new T.Matrix4().fromArray(n.getWorldMatrix()),quat=n=>new T.Quaternion().setFromRotationMatrix(matrix(n));
const rest=new Map(bones.map(n=>[n.getName(),quat(n)]));
const originalRest=new Map(originalBones.map(n=>[n.getName(),quat(n)]));
const result={name:'Human Basic Motions / GothTech hero retail walk',duration:times.at(-1),times,bones:{},source:'Kevin Iglesias Human Basic Motions 2.4 FREE - installed Unity pack, retargeted and baked in Blender',nominalSpeed:1.4};
const frameMatrices=new Map();
function posed(n,f){
 if(frameMatrices.has(n))return frameMatrices.get(n);
 const p=n.getTranslation().slice(),r=n.getRotation().slice(),s=n.getScale().slice();
 for(const [path,out] of [['translation',p],['rotation',r],['scale',s]]){const sampler=tracks.get(n.getName()+':'+path);if(sampler){const data=sampler.getOutput().getArray(),input=sampler.getInput().getArray(),size=path==='rotation'?4:3;let a=0;while(a<input.length-1&&input[a+1]<=times[f])a++;const b=Math.min(a+1,input.length-1),t=a===b?0:(times[f]-input[a])/(input[b]-input[a]);if(path==='rotation'){const q=new T.Quaternion().fromArray(data,a*4).slerp(new T.Quaternion().fromArray(data,b*4),t);q.toArray(out);}else for(let k=0;k<size;k++)out[k]=data[a*size+k]*(1-t)+data[b*size+k]*t;}}
 const local=new T.Matrix4().compose(new T.Vector3().fromArray(p),new T.Quaternion().fromArray(r),new T.Vector3().fromArray(s));
 const parent=n.getParentNode(),world=parent?posed(parent,f).clone().multiply(local):local;frameMatrices.set(n,world);return world;
}
const worldFrames=[];
for(let f=0;f<times.length;f++){
 frameMatrices.clear();const frame=new Map();
 for(const n of bones){const name=n.getName(),world=posed(n,f);const desired=new T.Quaternion().setFromRotationMatrix(world).multiply(rest.get(name).clone().invert()).multiply(originalRest.get(name));frame.set(name,desired);}
 worldFrames.push(frame);
 for(const n of bones){const name=n.getName(),old=byName.get(name);if(!old)continue;const parent=old.getParentNode(),pq=frame.get(parent?.getName())??(parent?new T.Quaternion().setFromRotationMatrix(new T.Matrix4().fromArray(parent.getWorldMatrix())):new T.Quaternion());const local=pq.clone().invert().multiply(frame.get(name)).normalize();(result.bones[name]??=[]).push(...local.toArray().map(x=>+x.toFixed(7)));}
}
// Root bob is preserved; the runtime removes translation along the walking path.
const hips=bones.find(n=>n.getName()==='Hips'),origHips=byName.get('Hips'),restPos=origHips.getTranslation();result.hipPositions=[];
for(let f=0;f<times.length;f++){const sampler=tracks.get('Hips:translation'),data=sampler?.getOutput().getArray();result.hipPositions.push(...restPos.map((n,i)=>+(n+(data?data[f*3+i]-hips.getTranslation()[i]:0)).toFixed(7)));}
const folder=resolve(root,'public/exports/polish');await mkdir(folder,{recursive:true});
await writeFile(resolve(folder,'hero-retail-walk.json'),JSON.stringify(result));
const drift=Math.max(...bones.map(n=>{const a=new T.Vector3().setFromMatrixPosition(matrix(n)),b=new T.Vector3().setFromMatrixPosition(matrix(byName.get(n.getName())));return a.distanceTo(b);}));
console.log({name:animation.getName(),duration:result.duration,frames:times.length,bones:Object.keys(result.bones).length,bindPositionDrift:drift});
await writeFile(resolve(root,'art/animation-polish/retail-walk-runtime.json'),JSON.stringify({duration:result.duration,frames:times.length,bones:Object.keys(result.bones).length,bindPositionDrift:drift},null,2));

import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import * as T from 'three';import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
for(const file of ['speedboat','hydroplane'])test(file+' ships finite bounded geometry and authored cockpit anchors',async()=>{
 const data=await readFile(new URL('../../public/belle/vehicles/'+file+'.glb',import.meta.url));assert(data.length<1500000);const json=JSON.parse(data.subarray(20,20+data.readUInt32LE(12)).toString());assert(!json.images?.length,'no hidden texture downloads');
 const gltf=await new GLTFLoader().parseAsync(Uint8Array.from(data).buffer,'');gltf.scene.updateMatrixWorld(true);
 let triangles=0,draws=0;gltf.scene.traverse(o=>{if(o instanceof T.Mesh){draws++;const g=o.geometry;triangles+=(g.index?.count??g.getAttribute('position').count)/3;assert(Array.from(g.getAttribute('position').array).every(Number.isFinite));}});assert(triangles<30000);assert(draws<20);
 const box=new T.Box3().setFromObject(gltf.scene),size=box.getSize(new T.Vector3());assert(size.z>7&&size.z<10);assert(size.x>2&&size.x<4.5);assert(size.y<3.2);
 for(const name of ['Driver_Eye','Driver_Hip','Helm_Wheel','Cockpit_Display'])assert(gltf.scene.getObjectByName(name),name);
 const eye=gltf.scene.getObjectByName('Driver_Eye')!.getWorldPosition(new T.Vector3()),hip=gltf.scene.getObjectByName('Driver_Hip')!.getWorldPosition(new T.Vector3()),wheel=gltf.scene.getObjectByName('Helm_Wheel')!.getWorldPosition(new T.Vector3());assert(eye.y>hip.y+.5);assert(wheel.z>hip.z+.5);assert(eye.y<2);
});

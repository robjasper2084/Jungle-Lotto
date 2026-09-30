import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {ElmwoodCompanion,parseDogCommand,type DogTarget} from './elmwood-companion.ts';
import {DogView} from './dog-view.ts';
import {stepBird,type BirdState} from './elmwood-wildlife.ts';
import type {TerrainSampler} from '../simulation/world.ts';
const flat:TerrainSampler={sampleGround(_x,_z,out){out.height=0;out.normal={x:0,y:1,z:0};out.offCourse=false;out.surface='grass';return out;},raycastObstacle(){return null;}};
const rider={x:0,z:0,headingY:0,speed:0};
test('dog finds a route around a short fence without teleporting or passing through it',()=>{
 const terrain:TerrainSampler={...flat,raycastObstacle(o,d,max){if(Math.abs(d.z)<.001)return null;const t=(3-o.z)/d.z,x=o.x+d.x*t;return t>=0&&t<max&&x>-.9&&x<3.1?t:null;}};
 const dog=new ElmwoodCompanion(terrain);dog.reset(rider);for(let i=0;i<600;i++){const x=dog.x,z=dog.z;dog.update({...rider,z:8,speed:1},1/60);if((z-3)*(dog.z-3)<0)assert.ok(dog.x<-.8||dog.x>3);assert.ok(Math.hypot(dog.x-x,dog.z-z)<.5);}
 assert.equal(dog.recoveries,0);assert.ok(dog.z>7);
});
test('dog sits after one second, lies down, stays put and comes when recalled',()=>{
 const dog=new ElmwoodCompanion(flat);dog.reset(rider);for(let i=0;i<60;i++)dog.update(rider,1/60);assert.ok(dog.sit<.2);for(let i=0;i<60;i++)dog.update(rider,1/60);assert.ok(dog.sit>.9);for(let i=0;i<60;i++)dog.update(rider,1/60);assert.ok(dog.sit>.99);
 dog.order('down');for(let i=0;i<60;i++)dog.update(rider,1/60);assert.ok(dog.lie>.99);const x=dog.x,z=dog.z;dog.order('stay');for(let i=0;i<180;i++)dog.update({...rider,z:20,speed:4},1/60);assert.equal(dog.x,x);assert.equal(dog.z,z);assert.ok(dog.lie>.99);dog.order('come');for(let i=0;i<180;i++)dog.update({...rider,z:12},1/60);assert.ok(dog.z>10);assert.ok(dog.lie<.01);
});
test('voice command words route down and bark, without triggering inside other words',()=>{
 assert.deepEqual(parseDogCommand('Good boy, lie down'),{command:'down'});assert.equal(parseDogCommand('situation downtown'),undefined);assert.deepEqual(parseDogCommand('chase people'),{command:'chase',target:'people'});assert.equal(parseDogCommand('bark')?.command,'bark');
});
test('chased geese flee, dog and goose maintain solid separation, recall cancels pursuit',()=>{
 const dog=new ElmwoodCompanion(flat);dog.reset(rider);const bird:BirdState={x:3,north:-3,homeX:3,homeNorth:-3,heading:0,phase:0,age:0,cooldown:0,mode:'roam',kind:'goose',speed:0,swimming:false};
 const target:DogTarget={id:'goose',kind:'goose',x:bird.x,z:-bird.north,radius:.38};dog.order('chase',[target]);let fled=false;
 for(let i=0;i<180;i++){dog.update(rider,1/60,[target]);stepBird(bird,1/60,i/60,{x:0,north:0,active:true},[],[{x:dog.x,z:dog.z,chasing:true}]);target.x=bird.x;target.z=-bird.north;fled||=bird.mode==='flee';assert.ok(Math.hypot(dog.x-bird.x,dog.z+bird.north)>=.879);}
 assert.ok(fled);assert.ok(Math.hypot(bird.x-3,bird.north+3)>3);dog.order('come');assert.equal(dog.command,'follow');
});
test('bark is an excited alert, does not release Stay or start chasing',()=>{
 const dog=new ElmwoodCompanion(flat);dog.reset(rider);dog.order('stay');dog.order('bark',[{id:'g',kind:'goose',x:4,z:1,radius:.38}]);assert.equal(dog.command,'stay');assert.equal(dog.excitement,1);assert.ok(dog.barking>1);const x=dog.x;dog.update(rider,1/60);assert.equal(dog.x,x);
});
test('chase ends at the pond and returns to the rider',()=>{
 const dog=new ElmwoodCompanion(flat);dog.reset(rider);const target:DogTarget={id:'g',kind:'goose',x:4,z:3,radius:.38};dog.order('chase',[target]);target.water=true;dog.update(rider,1/60,[target]);assert.equal(dog.command,'follow');assert.match(dog.note,/Returning/);
});
const loader=new GLTFLoader();loader.register(()=>({name:'headless-textures',loadTexture:()=>Promise.resolve(new T.Texture())}));
const buffer=await fs.readFile(new URL('../../public/exports/glb/DS_Boerboel_01/DS_Boerboel_Elmwood.glb',import.meta.url));
const asset=await loader.parseAsync(buffer.buffer.slice(buffer.byteOffset,buffer.byteOffset+buffer.byteLength),'');
test('shipped Sit and Down animations lower the body, hold paws near ground, and freeze on pause',()=>{
 const view=new DogView(asset),dog=new ElmwoodCompanion(flat);dog.reset(rider);view.update(dog,0);view.root.updateMatrixWorld(true);const pelvis=view.model.getObjectByName('pelvis')!,standing=pelvis.getWorldPosition(new T.Vector3()).y;
 for(const command of ['sit','down'] as const){dog.order(command);for(let i=0;i<120;i++){dog.update(rider,1/60);view.update(dog,1/60);}view.root.updateMatrixWorld(true);assert.equal(view.gait,command);assert.ok(pelvis.getWorldPosition(new T.Vector3()).y<standing-.25);const floors={front:Infinity,hind:Infinity,body:Infinity};view.model.traverse(o=>{const mesh=o as T.SkinnedMesh;if(!mesh.isSkinnedMesh)return;mesh.skeleton.update();const positions=mesh.geometry.getAttribute('position'),v=new T.Vector3();for(let j=0;j<positions.count;j++){v.fromBufferAttribute(positions,j);const part=v.y<.3?(v.z>.12?'front':v.z<-.3?'hind':'body'):'body';mesh.applyBoneTransform(j,v);v.applyMatrix4(mesh.matrixWorld);floors[part]=Math.min(floors[part],v.y);}});for(const [part,y] of Object.entries(floors)){assert.ok(y>=0,command+' '+part+' must not sink below road');assert.ok(y<.08,command+' '+part+' skin must rest near road: '+y);}const time=view.mixer.time;view.update(dog,0);assert.equal(view.mixer.time,time);}
});
test('tail wag is disabled, excitement cannot deform the body, and pause never accumulates offsets',()=>{
 const calm=new DogView(asset),happy=new DogView(asset),dog=new ElmwoodCompanion(flat);dog.reset(rider);dog.excitement=0;calm.update(dog,.1);dog.excitement=1;happy.update(dog,.1);
 for(const view of [calm,happy]){view.root.updateMatrixWorld(true);view.model.traverse(o=>{if((o as T.SkinnedMesh).isSkinnedMesh)(o as T.SkinnedMesh).skeleton.update();});}
 let a!:T.SkinnedMesh,b!:T.SkinnedMesh;calm.model.traverse(o=>{if((o as T.SkinnedMesh).isSkinnedMesh)a=o as T.SkinnedMesh;});happy.model.traverse(o=>{if((o as T.SkinnedMesh).isSkinnedMesh)b=o as T.SkinnedMesh;});
 const positions=a.geometry.getAttribute('position'),p=new T.Vector3(),q=new T.Vector3();let tailMovement=0,bodyMovement=0;
 for(let i=0;i<positions.count;i++){p.fromBufferAttribute(positions,i);q.copy(p);const onTail=p.z<-.485&&Math.abs(p.x)<.045&&p.y>.565;a.applyBoneTransform(i,p);b.applyBoneTransform(i,q);if(onTail)tailMovement=Math.max(tailMovement,p.distanceTo(q));else bodyMovement=Math.max(bodyMovement,p.distanceTo(q));}
 assert.ok(tailMovement<.00001,'tail remains still '+tailMovement);assert.ok(bodyMovement<.00001,'body held steady '+bodyMovement);
 const tail=happy.model.getObjectByName('tail')!,pose=tail.quaternion.clone();for(let i=0;i<120;i++)happy.update(dog,0);assert.ok(pose.equals(tail.quaternion));
});

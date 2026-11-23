import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {CadillacClearance,cadillacLocalBounds,cadillacPartSweep} from './cadillacClearance.ts';
import type {CarGround} from './carController.ts';

const box=(min:number[],max:number[])=>new T.Box3(new T.Vector3(...min),new T.Vector3(...max));
const pose=(height=0)=>new T.Matrix4().makeTranslation(0,height,0);
function body(){const root=new T.Group(),mesh=new T.Mesh(new T.BoxGeometry(2,1.2,4));mesh.position.y=.8;root.add(mesh);return root;}
function ground(obstacles:T.Box3[]=[]):CarGround{
 const ray=new T.Ray(),bounds=new T.Box3(),hit=new T.Vector3();
 return{height:()=>0,land:()=>true,obstructed:()=>false,bridge:()=>({active:false,t:0,side:0}),raycastObstacle(o,d,max,half=0){
  ray.origin.set(o.x,o.y,o.z);ray.direction.set(d.x,d.y,d.z);let nearest=Infinity;
  for(const obstacle of obstacles){bounds.copy(obstacle);bounds.min.x-=half;bounds.max.x+=half;bounds.min.z-=half;bounds.max.z+=half;
   if(bounds.containsPoint(ray.origin))nearest=0;
   else if(ray.intersectBox(bounds,hit))nearest=Math.min(nearest,ray.origin.distanceTo(hit));
  }return nearest<=max?nearest:null;
 }};
}

test('structural bounds are local and cached before later occupants or accessories',()=>{
 const root=body(),parent=new T.Group();parent.position.set(80,3,-100);parent.rotation.y=.8;parent.add(root);
 const clearance=new CadillacClearance(root),initial=cadillacLocalBounds(root);
 assert(initial.min.distanceTo(new T.Vector3(-1,.2,-2))<1e-6);assert(initial.max.distanceTo(new T.Vector3(1,1.4,2))<1e-6);
 root.add(new T.Mesh(new T.BoxGeometry(100,100,100)));
 root.traverse=()=>{throw Error('Unexpected per-frame mesh scan');};
 const result=clearance.bounds(pose(.14));assert(Math.abs(result.max.y-1.54)<1e-6);
 assert(clearance.clearPath([pose(),pose(.14)],ground(),0));
});

test('lowering rejects terrain penetration and raising rejects a thin overhead obstacle',()=>{
 const clearance=new CadillacClearance(body());
 assert(clearance.clearPath([pose(),pose(-.11)],ground(),0));
 assert(!clearance.clearPath([pose(),pose(-.20)],ground(),0));
 const roof=box([-2,1.50,-3],[2,1.51,3]);
 assert(clearance.clearPath([pose()],ground([roof]),0));
 assert(!clearance.clearPath([pose(),pose(.20)],ground([roof]),0));
});

test('sweeps catch an obstacle between clear endpoint volumes',()=>{
 const clearance=new CadillacClearance(body()),roof=box([-2,1.5,-3],[2,1.51,3]),terrain=ground([roof]);
 assert(clearance.clearPath([pose()],terrain,0));assert(clearance.clearPath([pose(2)],terrain,0));
 assert(!clearance.clearPath([pose(),pose(2)],terrain,0));
});

test('cell coverage catches a narrow obstacle between neighboring columns',()=>{
 const clearance=new CadillacClearance(body()),beam=box([.245,1.3,.245],[.255,1.31,.255]);
 assert(!clearance.clearPath([pose()],ground([beam]),0));
});

test('isolated panel volumes avoid inventing a solid corner between a door and bumper',()=>{
 const clearance=new CadillacClearance(body()),door=box([1,.3,-1],[2,1.2,.2]),obstacle=box([1.8,.5,1.8],[2,.8,2]);
 assert(clearance.clearPath([pose()],ground([obstacle]),0,[door]));
 const actualDoorObstacle=box([1.8,.5,-.3],[1.9,.8,-.2]);
 assert(!clearance.clearPath([pose()],ground([actualDoorObstacle]),0,[door]));
});

test('a complete hinge arc stays covered through simultaneous body movement',()=>{
 const root=body(),hinge=new T.Group(),panel=new T.Mesh(new T.BoxGeometry(.04,.9,1.1));
 hinge.position.set(1,.8,.8);panel.position.z=-.55;hinge.add(panel);root.add(hinge);
 const sweep=cadillacPartSweep(root,hinge,-1.03),local=cadillacLocalBounds(hinge),point=new T.Vector3();
 for(let i=0;i<=60;i++){
  hinge.rotation.y=-1.03*i/60;root.updateMatrixWorld(true);
  for(const x of [local.min.x,local.max.x])for(const y of [local.min.y,local.max.y])for(const z of [local.min.z,local.max.z]){
   point.set(x,y,z).applyMatrix4(hinge.matrixWorld);assert(sweep.containsPoint(point));
  }
 }
 assert(sweep.max.x>1.9);
});

test('nonfinite transforms, empty paths, and missing source geometry cannot pass clearance',()=>{
 const clearance=new CadillacClearance(body()),bad=pose();bad.elements[13]=NaN;
 assert(!clearance.clearPath([bad],ground(),0));assert(!clearance.clearPath([],ground(),0));
 assert.throws(()=>new CadillacClearance(new T.Group()),/missing/);
});

import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {buildingFacade,alignBuildingFacade} from './buildingFacade.ts';
test('sloping ground never buries window walls and collision geometry stays unchanged',()=>{
 const points=[[0,0],[12,0],[12,8],[0,8],[0,0]];
 const source=new T.ExtrudeGeometry(new T.Shape(points.map(([x,z])=>new T.Vector2(x,-z))),{depth:18,bevelEnabled:false});
 source.rotateX(-Math.PI/2);source.translate(0,-3,0);source.userData.streetBase=2;
 const before=Array.from(source.getAttribute('position').array),result=buildingFacade(source,points,(x)=>2+x/12);
 assert.equal(result.base,3.24);assert.equal(result.top,15);assert.ok(result.foundation);
 assert.deepEqual(Array.from(source.getAttribute('position').array),before);
 assert.ok(Math.abs(result.facade.boundingBox!.min.y-result.base)<1e-6);
 assert.ok(Math.abs(result.foundation!.boundingBox!.max.y-result.base)<1e-6);
 alignBuildingFacade(result.facade,result.base,result.top);
 const uv=result.facade.getAttribute('uv'),pos=result.facade.getAttribute('position');
 for(const group of result.facade.groups.filter(g=>g.materialIndex===1)){
  for(let i=group.start;i<group.start+group.count;i++){
   if(pos.getY(i)<result.base+.01)assert.ok(Math.abs(uv.getY(i))<1e-6,'window floor starts at zero');
   if(pos.getY(i)>result.top-.01)assert.ok(Math.abs(uv.getY(i)-Math.round(uv.getY(i)))<1e-6,'roof ends at a full texture row');
  }
  for(let start=group.start;start<group.start+group.count;start+=6){
   const values=Array.from({length:6},(_,j)=>uv.getX(start+j));
   assert.ok(Math.abs(Math.min(...values))<1e-6);
   assert.ok(Math.abs(Math.max(...values)*4-Math.round(Math.max(...values)*4))<1e-6,'corner uses a whole window bay');
  }
 }
});

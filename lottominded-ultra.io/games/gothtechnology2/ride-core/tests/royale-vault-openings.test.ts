import test from 'node:test';
import assert from 'node:assert/strict';
import {CombatBlockTerrain} from '../src/royale/combatBlock.ts';
import {findVault,VAULT_SECONDS,vaultPosition} from '../src/royale/vault.ts';
import {RideController,NEUTRAL_ACTIONS} from '../src/controller.ts';
import {staticBoxSweep,type StaticBox} from '../src/staticBoxSweep.ts';
import type {TerrainSampler,Vec3} from '../src/terrain.ts';

const box=(y:number,hy:number,hx=2):StaticBox=>({x:0,y,z:.9,hx,hy,hz:.15,yaw:0,kind:'test'});
function windowTerrain(extra:StaticBox[]=[],lintel=3.1):TerrainSampler{
 const boxes=[box(.39,.39),box(lintel+.25,.25),...extra];
 return{sampleGround(_x,_z,out){return Object.assign(out,{height:0,normal:{x:0,y:1,z:0},offCourse:false,surface:'pavement'});},raycast:()=>null,
  raycastObstacle(o:Vec3,d:Vec3,max:number,r=0){const hits=boxes.map(b=>staticBoxSweep(o,{x:d.x*max,y:d.y*max,z:d.z*max},r,b)).filter((t):t is number=>t!==null);return hits.length?Math.min(...hits)*max:null;}};
}
test('window vaults require a clear opening and reject glass, bars, low headers and blocked landings',()=>{
 const p={x:0,y:0,z:0,headingY:0};assert(findVault(windowTerrain(),p));
 assert.equal(findVault(windowTerrain([box(1.7,.92)]),p),null,'closed glass');
 assert.equal(findVault(windowTerrain([box(1.7,.92,.05)]),p),null,'security bar');
 assert.equal(findVault(windowTerrain([],2.1),p),null,'insufficient headroom');
 assert.equal(findVault(windowTerrain([{...box(1,1),z:2.1,hz:.6}]),p),null,'occupied exit');
});
test('actual training shop windows vault in both directions and recover to walking indoors',async()=>{
 const t=await CombatBlockTerrain.create();try{
  for(const [x,z] of [[-12,1],[12,13]])for(const side of [-1,1])for(const entering of [true,false]){
   const wall=x+side*6,dir=entering?-side:side,p={x:wall-dir*.95,y:0,z,headingY:dir*Math.PI/2};
   const plan=findVault(t,p);assert(plan,JSON.stringify(p));assert((plan.to.x-wall)*dir>.4);
   const c=new RideController(t,{spawn:{position:p,headingY:p.headingY}});c.combatOnFoot=true;c.step(1/120,{...NEUTRAL_ACTIONS,dismount:true});for(let i=0;i<110;i++)c.step(1/120,NEUTRAL_ACTIONS);
    // Test the validated walking approach, not the displaced endpoint of a crash.
    Object.assign(c.poseValue,{x:p.x,y:p.y,z:p.z});
   c.step(1/120,{...NEUTRAL_ACTIONS,vault:true});assert(c.poseValue.footVault>0);
   for(let i=0;i<Math.ceil(VAULT_SECONDS*120)+5;i++)c.step(1/120,NEUTRAL_ACTIONS);
   assert.equal(c.poseValue.footVault,0);assert.equal(c.poseValue.footMode,2);assert(Math.abs(c.poseValue.y)<1e-6);
   assert((c.poseValue.x-wall)*dir>.4,'must cross the physical window');
  }
  for(const p of [{x:0,y:0,z:-26.1,headingY:0},{x:-7,y:0,z:-25.95,headingY:0}])assert(findVault(t,p),'low wall and metal fence');
 }finally{t.dispose();}
});
test('vaults check the ascent and descent, including overhanging obstacles',()=>{
 const p={x:0,y:0,z:0,headingY:0},t=windowTerrain(),plan=findVault(t,p)!;
 const mid=vaultPosition(plan,.5);assert(mid.y>.9);assert(mid.z>0);
 const ceiling={...box(2.15,.1),z:0,hz:.22};assert.equal(findVault(windowTerrain([ceiling]),p),null);
});

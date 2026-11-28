import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ParkTerrain,ProjectedTerrain,type Point} from '../src/terrain.ts';
import {ParkTerrain as OriginalParkTerrain} from '../../../lottominded-ultra.io/games/gothtechnology2/belle-isle-source/game/src/belle/terrain.ts';
import {fromSourceMap,fromSwoopNormal,toSourceMap,toSwoopMapDirection,SWOOP_MAP_ORIGIN,SWOOP_MIN_SCALE} from '../src/geo.ts';
import {pointOnCut,CUT_METRES} from '../../../lottominded-ultra.io/games/gothtechnology2/swoop-source/src/detroit/geography.ts';
import {GEO,BRIDGE_LEVELS} from '../../../lottominded-ultra.io/games/gothtechnology2/swoop-source/src/detroit/geo-profile.ts';
import {CompanionGround} from '../src/companionGround.ts';
import {ElmwoodCompanion} from '../../../lottominded-ultra.io/games/gothtechnology2/belle-isle-source/game/src/detroit/elmwood-companion.ts';

const map=JSON.parse(readFileSync(new URL('../../../lottominded-ultra.io/games/gothtechnology2/belle-isle-source/game/public/belle/map.json',import.meta.url),'utf8'));
const terrain=new ParkTerrain(map,true),original=new OriginalParkTerrain(map,true);
const sample=()=>({height:0,normal:{x:0,y:1,z:0},surface:'pavement' as const,offCourse:false});
const close=(a:number,b:number,tolerance=1e-5)=>assert.ok(Math.abs(a-b)<tolerance,`${a} != ${b}`);
before(async()=>{const first=terrain.prepareSwoop();assert.equal(first,terrain.prepareSwoop(),'one source world is shared');await first;});
after(()=>terrain.sourceWorld.physics.free());

test('full Cut is covered from the southern entrance through Mack',()=>{
  assert.ok(CUT_METRES>2600);
  for(let station=8;station<CUT_METRES;station+=11){const p=pointOnCut(station),b=fromSourceMap(p.x,0,p.z);assert.ok(terrain.containsSwoop(b.x,b.z),`missing source coverage at ${station}m`);const ground=terrain.sampleGround(b.x,b.z,sample());assert.ok(Number.isFinite(ground.height));assert.equal(ground.offCourse,false,`unsupported ground at ${station}m`);}
});
test('all eleven overpasses retain separate floor and deck contacts',()=>{
  assert.equal(GEO.bridges.length,11);
  for(const bridge of GEO.bridges){
    const p=pointOnCut(bridge.at),level=BRIDGE_LEVELS.find(b=>b.name===bridge.name)!;
    const ground=terrain.sourceWorld.sampleGround(p.x,p.z,sample()),deck=terrain.sourceWorld.sampleGround(p.x,p.z,sample(),level.top+.05);
    const floorPoint=fromSourceMap(p.x,ground.height,p.z),deckPoint=fromSourceMap(p.x,deck.height,p.z);
    close(terrain.height(floorPoint.x,floorPoint.z,floorPoint.y),floorPoint.y);
    close(terrain.height(deckPoint.x,deckPoint.z,deckPoint.y),deckPoint.y);
    assert.ok(deckPoint.y-floorPoint.y>3.5,`${bridge.name}: deck/floor collapsed`);
    assert.ok(terrain.land(floorPoint.x,floorPoint.z,floorPoint.y));assert.ok(terrain.land(deckPoint.x,deckPoint.z,deckPoint.y));
  }
});
test('the existing companion keeps real lower and upper bridge contacts through resets and updates',()=>{
  let dog:ElmwoodCompanion|undefined;
  const contact=new CompanionGround(terrain,()=>dog),ground=sample();
  dog=new ElmwoodCompanion({sampleGround(x,z,out){contact.sampleGround(x,z,ground);out.height=ground.height;Object.assign(out.normal,ground.normal);out.offCourse=ground.offCourse;out.surface='pavement';return out;},raycast:(...args)=>terrain.raycast(...args),raycastObstacle:(...args)=>terrain.raycastObstacle(...args)});
  let anchor={x:map.spawn.x,z:map.spawn.z,headingY:map.spawn.heading,speed:0};
  for(const bridge of GEO.bridges){
    const p=pointOnCut(bridge.at),level=BRIDGE_LEVELS.find(b=>b.name===bridge.name)!;
    const floor=terrain.sourceWorld.sampleGround(p.x,p.z,sample()),deck=terrain.sourceWorld.sampleGround(p.x,p.z,sample(),level.top+.05);
    const lower=fromSourceMap(p.x,floor.height,p.z),upper=fromSourceMap(p.x,deck.height,p.z);
    for(const rider of [lower,upper,lower]){
      anchor=contact.anchor(anchor,{...rider,headingY:0,speed:0});
      close(anchor.x,rider.x);close(anchor.z,rider.z);
      contact.reset(()=>dog!.reset(anchor));
      for(let frame=0;frame<12;frame++)dog.update(anchor,1/60);
      assert.ok(Math.abs(dog.y-rider.y)<.3,`${bridge.name}: dog ${dog.y} left rider contact ${rider.y}`);
      assert.ok(Math.hypot(dog.x-rider.x,dog.z-rider.z)<3,`${bridge.name}: dog failed to reset beside rider`);
    }
  }
});
test('mapped normals and surface types match the original source on every ramp',()=>{
  for(const ramp of GEO.ramps)for(const p of ramp.points){
    const base=terrain.sourceWorld.sampleGround(p[0],p[1],sample());
    const source=terrain.sourceWorld.sampleGround(p[0],p[1],sample(),base.height);
    const belle=fromSourceMap(p[0],base.height,p[1]),actual=terrain.sampleGround(belle.x,belle.z,sample(),belle.y);
    const expected=fromSwoopNormal(-source.normal.x,source.normal.y,source.normal.z);
    close(actual.height,source.height+2);close(actual.normal.x,expected.x);close(actual.normal.y,expected.y);close(actual.normal.z,expected.z);assert.equal(actual.surface,source.surface);
  }
});
test('Atwater source datum meets the existing two-metre mainland',()=>{
  const p=pointOnCut(8),b=fromSourceMap(p.x,0,p.z);
  close(terrain.height(b.x,b.z),2,.02);assert.ok(terrain.land(b.x,b.z,2));
});
test('Belle island ground and obstacle queries remain the original implementation',()=>{
  const points=[map.spawn, ...map.landmarks.slice(0,20).map((p:{x:number;z:number})=>({x:p.x,z:p.z}))];
  for(const p of points){if(terrain.containsSwoop(p.x,p.z))continue;close(terrain.height(p.x,p.z),original.height(p.x,p.z));assert.equal(terrain.land(p.x,p.z),original.land(p.x,p.z));assert.equal(terrain.obstructed(p.x,p.z,.4),original.obstructed(p.x,p.z,.4));const o={x:p.x,y:original.height(p.x,p.z)+1,z:p.z},d={x:1,y:0,z:0};assert.equal(terrain.raycastObstacle(o,d,8,.4),original.raycastObstacle(o,d,8,.4));}
});
test('contact query does not confuse source local coordinates with map coordinates',()=>{
  const origin=fromSourceMap(SWOOP_MAP_ORIGIN.x,SWOOP_MAP_ORIGIN.y,SWOOP_MAP_ORIGIN.z);
  const actual=terrain.sampleGround(origin.x,origin.z,sample(),origin.y);
  close(actual.height,origin.y,.06);assert.ok(actual.height<0,'Gratiot trail must retain its lowered grade');
});
test('same-tile fast path matches full interval queries against the real source physics',()=>{
  const coverage=terrain.swoopCoverage,fullTile=coverage.coversRayInOneTile,split=coverage.segments;
  let intervalQueries=0,checked=0;
  coverage.segments=function(...args){intervalQueries++;return split.apply(this,args);};
  try{
    for(let station=40;station<CUT_METRES;station+=247){
      const p=pointOnCut(station),height=terrain.sourceWorld.sampleGround(p.x,p.z,sample()).height;
      const origin=fromSourceMap(p.x,height+1,p.z),mapOrigin=toSourceMap(origin.x,origin.y,origin.z);
      for(const direction of [{x:0,y:-1,z:0},{x:1,y:0,z:0},{x:.3,y:-1,z:.2}]){
        const length=Math.hypot(direction.x,direction.y,direction.z),d={x:direction.x/length,y:direction.y/length,z:direction.z/length},mapDirection=toSwoopMapDirection(d.x,d.y,d.z),max=4,half=.4;
        if(!fullTile.call(coverage,mapOrigin,mapDirection,max,half/SWOOP_MIN_SCALE))continue;
        const before=intervalQueries,fastGround=terrain.raycast(origin,d,max),fastObstacle=terrain.raycastCamera(origin,d,max,half);
        assert.equal(intervalQueries,before,'full source tile should allocate no interval plan');
        coverage.coversRayInOneTile=()=>false;
        const referenceGround=terrain.raycast(origin,d,max),referenceObstacle=terrain.raycastCamera(origin,d,max,half);
        coverage.coversRayInOneTile=fullTile;
        assert.equal(intervalQueries,before+2,'reference path must use original interval splitting');
        assert.equal(fastGround,referenceGround);assert.equal(fastObstacle,referenceObstacle);checked++;
      }
    }
    assert.ok(checked>=20,`only ${checked} full-tile source queries exercised`);
  }finally{coverage.coversRayInOneTile=fullTile;coverage.segments=split;}
});
test('unmatched host footprints stay solid while verified source replacements avoid double collision',()=>{
  const p=pointOnCut(40),sourceGround=terrain.sourceWorld.sampleGround(p.x,p.z,sample()).height,b=fromSourceMap(p.x,sourceGround,p.z);
  const collider=terrain.sourceWorld.addBox({x:p.x,y:sourceGround+1,z:p.z,hx:.25,hy:1,hz:.25,kind:'preview-regression'});
  terrain.sourceWorld.physics.step();
  const source=new ProjectedTerrain(terrain.localTerrain),origin={x:b.x-3,y:b.y+1,z:b.z},direction={x:1,y:0,z:0},max=6;
  const baseline=source.raycastObstacle(origin,direction,max,0);
  assert.ok(baseline!==null&&baseline>2.5,'the replacement itself must remain physically present');
  const points:Point[]=[[-1,-1],[1,-1],[1,-.25],[-.25,-.25],[-.25,1],[-1,1],[-1,-1]].map(([x,z]):Point=>[b.x+x,b.z+z]);
  const building={id:'preview-unmatched-footprint-test',name:'Preview regression fixture',points,height:2};
  const box={minX:b.x-1,maxX:b.x+1,minZ:b.z-1,maxZ:b.z+1,height:2,base:b.y,points};
  terrain.map.buildings.push(building);terrain.boxes.push(box);
  try{
    assert.ok(terrain.obstructed(b.x-.7,b.z,.05),'host boxes are conservative even before configuration');
    terrain.configureReplacedHostBuildings(new Set());
    assert.ok(terrain.obstructed(b.x-.7,b.z,.05));
    assert.equal(terrain.obstructed(b.x+.7,b.z+.7,.05),false,'an empty polygon corner must stay open');
    const retained=terrain.raycastCamera(origin,direction,max,0);
    assert.ok(retained!==null&&retained<baseline-.5,'visible host wall must stop the ray first');
    terrain.configureReplacedHostBuildings(new Set([building.id]));
    assert.equal(terrain.boxes.includes(box),false,'hidden original also leaves inherited outside-coverage queries');
    close(terrain.raycastCamera(origin,direction,max,0)!,baseline);
    assert.equal(terrain.obstructed(b.x-.7,b.z,.05),false,'the hidden larger host footprint is gone');
    assert.ok(terrain.obstructed(b.x,b.z,.05),'the source replacement collider is still solid');
    terrain.configureReplacedHostBuildings(new Set());
    assert.ok(terrain.boxes.includes(box),'reconfiguration preserves the original live object');
    box.base=b.y+5;
    close(terrain.raycastCamera(origin,direction,max,0)!,baseline);
  }finally{
    terrain.configureReplacedHostBuildings(new Set());
    terrain.map.buildings.splice(terrain.map.buildings.indexOf(building),1);
    terrain.boxes.splice(terrain.boxes.indexOf(box),1);
    terrain.sourceWorld.metadata.delete(collider.handle);terrain.sourceWorld.physics.removeCollider(collider,true);terrain.sourceWorld.physics.step();
  }
});
test('a replaced host box cannot remain as an invisible obstacle outside the source floor',()=>{
  const bounds=terrain.swoopCoverage.bounds,p={x:bounds.minX-20,y:200,z:(bounds.minZ+bounds.maxZ)/2},b=fromSourceMap(p.x,p.y,p.z);
  const collider=terrain.sourceWorld.addBox({...p,y:p.y+1,hx:.25,hy:1,hz:.25,kind:'preview-regression'});
  terrain.sourceWorld.physics.step();
  const origin={x:b.x-3,y:b.y+1,z:b.z},direction={x:1,y:0,z:0},max=6;
  assert.equal(terrain.containsSwoop(origin.x,origin.z),false);assert.equal(terrain.containsSwoop(origin.x+max,origin.z),false);
  const baseline=new ProjectedTerrain(terrain.localTerrain).raycastObstacle(origin,direction,max,0);
  assert.ok(baseline!==null&&baseline>2.5);
  const points:Point[]=[[-1,-1],[1,-1],[1,1],[-1,1],[-1,-1]].map(([x,z]):Point=>[b.x+x,b.z+z]);
  const building={id:'preview-outside-replacement-test',name:'Preview regression fixture',points,height:2};
  const box={minX:b.x-1,maxX:b.x+1,minZ:b.z-1,maxZ:b.z+1,height:2,base:b.y,points};
  terrain.map.buildings.push(building);terrain.boxes.push(box);
  try{
    assert.ok(terrain.raycastCamera(origin,direction,max,0)!<baseline-.5);
    terrain.configureReplacedHostBuildings(new Set([building.id]));
    close(terrain.raycastCamera(origin,direction,max,0)!,baseline);
  }finally{
    terrain.configureReplacedHostBuildings(new Set());
    terrain.map.buildings.splice(terrain.map.buildings.indexOf(building),1);terrain.boxes.splice(terrain.boxes.indexOf(box),1);
    terrain.sourceWorld.metadata.delete(collider.handle);terrain.sourceWorld.physics.removeCollider(collider,true);terrain.sourceWorld.physics.step();
  }
});

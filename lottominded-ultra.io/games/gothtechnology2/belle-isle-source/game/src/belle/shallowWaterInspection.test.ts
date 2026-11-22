import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inside,ParkTerrain,type ParkMap} from './terrain.ts';
import {planShallows} from './shallowWater.ts';
import {planShallowWaterInspection} from './shallowWaterInspection.ts';
const map:ParkMap=JSON.parse(readFileSync(new URL('../../public/belle/map.json',import.meta.url),'utf8'));

test('inspection view follows mapped dry path and actual submerged stone positions',()=>{
 const original=JSON.stringify(map);
 const terrain=new ParkTerrain(map),view=planShallowWaterInspection(map,terrain);
 assert(view,'a genuine safe bank view and three nearby stones must be available');
 assert.deepEqual(view,planShallowWaterInspection(map,terrain),'camera selection must be deterministic');
 assert(terrain.land(view.x,view.z),'camera must be on existing dry land');
 assert(!terrain.obstructed(view.x,view.z,1.2),'camera must be clear of physical obstacles');
 assert(!terrain.bridge(view.x,view.z).active,'camera must not occupy MacArthur roadway');
 assert(view.roadDistance<=1.8&&view.nearbyStones>=3);
 assert(view.pitch>=.18&&view.pitch<=.55);
 assert(view.targetStone.y+view.targetStone.size*.73<1.05,'aimed rock must remain beneath real surface');
 assert(map.water.some(w=>inside(view.lookX,view.lookZ,w.points)&&!w.holes.some(h=>inside(view.lookX,view.lookZ,h))));
 assert(planShallows(map).stones.some(s=>s.x===view.lookX&&s.z===view.lookZ));
 assert.equal(JSON.stringify(map),original,'inspection must not edit gameplay map/physics');
});

test('no fabricated view is returned when actual dry-bank access is absent',()=>{
 const blocked={land:()=>false,height:()=>2,bridge:()=>({active:false}),obstructed:()=>false};
 assert.equal(planShallowWaterInspection(map,blocked as never),null);
});

test('real Guide action and screenshot script use the map-derived view, not injected browser poses',()=>{
 const main=readFileSync(new URL('./main.ts',import.meta.url),'utf8');
 const script=readFileSync(new URL('../../scripts/shallow-water-visual-acceptance.mjs',import.meta.url),'utf8');
 assert(main.includes('planShallowWaterInspection(data,terrain)'));
 assert(main.includes("scenicCard('Lagoon · submerged stone bed'"));
 assert(main.includes('cameraPitch=view?.pitch??.035'));
 assert(script.includes('Inspect shallow water'));
 assert(script.includes('gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0)'));
 assert(script.includes('toBeGreaterThan(first+2)'));
 assert(!script.includes('window.__setPose'));
 assert(!script.includes('page.evaluate(()=>core.reset'));
});

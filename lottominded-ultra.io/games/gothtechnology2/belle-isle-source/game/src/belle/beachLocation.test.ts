import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createBeachLocator} from './beachLocation.ts';

const square={kind:'beach',name:'Mapped beach',points:[[0,0],[10,0],[10,10],[0,10]] as [number,number][]};
test('beach locator uses containment rather than proximity',()=>{
 const locate=createBeachLocator([square]);
 assert.equal(locate(1,1),'Mapped beach');
 for(const p of [[-1,1],[11,1],[1,-1],[1,11]])assert.equal(locate(p[0],p[1]),undefined);
});
test('beach locator includes the mapped outer edge and vertices',()=>{
 const locate=createBeachLocator([square]);
 for(const p of [[0,0],[0,5],[10,10],[5,10]])assert.equal(locate(p[0],p[1]),'Mapped beach');
});
test('beach locator excludes holes including their boundary',()=>{
 const locate=createBeachLocator([{...square,holes:[[[3,3],[7,3],[7,7],[3,7]]]}]);
 assert.equal(locate(2,5),'Mapped beach');
 for(const p of [[5,5],[3,5],[3,3]])assert.equal(locate(p[0],p[1]),undefined);
});
test('beach locator does not mistake a bounding box for the beach',()=>{
 const locate=createBeachLocator([{...square,points:[[0,0],[10,0],[0,10]]}]);
 assert.equal(locate(2,2),'Mapped beach');assert.equal(locate(9,9),undefined);
});
test('beach locator leaves non-beach and unnamed areas to the existing fallback',()=>{
 assert.equal(createBeachLocator([{...square,kind:'grass'}])(5,5),undefined);
 assert.equal(createBeachLocator([{...square,name:'  '}])(5,5),undefined);
 assert.equal(createBeachLocator([])(5,5),undefined);
});
test('beach locator rejects nonfinite positions and degenerate rings',()=>{
 const locate=createBeachLocator([square]);
 for(const n of [NaN,Infinity,-Infinity]){assert.equal(locate(n,5),undefined);assert.equal(locate(5,n),undefined);}
 assert.equal(createBeachLocator([{...square,points:[[0,0],[10,0]]}])(5,0),undefined);
});
test('beach locator works with either winding and a repeated closing vertex',()=>{
 assert.equal(createBeachLocator([{...square,points:[...square.points].reverse()}])(5,5),'Mapped beach');
 assert.equal(createBeachLocator([{...square,points:[...square.points,[0,0]]}])(5,5),'Mapped beach');
});
test('beach locator preserves the map and resolves each named beach independently',()=>{
 const other={...square,name:'Second beach',points:square.points.map(([x,z])=>[x+30,z] as [number,number])};
 const areas=[square,other],before=JSON.stringify(areas),locate=createBeachLocator(areas);
 assert.equal(locate(5,5),'Mapped beach');assert.equal(locate(35,5),'Second beach');assert.equal(locate(20,5),undefined);
 assert.equal(JSON.stringify(areas),before);
});
test('real map identifies the existing public Beach entry and leaves the bridge approach unchanged',()=>{
 const map=JSON.parse(readFileSync(new URL('../../public/belle/map.json',import.meta.url),'utf8'));
 const locate=createBeachLocator(map.areas);
 assert.equal(locate(1949,184),'Belle Isle Beach');
 assert.equal(locate(0,0),undefined);
});
test('public Beach action selects first person and HUD resolution uses actual pose',()=>{
 const main=readFileSync(new URL('./main.ts',import.meta.url),'utf8');
 const start=main.indexOf("if(lm.id==='368854132')");
 assert.ok(start>=0);
 const action=main.slice(start,main.indexOf('c.append(enter);}',start));
 assert.match(action,/jump\(1949,184,/);
 assert.match(action,/core\.advance\(1\/60,\{dismount:true\}\);chooseView\(true\);/);
 assert.match(main,/const beachPlace=createBeachLocator\(data\.areas\)/);
 assert.match(main,/beachPlace\(pose\.x,pose\.z\)\?\?nearest\.name/);
 assert.ok(!action.includes("el('place').textContent="),'arrival must not force a HUD label');
});

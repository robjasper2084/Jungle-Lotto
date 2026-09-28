import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {ElmwoodTerrain,inElmwoodPond} from './elmwood-terrain.ts';
const read=(n:string)=>JSON.parse(fs.readFileSync(new URL('../../public/elmwood/'+n,import.meta.url),'utf8'));
const site=read('site.json'),placements=read('placements.json'),info=read('landmark-improvements.json');
const t=new ElmwoodTerrain(read('terrain.json'),site.features,placements);
test('pond is below its visible water surface and clear of mapped riding lanes',()=>{
 const [x,n,y]=info.pond.center;assert.ok(inElmwoodPond(x,n,site.features));assert.ok(t.ground(x,n)<y-.2);
 for(const s of t.segments){for(let i=0;i<=10;i++){const f=i/10;assert.equal(inElmwoodPond(s.a[0]+(s.b[0]-s.a[0])*f,s.a[1]+(s.b[1]-s.a[1])*f,site.features),false,`Pond intersects path ${s.feature.id}`);}}
});
test('avenue trees preserve lane and architecture clearance',()=>{
 const trees=placements.filter((p:any)=>p.avenue);assert.ok(trees.length>100);for(const p of trees){const [x,n,z]=p.position;assert.ok(t.nearest(x,n).distance>=5.8);assert.equal(inElmwoodPond(x,n,site.features),false);assert.ok(Math.abs(t.ground(x,n)-z)<.001);}
});
test('Blender export includes an upward facing pond surface and entrance sign',()=>{
 const data=fs.readFileSync(new URL('../../public/elmwood/models/elmwood-foundation.glb',import.meta.url));const len=data.readUInt32LE(12),g=JSON.parse(data.toString('utf8',20,20+len));const pond=g.nodes.find((n:any)=>n.name==='Elmwood_Pond');assert.ok(pond);const mesh=g.meshes[pond.mesh];const acc=g.accessors[mesh.primitives[0].attributes.NORMAL],v=g.bufferViews[acc.bufferView];const offset=28+len+(v.byteOffset??0)+(acc.byteOffset??0);assert.ok(data.readFloatLE(offset+4)>.99,'Water must face upward in glTF Y-up');
 assert.ok(fs.statSync(new URL('../../public/elmwood/models/elmwood-entrance-sign.glb',import.meta.url)).size>1000);
});

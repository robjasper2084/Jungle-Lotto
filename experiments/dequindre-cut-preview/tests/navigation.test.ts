import test from 'node:test';
import assert from 'node:assert/strict';
import {sourceNavigationRoads} from '../src/navigation.ts';
import {SwoopCoverage} from '../src/terrain.ts';
import {toSourceMap} from '../src/geo.ts';

test('source navigation splits real tile gaps while retaining bridge and road metadata',()=>{
  const coverage=new SwoopCoverage([{x:50,z:50},{x:250,z:50}]);
  const source={id:'bridge',name:'Mapped crossing',kind:'footway',width:3,bridge:true,points:[[-50,50],[350,50]]};
  const roads=sourceNavigationRoads([source],coverage);
  assert.equal(roads.length,2);
  assert.deepEqual(roads.map(r=>({foot:r.foot,bridge:r.bridge,highway:r.highway})),[{foot:true,bridge:true,highway:'footway'},{foot:true,bridge:true,highway:'footway'}]);
  const bounds=roads.map(r=>r.points.map(([x,z])=>Math.round(toSourceMap(x,0,z).x)));
  assert.deepEqual(bounds,[[0,100],[200,300]]);
  assert.deepEqual(source.points,[[-50,50],[350,50]],'source geography stays unchanged');
});

test('navigation preserves contiguous vertices and omits unsupported kinds',()=>{
  const coverage=new SwoopCoverage([{x:50,z:50}]);
  const road={id:'street',name:'Street',kind:'residential',width:9,bridge:false,points:[[10,10],[50,50],[90,10]]};
  const roads=sourceNavigationRoads([road,{...road,id:'unsupported',kind:'construction'}],coverage);
  assert.equal(roads.length,1);assert.equal(roads[0].points.length,3);assert.equal(roads[0].foot,false);
});

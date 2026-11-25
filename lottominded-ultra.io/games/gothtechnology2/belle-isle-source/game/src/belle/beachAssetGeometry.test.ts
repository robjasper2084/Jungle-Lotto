import test from 'node:test';
import assert from 'node:assert/strict';
import {decodeBeachAsset,type BeachAsset} from './beachAssetGeometry.ts';

test('derived beach geometry stays in the bounded legacy placement envelope',()=>{
 for(const [kind,count,limits] of [['driftwood',99,[.501,.426,.476]],['grass',96,[.3,.619,.3]]] as const){
  const {positions,indices}=decodeBeachAsset(kind as BeachAsset);
  assert.equal(indices.length,count*3);
  assert.equal(positions.length%3,0);
  for(let i=0;i<positions.length;i++)assert(Number.isFinite(positions[i])&&Math.abs(positions[i])<=limits[i%3]);
  if(kind==='grass')for(let i=1;i<positions.length;i+=3)assert(positions[i]>=0);
  for(let i=0;i<indices.length;i+=3){
   const [a,b,c]=Array.from(indices.subarray(i,i+3));assert(a!==b&&b!==c&&a!==c);
   assert(Math.max(a,b,c)<positions.length/3);
   const ab=[0,1,2].map(j=>positions[b*3+j]-positions[a*3+j]),ac=[0,1,2].map(j=>positions[c*3+j]-positions[a*3+j]);
   assert(Math.hypot(ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0])>0);
  }
 }
});

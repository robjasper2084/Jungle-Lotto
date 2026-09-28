import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {configureElmwoodFoliage,seasonElmwoodFoliage} from './elmwood-foliage.ts';

test('thin leaf coverage survives mip levels that erased pine and willow canopies',()=>{
 const m=new T.MeshStandardMaterial({map:new T.Texture()});configureElmwoodFoliage(m);
 // Measured average atlas alpha: willow .145, pine .181; previous .45 discarded both.
 for(const coverage of [.145,.181,.28])assert.ok(coverage>m.alphaTest);
 assert.equal(m.alphaHash,true);assert.equal(m.side,T.DoubleSide);assert.equal(m.depthWrite,true);assert.equal(m.transparent,false);
});
test('season switching keeps pines evergreen and restores deciduous leaf coverage',()=>{
 for(const species of ['white-pine','weeping-willow','black-walnut']){
  const m=new T.MeshStandardMaterial({map:species==='black-walnut'?null:new T.Texture()});m.userData.species=species;
  seasonElmwoodFoliage(m,'winter');assert.equal(m.opacity,species==='white-pine'?1:0);
  seasonElmwoodFoliage(m,'summer');assert.equal(m.opacity,1);assert.equal(m.side,T.DoubleSide);assert.equal(m.alphaHash,species!=='black-walnut');
 }
});

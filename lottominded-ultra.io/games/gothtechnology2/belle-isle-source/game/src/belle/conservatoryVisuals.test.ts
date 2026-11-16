import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {tuneConservatoryMaterial} from './conservatoryVisuals.ts';

test('real glass stays transmissive in appearance and does not replace the actual greenhouse',()=>{
 const glass=new T.MeshStandardMaterial({name:'Conservatory clear panes'});
 assert.equal(tuneConservatoryMaterial(glass),'glazing');
 assert.equal(glass.transparent,true);assert(glass.opacity>.25&&glass.opacity<.6);
 assert.equal(glass.depthWrite,false);assert.equal(glass.side,T.DoubleSide);
 assert(glass.metalness<.1&&glass.roughness<.25);
});
test('plant material remains two-sided without flat emissive anime overlays',()=>{
 const leaf=new T.MeshStandardMaterial({name:'Conservatory leaf canopy',roughness:.45,metalness:.7});
 assert.equal(tuneConservatoryMaterial(leaf),'foliage');
 assert.equal(leaf.side,T.DoubleSide);assert(leaf.roughness>=.78);assert.equal(leaf.metalness,0);
});
test('unrelated landmark materials and physical collision configuration are untouched',()=>{
 const granite=new T.MeshStandardMaterial({name:'Casino buff masonry'});
 const before={color:granite.color.getHex(),roughness:granite.roughness,metalness:granite.metalness,side:granite.side};
 assert.equal(tuneConservatoryMaterial(granite),null);
 assert.deepEqual({color:granite.color.getHex(),roughness:granite.roughness,metalness:granite.metalness,side:granite.side},before);
});

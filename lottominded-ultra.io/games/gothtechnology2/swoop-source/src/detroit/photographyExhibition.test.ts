import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fitPhotograph,photographyPlaces} from './photographyExhibition.ts';
import {SUPPLIED_PHOTOGRAPHY} from './suppliedPhotography.ts';
test('new Penny photographs clear all eight original merch posters and the doorways',()=>{
 const places=photographyPlaces('penny');
 places.forEach((p,i)=>{const photo=SUPPLIED_PHOTOGRAPHY[i],size=fitPhotograph(photo.width,photo.height,p.maxWidth,p.maxHeight);assert.ok(Math.abs(size.width/size.height-photo.width/photo.height)<1e-8);assert.ok(p.y+size.height/2+.055<4.2);assert.ok(Math.abs(p.z)+size.width/2+.055<9.4);for(const z of [-6,-2,2,6]){const horizontal=Math.abs(z-p.z)>(1.4+size.width+.11)/2,vertical=Math.abs(2.55-p.y)>(1.8+size.height+.11)/2;assert.ok(horizontal||vertical,'new photo overlaps original poster');}});
});

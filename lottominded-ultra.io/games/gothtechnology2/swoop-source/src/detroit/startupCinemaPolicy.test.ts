import {test} from 'node:test';import assert from 'node:assert/strict';
import {cinemaPlaybackPolicy} from './startupCinemaPolicy.ts';
const menu={featureOpen:false,hidden:false,reduced:false};
test('the startup menu stays still and only an open destination film can play',()=>{assert.equal(cinemaPlaybackPolicy(menu),'none');assert.equal(cinemaPlaybackPolicy({...menu,featureOpen:true}),'feature');assert.equal(cinemaPlaybackPolicy({...menu,featureOpen:true,hidden:true}),'none');});
test('welcome films stop for reduced motion',()=>{assert.equal(cinemaPlaybackPolicy({...menu,reduced:true}),'none');assert.equal(cinemaPlaybackPolicy({...menu,featureOpen:true,reduced:true}),'none');});

import {test} from 'node:test';import assert from 'node:assert/strict';import {Vector3} from 'three';
import {soleSupport,soleFloor} from './soleSupport.ts';
test('compact shoe outline preserves exact heel/toe contact at every rolling angle',()=>{
 const points:Vector3[]=[];for(let y=0;y<=50;y++)for(let z=0;z<=100;z++)points.push(new Vector3(.1,y/1000,z/250-.2));
 const outline=soleSupport(points);assert.equal(outline.length,4);
 for(let i=-180;i<=180;i++){const pitch=i*Math.PI/180,expected=Math.min(...points.map(p=>p.y*Math.cos(pitch)-p.z*Math.sin(pitch)));assert(Math.abs(soleFloor(outline,pitch)-expected)<1e-12);}
});

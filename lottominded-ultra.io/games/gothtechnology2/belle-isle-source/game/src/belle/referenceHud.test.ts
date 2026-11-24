import test from 'node:test';
import assert from 'node:assert/strict';
import {createReferenceHud,referenceLocationRange} from './referenceHud.ts';
import type {ParkMap} from './terrain.ts';

test('circular GPS range contains distant fixes and their uncertainty while preserving the selected minimum',()=>{
 const rider=Object.freeze({x:0,z:0}),fix=Object.freeze({x:1800,z:1400,accuracy:30});
 const range=referenceLocationRange(350,rider,fix);
 assert.ok((Math.hypot(fix.x,fix.z)+fix.accuracy)/range<=.7,'Accuracy area remains within the circular label margin');
 assert.equal(range%50,0,'Range changes use stable 50m steps');
 assert.equal(referenceLocationRange(700,rider,{x:10,z:5,accuracy:5}),700);
 assert.equal(referenceLocationRange(180,rider,undefined),180,'Stop restores the chosen range');
 assert.equal(referenceLocationRange(350,rider,{...fix,x:NaN}),350);
 assert.equal(referenceLocationRange(350,rider,{...fix,accuracy:-1}),350);
});

test('the real circular HUD draws GPS over the rider, clears stopped fixes and does not change the simulation pose',()=>{
 const calls:string[]=[];
 const ctx:any={miterLimit:10,fillStyle:'',clearRect(){calls.push('clear');},fill(){calls.push('fill:'+this.fillStyle);}};
 for(const name of ['fillRect','beginPath','lineTo','moveTo','closePath','stroke','setLineDash','arc','save','translate','rotate','restore'])ctx[name]=()=>{};
 class Element {
  hidden=false;textContent='';innerHTML='';attrs:Record<string,string>={};onclick?:()=>void;
  classList={toggle(){}};
  setAttribute(key:string,value:string){this.attrs[key]=value;}
  querySelector(selector:string):any{return elements[selector];}
 }
 const canvas={getContext:()=>ctx},rangeLabel=new Element(),button=new Element(),panel=new Element();
 const elements:Record<string,unknown>={canvas,button,small:rangeLabel,
  '.reference-speed':new Element(),'.reference-place':new Element(),'.reference-objective':new Element()};
 const previous=Object.getOwnPropertyDescriptor(globalThis,'document');
 Object.defineProperty(globalThis,'document',{configurable:true,value:{createElement:()=>panel,body:{append(){}}}});
 try{
  let fix:{x:number;z:number;accuracy:number}|undefined={x:900,z:600,accuracy:20},projected:[number,number]|undefined;
  const map={island:[[-100,-100],[100,-100],[100,100],[-100,100]],water:[],roads:[],landmarks:[]} as unknown as ParkMap;
  const hud=createReferenceHud(map,{position:()=>fix,draw:(_ctx,px,pz)=>{if(fix){calls.push('gps');projected=[px(fix.x),pz(fix.z)];}}});
  const rider=Object.freeze({x:0,z:0,headingY:.2,speed:0});
  hud.update(rider,true,undefined,'Bridge approach',false);
  assert.ok(calls.indexOf('gps')>calls.indexOf('fill:#a0fffa'),'A coincident GPS marker cannot be hidden beneath the rider arrow');
  assert.ok(Math.hypot(projected![0]-160,projected![1]-160)<160*.7);
  assert.match(rangeLabel.textContent,/GPS/);
  assert.equal(panel.hidden,false);assert.equal(rider.x,0);assert.equal(rider.z,0);
  fix=undefined;calls.length=0;hud.update(rider,true,undefined,'Bridge approach',false);
  assert.equal(calls[0],'clear');assert.ok(!calls.includes('gps'));assert.equal(rangeLabel.textContent,'350 m');
  button.onclick!();hud.update(rider,true,undefined,'Bridge approach',false);
  assert.equal(rangeLabel.textContent,'700 m','The ordinary map range control still works');
  calls.length=0;hud.update(rider,false,undefined,'Bridge approach',false);
  assert.equal(panel.hidden,true);assert.deepEqual(calls,[],'A hidden HUD does not redraw or read location');
 }finally{if(previous)Object.defineProperty(globalThis,'document',previous);else Reflect.deleteProperty(globalThis,'document');}
});

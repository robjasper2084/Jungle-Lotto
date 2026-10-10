import {test} from 'node:test';import assert from 'node:assert/strict';import {LeanGesture} from './royale/combatControls.ts';
test('tap leaning stays selected after release, switches sides, and centres on another tap',()=>{
 const lean=new LeanGesture();lean.down(-1);assert.equal(lean.get(false,false,false,false),-1);
 lean.down(1);assert.equal(lean.get(false,false,false,false),1);lean.down(1);assert.equal(lean.get(false,false,false,false),0);
 lean.down(-1);assert.equal(lean.get(false,true,false,false),1);assert.equal(lean.get(true,true,false,false),0);lean.reset();assert.equal(lean.value,0);
});
test('hold leaning stops on release and keyboard controls remain independent',()=>{
 const lean=new LeanGesture();lean.mode='hold';lean.down(1);assert.equal(lean.get(false,false,false,true),1);assert.equal(lean.get(false,false,false,false),0);
 assert.equal(lean.get(true,false,false,false),-1);
});

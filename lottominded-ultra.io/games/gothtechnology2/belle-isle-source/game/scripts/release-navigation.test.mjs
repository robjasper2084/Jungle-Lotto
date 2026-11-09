import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {revealPracticeCourse} from './release-navigation.mjs';
function fixture({open=false,count=1,disabled=false,tapError=null}={}){
 const calls=[],state={open,count,disabled};
 const locator=selector=>({selector,evaluate:async fn=>{calls.push('read-open');return fn({open:state.open});},tap:async()=>{calls.push('native-tap');if(tapError)throw tapError;state.open=!state.open;}});
 const page={locator};const expect=element=>({toHaveCount:async n=>assert.equal(state.count,n),toBeVisible:async()=>{calls.push('visible:'+element.selector);if(element.selector!== '#trial-practice')assert(state.open,'Course inside closed details is not visible');},toHaveJSProperty:async(key,value)=>assert.equal(state[key],value),toBeEnabled:async()=>assert(!state.disabled)});
 return {page,expect,state,calls};
}
test('a closed practice section is opened through its existing native summary before focus',async()=>{
 const f=fixture();await revealPracticeCourse(f.page,f.expect,'[data-course="onewheel-island-cup-v1"]');assert(f.state.open);assert.equal(f.calls.filter(c=>c==='native-tap').length,1);assert(f.calls.indexOf('native-tap')<f.calls.indexOf('visible:[data-course="onewheel-island-cup-v1"]'));
});
test('already-open details are not toggled closed',async()=>{const f=fixture({open:true});await revealPracticeCourse(f.page,f.expect,'course');assert(!f.calls.includes('native-tap'));});
test('missing, disabled and unopenable courses fail rather than bypass setup',async()=>{
 for(const options of [{count:0},{disabled:true},{tapError:Error('Native tap failed')}]){const f=fixture(options);await assert.rejects(revealPracticeCourse(f.page,f.expect,'course'));}
});
test('release evidence retains the strict classifier, fresh hold and unchanged deadlines',async()=>{
 const source=await readFile(new URL('./release-evidence.mjs',import.meta.url),'utf8');assert.match(source,/await revealPracticeCourse\(page,expect,/);assert.match(source,/assert\.equal\(classification\.status,'passed'/);assert.match(source,/classification\.event\.elapsed,0/);assert.match(source,/classification\.event\.speed,0/);assert.match(source,/report\.checks\.countdownVerified=2/);assert.match(source,/actionMs:90000,loadMs:180000,screenshotMs:150000,closeMs:30000/);assert.match(source,/35\*60\*1000/);
 assert.doesNotMatch(source,/\.open\s*=\s*true/);
});

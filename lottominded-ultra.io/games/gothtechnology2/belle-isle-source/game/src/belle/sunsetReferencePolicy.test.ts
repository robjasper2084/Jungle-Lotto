import test from 'node:test';
import assert from 'node:assert/strict';
import {REFERENCE_STYLE,SUNSET_REFERENCE,seedReferencePreferences} from './sunsetReferencePolicy.ts';
test('approved graphics ship without enabling review cameras or overwriting player settings',()=>{
 assert.equal(REFERENCE_STYLE,true);assert.equal(SUNSET_REFERENCE,false);
 const values=new Map<string,string>([['belle-isle-sky-v1','saved-sky'],['belle-graphics-v1','saved-quality'],['belle-flight-mode','saved-mode']]);
 const storage={getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{values.set(key,value);}};
 seedReferencePreferences(storage);
 assert.equal(values.get('belle-isle-sky-v1'),'saved-sky');assert.equal(values.get('belle-graphics-v1'),'saved-quality');assert.equal(values.get('belle-flight-mode'),'saved-mode');
 assert.equal(values.get('belle-sky-renderer'),'layered');assert.equal(values.get('belle-season-month'),'10');
 values.clear();seedReferencePreferences(storage);assert.equal(JSON.parse(values.get('belle-isle-sky-v1')!).hour,16.45);assert.equal(values.has('belle-graphics-v1'),false);
 seedReferencePreferences(storage,true);assert.equal(values.get('belle-flight-mode'),'drone');
});

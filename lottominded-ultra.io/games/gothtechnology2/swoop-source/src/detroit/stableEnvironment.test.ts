import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {stableEnvironmentShader} from './stableEnvironment.ts';
test('normal-facing VNDF simplification preserves all 256 filter samples',()=>{
 const radical=(n:number)=>{let r=0,place=.5;while(n){r+=(n&1)*place;place*=.5;n>>>=1;}return r;};
 for(const roughness of [.01,.1,.5,1])for(let i=0;i<256;i++){const x=i/256,phi=2*Math.PI*radical(i),r=Math.sqrt(x),a=roughness**2,t1=r*Math.cos(phi),t2=r*Math.sin(phi);const old=[a*t1,a*t2,Math.sqrt(Math.max(0,1-t1*t1-t2*t2))],next=[a*t1,a*t2,Math.sqrt(1-x)],lo=Math.hypot(...old),ln=Math.hypot(...next);old.forEach((v,j)=>assert(Math.abs(v/lo-next[j]/ln)<1e-12));}
});
test('installed PMREM shader has the expected adaptation point',()=>{
 const source=fs.readFileSync(new URL('../../node_modules/three/src/extras/PMREMGenerator.js',import.meta.url),'utf8');const fixed=stableEnvironmentShader(source);assert.notEqual(source,fixed);assert(fixed.includes('sqrt(max(0.0, 1.0 - Xi.x))'));assert(!fixed.includes('1.0 - t1 * t1 - t2 * t2'));assert.equal(stableEnvironmentShader(fixed),fixed);
});

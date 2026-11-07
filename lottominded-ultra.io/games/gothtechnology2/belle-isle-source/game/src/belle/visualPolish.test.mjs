import test from 'node:test';
import assert from 'node:assert/strict';
import {hoverLightLevels,skyFillIntensity,initiallyCollapsedMap,hoverHelpText,entranceShrubVariation} from './visualPolishPolicy.ts';
import {installHoverPresentation} from './visualPolishHud.ts';
import {ASPHALT_PATCH_DETAIL} from './asphaltPolish.ts';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} ~= ${b}`);

test('day headlights are restrained rather than the full night beam',()=>{assert.equal(hoverLightLevels(0,true,false,true).headlights,90);assert.equal(hoverLightLevels(0,true,true,true).headlights,180);});
test('night preserves the previous normal and high-beam intensities',()=>{assert.equal(hoverLightLevels(1,true,false,true).headlights,550);assert.equal(hoverLightLevels(1,true,true,true).headlights,1100);});
test('night preserves LED and underglow levels',()=>{const x=hoverLightLevels(1,true,false,true);near(x.emissive,2.8);near(x.underglow,9);});
test('headlights OFF stays off independently of enabled LED trim',()=>{const x=hoverLightLevels(.5,false,true,true);assert.equal(x.headlights,0);assert.ok(x.emissive>0);});
test('LED OFF stays off independently of enabled headlights',()=>{const x=hoverLightLevels(.5,true,false,false);assert.equal(x.emissive,0);assert.equal(x.underglow,0);assert.ok(x.headlights>0);});
test('all lighting channels are zero when disabled',()=>{assert.deepEqual(hoverLightLevels(1,false,false,false),{headlights:0,underglow:0,emissive:0});});
test('twilight is continuous, monotone and bounded',()=>{let last=0;for(let n=0;n<=1000;n++){const x=hoverLightLevels(n/1000,true,false,true);assert.ok(x.headlights>=last&&x.headlights<=550);last=x.headlights;}const a=hoverLightLevels(.5-1e-6,true,false,true),b=hoverLightLevels(.5+1e-6,true,false,true);assert.ok(b.headlights-a.headlights<.002);});
test('out-of-range and non-finite sky inputs are bounded',()=>{for(const n of [-100,100,NaN,Infinity,-Infinity])for(const x of Object.values(hoverLightLevels(n,true,true,true)))assert.ok(Number.isFinite(x)&&x>=0&&x<=1100);});
test('frame-loop light sampling reuses the supplied output object',()=>{const out={headlights:0,emissive:0,underglow:0};assert.equal(hoverLightLevels(.4,true,false,true,out),out);});
test('hemispheric fill retains the night baseline',()=>{near(skyFillIntensity(0,0),1.18);near(skyFillIntensity(0,1),1.18);});
test('daylight fill has a modest bounded cloudy adjustment',()=>{near(skyFillIntensity(1,0),1.36);near(skyFillIntensity(1,1),1.44);assert.ok(skyFillIntensity(.5,.5)<1.44);});
test('invalid fill inputs cannot create NaN brightness',()=>{assert.equal(skyFillIntensity(NaN,Infinity),1.18);assert.ok(skyFillIntensity(100,-100)<=1.44);});
test('explicit map expansion survives phone and desktop layouts',()=>{for(const w of [320,390,844,1440])assert.equal(initiallyCollapsedMap('false',true,w),false);});
test('explicit map collapse survives phone and desktop layouts',()=>{for(const w of [320,390,844,1440])assert.equal(initiallyCollapsedMap('true',false,w),true);});
test('new phone users start with a collapsed map',()=>{assert.equal(initiallyCollapsedMap(null,true,390),true);assert.equal(initiallyCollapsedMap(null,false,390),true);});
test('wide non-touch desktop keeps its existing expanded default',()=>{assert.equal(initiallyCollapsedMap(null,false,1440),false);assert.equal(initiallyCollapsedMap(null,true,1440),false);});
test('unusable stored values and invalid width are safe',()=>{assert.equal(initiallyCollapsedMap('broken',true,390),true);assert.equal(initiallyCollapsedMap(null,true,NaN),false);});
test('phone guidance contains no keyboard-only instructions',()=>{for(const drone of [true,false]){const text=hoverHelpText(true,drone);assert.match(text,/Left thumb/);assert.doesNotMatch(text,/W \/ S|A \/ D|Space|Shift/);}});
test('desktop guidance preserves the actual flight-mode controls',()=>{assert.match(hoverHelpText(false,true),/strafe/);assert.match(hoverHelpText(false,false),/steer/);});
test('entrance plant variation is deterministic by index',()=>{for(let i=0;i<36;i++)assert.deepEqual(entranceShrubVariation(i),entranceShrubVariation(i));});
test('plants have varied silhouettes while retaining bounded footprints',()=>{const plants=Array.from({length:36},(_,i)=>entranceShrubVariation(i));assert.ok(new Set(plants.map(p=>p.scaleY.toFixed(3))).size>25);for(const p of plants){assert.ok(Math.abs(p.x)<=.07&&Math.abs(p.z)<=.05);assert.ok(p.scaleX>=.43&&p.scaleX<.59);assert.ok(p.scaleY>=.32&&p.scaleY<.49);assert.ok(p.scaleZ>=.41&&p.scaleZ<.55);}});
test('plant variation does not consume global random state',()=>{const random=Math.random;Math.random=()=>{throw Error('global RNG touched');};try{entranceShrubVariation(2);}finally{Math.random=random;}});
test('plant values are finite, including invalid indices',()=>{for(const i of [NaN,Infinity,-Infinity,-1,1e6])for(const v of Object.values(entranceShrubVariation(i)))assert.ok(Number.isFinite(v));});
test('asphalt repairs are world-anchored and derivative-filtered',()=>{assert.match(ASPHALT_PATCH_DETAIL,/asphaltXZ/);assert.match(ASPHALT_PATCH_DETAIL,/fwidth/);assert.match(ASPHALT_PATCH_DETAIL,/repairResolved/);assert.doesNotMatch(ASPHALT_PATCH_DETAIL,/time|sampler2D|texture2D|discard/);});

// Minimal ownership fixture only. Browser integration tests additionally exercise real DOM.
function fixture(missing=false){
 class E {children=[];dataset={};attributes={};parentElement=null;textContent='';className='';constructor(doc){this.ownerDocument=doc;}get childElementCount(){return this.children.length;}append(child){child.parentElement?.remove(child);this.children.push(child);child.parentElement=this;}prepend(child){child.parentElement?.remove(child);this.children.unshift(child);child.parentElement=this;}remove(child){this.children=this.children.filter(c=>c!==child);}setAttribute(k,v){this.attributes[k]=v;}}
 const doc={createElement:()=>new E(doc)},hud=new E(doc),options=new E(doc),summary=new E(doc),actions=new E(doc);
 const lights=new E(doc),sound=new E(doc),exit=new E(doc),takeoff=new E(doc);actions.append(lights);actions.append(sound);actions.append(exit);actions.append(takeoff);hud.append(actions);hud.append(options);
 hud.querySelector=s=>s==='.hover-lighting > div'?options:s==='.hover-lighting > summary'?(missing?null:summary):s.includes('"lights"')?lights:s.includes('"sound"')?sound:null;
 return{hud,options,summary,actions,lights,sound,exit,takeoff};
}
test('lights and sound remain original primary buttons with listeners intact',()=>{const f=fixture();let clicks=0;f.sound.onclick=()=>clicks++;assert.equal(installHoverPresentation(f.hud),true);assert.equal(f.lights.parentElement,f.actions);assert.equal(f.sound.parentElement,f.actions);assert.equal(f.options.children.length,0);f.sound.onclick();assert.equal(clicks,1);});
test('takeoff and dismount remain in the primary action row',()=>{const f=fixture();installHoverPresentation(f.hud);assert.deepEqual(f.actions.children,[f.lights,f.sound,f.exit,f.takeoff]);});
test('installation is idempotent and does not clone controls',()=>{const f=fixture();installHoverPresentation(f.hud);assert.equal(installHoverPresentation(f.hud),false);assert.equal(f.options.children.length,0);assert.equal(f.actions.children.length,4);});
test('a missing expected option host leaves the HUD unmodified',()=>{const f=fixture(true),children=[...f.actions.children];assert.equal(installHoverPresentation(f.hud),false);assert.deepEqual(f.actions.children,children);assert.equal(f.hud.dataset.visualPolish,undefined);});
test('the existing summary describes only its actual optional controls',()=>{const f=fixture();installHoverPresentation(f.hud);assert.equal(f.summary.textContent,'Ride options');assert.match(f.summary.attributes['aria-label'],/flight mode.*LED.*high beam/);assert.doesNotMatch(f.summary.attributes['aria-label'],/hoverbike sound/);});

test('hiding optional flight settings cannot hide the light or sound buttons',()=>{const f=fixture();installHoverPresentation(f.hud);f.options.hidden=true;for(const button of [f.lights,f.sound]){assert.equal(button.parentElement,f.actions);assert.notEqual(button.parentElement,f.options);}});

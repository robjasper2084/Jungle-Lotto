import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';

const {outputFiles}=await build({entryPoints:[fileURLToPath(new URL('./cockpitLcd.ts',import.meta.url))],bundle:true,write:false,platform:'node',format:'esm',logLevel:'error'});
const {CockpitLcd}=await import('data:text/javascript;base64,'+Buffer.from(outputFiles[0].text).toString('base64'));

class Target{
 listeners=new Map();
 addEventListener(name,listener){this.listeners.set(name,[...(this.listeners.get(name)??[]),listener]);}
 emit(type){for(const listener of this.listeners.get(type)??[])listener({type});}
}
class Element extends Target{
 constructor(tag){super();this.tagName=tag;this.children=[];this.style={};this.dataset={};this.attributes={};this.hidden=false;this.textContent='';}
 append(...children){this.children.push(...children);}
 setAttribute(name,value){this.attributes[name]=value;}
}
class Context{
 constructor(){this.reset();this.commands=[];this.fail=undefined;this.lost=false;}
 reset(){Object.assign(this,{fillStyle:'#000000',strokeStyle:'#000000',lineWidth:1,font:'10px sans-serif',textAlign:'start',textBaseline:'alphabetic',direction:'inherit',globalAlpha:1,globalCompositeOperation:'source-over',filter:'none',shadowColor:'rgba(0, 0, 0, 0)',shadowBlur:0,shadowOffsetX:0,shadowOffsetY:0,fontKerning:'auto',fontStretch:'normal',fontVariantCaps:'normal',letterSpacing:'0px',wordSpacing:'0px',lineCap:'butt',lineJoin:'miter',miterLimit:10,lineDashOffset:0});this.transform={a:1,b:0,c:0,d:1,e:0,f:0};this.dash=[];}
 getTransform(){return {...this.transform};}
 getLineDash(){return [...this.dash];}
 isContextLost(){return this.lost;}
 record(operation,args){
  this.fail?.(operation,args);
  const state={globalAlpha:this.globalAlpha,globalCompositeOperation:this.globalCompositeOperation,filter:this.filter,shadowColor:this.shadowColor,shadowBlur:this.shadowBlur,shadowOffsetX:this.shadowOffsetX,shadowOffsetY:this.shadowOffsetY,transform:{...this.transform}};
  if(operation==='strokeRect')Object.assign(state,{strokeStyle:this.strokeStyle,lineWidth:this.lineWidth,lineCap:this.lineCap,lineJoin:this.lineJoin,miterLimit:this.miterLimit,lineDashOffset:this.lineDashOffset,dash:[...this.dash]});
  else state.fillStyle=this.fillStyle;
  if(operation==='fillText')Object.assign(state,{font:this.font,textAlign:this.textAlign,textBaseline:this.textBaseline,direction:this.direction,fontKerning:this.fontKerning,fontStretch:this.fontStretch,fontVariantCaps:this.fontVariantCaps,letterSpacing:this.letterSpacing,wordSpacing:this.wordSpacing});
  this.commands.push({operation,args:[...args],state});
 }
 fillRect(...args){this.record('fillRect',args);}
 strokeRect(...args){this.record('strokeRect',args);}
 fillText(...args){this.record('fillText',args);}
}
const input=(overrides={})=>({speed:10,height:3,heading:1,landed:false,landing:false,boost:false,collision:false,lights:true,gear:'auto',clutch:0,throttle:.4,brake:0,jarvs:{status:'SCANNING',signalLock:true,radarMeters:25,terrainRise:1,memoryCells:3,threat:.25,advice:'Keep scanning',suggestedLift:0,assistEnabled:false},...overrides});

async function fixture({fontsAvailable=true,contextProbe=true,radio=true}={}){
 const context=new Context(),canvas=new Element('canvas'),fonts=new Target();canvas.width=512;canvas.height=384;canvas.getContext=()=>context;
 fonts.status='loaded';fonts.ready=Promise.resolve(fonts);
 const document=new Target();document.body=new Element('body');document.createElement=tag=>tag==='canvas'?canvas:new Element(tag);if(fontsAvailable)document.fonts=fonts;
 Object.assign(globalThis,{document,innerWidth:1194});if(!contextProbe)context.isContextLost=undefined;
 const parent={children:[],add(...children){this.children.push(...children);}};
 const lcd=new CockpitLcd(parent),texture=lcd.root.getObjectByName('Speed altitude heading display').material.map;
 const radioState={title:'Quiet ride',playing:false,volume:.5,count:2},commands=[];let snapshots=0;
 const radioApi={snapshot(){snapshots++;return {...radioState};},command(action){commands.push(action);}};
 if(radio)lcd.connectRadio(radioApi,new Element('canvas'));
 await Promise.resolve();
 const paint=value=>{context.commands=[];const version=texture.version;lcd.update(value);return {commands:structuredClone(context.commands),notifications:texture.version-version};};
 const prime=value=>{paint(value);return paint(value);};
 const click=index=>document.body.children[0].children[index].onclick({stopPropagation(){}});
 return {lcd,context,canvas,fonts,document,texture,radioState,radioApi,commands,snapshots:()=>snapshots,paint,prime,click};
}

test('identical paints preserve initial start/left alignment and omit only duplicate texture notifications',async()=>{
 const f=await fixture(),value=input();const first=f.paint(value),second=f.paint(value),third=f.paint(value);
 assert.equal(first.notifications,1);assert.equal(second.notifications,1);assert.equal(third.notifications,0);
 assert.equal(first.commands.find(c=>c.operation==='fillText').state.textAlign,'start');
 assert.equal(second.commands.find(c=>c.operation==='fillText').state.textAlign,'left');
 assert.deepEqual(third.commands,second.commands,'a reused notification still executes the complete original paint');
 assert.equal(f.snapshots(),3);assert.equal(f.texture.image.width,512);assert.equal(f.texture.image.height,384);assert.equal(f.texture.generateMipmaps,false);
 const d=f.lcd.diagnostics;assert.equal(d.updateCalls,3);assert.equal(d.completedPaints,3);assert.equal(d.textureUpdateRequests,2);assert.equal(d.reusedUpdates,1);assert.equal(d.reuseSupported,true);
});

test('each visible telemetry or JARVS change still notifies and draws the changed value',async()=>{
 const cases=[
  ['speed',value=>value.speed=20],['height',value=>value.height=5],['heading',value=>value.heading=2],
  ['warning',value=>value.collision=true],['mode',value=>value.landed=true],['lights',value=>value.lights=false],
  ['gear',value=>value.gear=2],['brake',value=>value.brake=1],['clutch',value=>value.clutch=1],
  ['boost',value=>value.boost=true],['throttle fraction',value=>value.throttle=.4000000001],
  ['JARVS status',value=>value.jarvs.status='CRITICAL'],['JARVS risk fraction',value=>value.jarvs.threat=.2500000001],
  ['radar',value=>value.jarvs.radarMeters=3],['terrain',value=>value.jarvs.terrainRise=4],
  ['memory',value=>value.jarvs.memoryCells=8],['advice',value=>value.jarvs.advice='Brake now'],
  ['assist',value=>{value.jarvs.assistEnabled=true;value.jarvs.suggestedLift=1;}],
 ];
 for(const [name,change] of cases){const f=await fixture(),value=input(),before=f.prime(value);change(value);const after=f.paint(value);assert.equal(after.notifications,1,name);assert.notDeepEqual(after.commands,before.commands,name);}
});

test('already formatted equal telemetry can reuse without introducing new quantization',async()=>{
 const f=await fixture(),value=input(),before=f.prime(value);
 value.speed+=.000001;value.height+=.000001;value.heading+=.000001;value.jarvs.radarMeters+=.000001;
 const same=f.paint(value);assert.deepEqual(same.commands,before.commands);assert.equal(same.notifications,0);
 value.throttle+=.0000001;const exact=f.paint(value);assert.equal(exact.notifications,1);assert.notDeepEqual(exact.commands,same.commands);
 assert(exact.commands.some(c=>c.operation==='fillRect'&&c.args[0]===24&&c.args[1]===231&&Object.is(c.args[2],150*value.throttle)));
});

test('nonfinite and negative-zero inputs retain the original drawing arguments and recover on change',async()=>{
 for(const overrides of [{throttle:NaN},{heading:Infinity},{height:NaN},{speed:Infinity},{throttle:-0}]){
  const f=await fixture(),value=input(overrides);const before=f.prime(value),repeat=f.paint(value);
  assert.deepEqual(repeat.commands,before.commands);assert.equal(repeat.notifications,0);
  const restored=f.paint(input());assert.equal(restored.notifications,1);assert.notDeepEqual(restored.commands,repeat.commands);
 }
 const f=await fixture(),value=input({throttle:-0});const before=f.prime(value);value.throttle=0;const after=f.paint(value);assert.deepEqual(after.commands,before.commands);assert.equal(after.notifications,0);
});

test('radio page keys use visible title and playing state while page switches retain the latest input',async()=>{
 const f=await fixture(),value=input();f.prime(value);f.click(6);f.paint(value);
 f.radioState.title='A'.repeat(32)+' hidden suffix';const changed=f.paint(value);assert.equal(changed.notifications,1);
 f.radioState.title='A'.repeat(32)+' different suffix';f.radioState.volume=.1;f.radioState.count=40;const same=f.paint(value);assert.equal(same.notifications,0);assert.deepEqual(same.commands,changed.commands);
 f.radioState.playing=true;assert.equal(f.paint(value).notifications,1);
 const newer=input({jarvs:{...value.jarvs,radarMeters:4,advice:'Latest hidden advice'}});assert.equal(f.paint(newer).notifications,0,'hidden JARVS content does not alter the radio image');
 const oldSnapshots=f.snapshots(),oldVersion=f.texture.version;f.context.commands=[];f.click(6);
 assert.equal(f.texture.version,oldVersion+1);assert.equal(f.snapshots(),oldSnapshots+1);
 assert(f.context.commands.some(c=>c.operation==='fillText'&&c.args[0]==='Latest hidden advice'));
 assert(f.context.commands.some(c=>c.operation==='fillText'&&c.args[0]==='SCAN 4m'));
 assert.equal(f.document.body.children[0].children[6].textContent,'Show radio display');
});

test('radio title changes on the hidden page do not notify, but play/pause and the always-visible status do',async()=>{
 const f=await fixture(),value=input(),before=f.prime(value);
 f.radioState.title='New soundtrack';assert.equal(f.paint(value).notifications,0);
 f.radioState.playing=true;const playing=f.paint(value);assert.equal(playing.notifications,1);assert.notDeepEqual(playing.commands,before.commands);
 f.click(6);f.paint(value);value.jarvs.status='CAUTION';const status=f.paint(value);assert.equal(status.notifications,1);assert(status.commands.some(c=>c.operation==='fillText'&&c.args[0]==='JARVS CAUTION'));
 f.radioState.title='';const fallback=f.paint(value);assert.equal(fallback.notifications,1);assert(fallback.commands.some(c=>c.operation==='fillText'&&c.args[0]==='Add your soundtrack'));
});

test('font lifecycle and restored/lost contexts force notifications without changing the input',async()=>{
 const f=await fixture(),value=input();f.prime(value);assert.equal(f.paint(value).notifications,0);
 const initial=f.lcd.diagnostics.invalidations;
 f.fonts.status='loading';f.fonts.emit('loading');assert.equal(f.paint(value).notifications,1);assert.equal(f.paint(value).notifications,1);
 f.fonts.status='loaded';f.fonts.emit('loadingdone');assert.equal(f.paint(value).notifications,1);assert.equal(f.paint(value).notifications,0);
 f.fonts.emit('loadingerror');assert.equal(f.paint(value).notifications,1);
 f.context.lost=true;f.canvas.emit('contextlost');assert.equal(f.paint(value).notifications,1);assert.equal(f.paint(value).notifications,1);
 f.context.reset();f.context.lost=false;f.canvas.emit('contextrestored');const restored=f.paint(value);assert.equal(restored.notifications,1);assert.equal(restored.commands.find(c=>c.operation==='fillText').state.textAlign,'start');
 assert.equal(f.paint(value).notifications,1);assert.equal(f.paint(value).notifications,0);
 assert.equal(f.lcd.diagnostics.invalidations,initial+5);
});

test('a lifecycle invalidation during the radio snapshot or optional state probe cannot be overwritten',async()=>{
 const f=await fixture(),value=input();f.prime(value);
 const original=f.radioApi.snapshot;f.radioApi.snapshot=()=>{f.fonts.emit('loadingdone');return original();};
 assert.equal(f.paint(value).notifications,1);f.radioApi.snapshot=original;assert.equal(f.paint(value).notifications,1);assert.equal(f.paint(value).notifications,0);
 f.context.isContextLost=()=>{f.fonts.emit('loadingdone');return false;};assert.equal(f.paint(value).notifications,1);
 f.context.isContextLost=()=>false;assert.equal(f.paint(value).notifications,1);assert.equal(f.paint(value).notifications,0);
});

test('failed paints preserve radio snapshot order and cannot reuse a partial image',async()=>{
 for(const [label,expectedSnapshots] of [['SWOOP / 2084',0],['MUSIC',1]]){
  const f=await fixture(),value=input();f.prime(value);const before=f.lcd.diagnostics,version=f.texture.version,snapshots=f.snapshots(),error=new Error('paint failure '+label);
  f.context.fail=(operation,args)=>{if(operation==='fillText'&&args[0]===label)throw error;};
  assert.throws(()=>f.paint(value),caught=>caught===error);assert.equal(f.texture.version,version);assert.equal(f.snapshots()-snapshots,expectedSnapshots);
  const failed=f.lcd.diagnostics;assert.equal(failed.updateCalls,before.updateCalls+1);assert.equal(failed.completedPaints,before.completedPaints);assert.equal(failed.reusedUpdates,before.reusedUpdates);assert.equal(failed.invalidations,before.invalidations+1);
  f.context.fail=undefined;assert.equal(f.paint(value).notifications,1);assert.equal(f.lcd.diagnostics.completedPaints,before.completedPaints+1);
 }
});

test('a thrown radio snapshot is propagated at its original paint position and recovery notifies',async()=>{
 const f=await fixture(),value=input();f.prime(value);const original=f.radioApi.snapshot,error=new Error('snapshot failure'),version=f.texture.version;
 f.radioApi.snapshot=()=>{throw error;};assert.throws(()=>f.paint(value),caught=>caught===error);
 assert(f.context.commands.some(c=>c.operation==='fillText'&&c.args[0]==='MPH'));
 assert(!f.context.commands.some(c=>c.operation==='fillRect'&&c.args[1]===244));
 assert.equal(f.texture.version,version);f.radioApi.snapshot=original;assert.equal(f.paint(value).notifications,1);
});

test('missing or throwing optional probes retain complete painting and notification fallback',async()=>{
 const f=await fixture({fontsAvailable:false}),value=input();f.prime(value);const unchanged=f.paint(value);assert.equal(unchanged.notifications,1);assert.equal(f.lcd.diagnostics.reuseSupported,false);
 const supported=await fixture({contextProbe:false});supported.prime(value);assert.equal(supported.paint(value).notifications,0,'the Safari-optional context-loss method is not required');
 for(const key of ['getTransform','getLineDash','isContextLost']){
  const other=await fixture();other.prime(value);other.context[key]=()=>{throw new Error('optional probe unavailable');};const snapshots=other.snapshots();
  const result=other.paint(value);assert.equal(result.notifications,1,key);assert(result.commands.length>30,key);assert.equal(other.snapshots(),snapshots+1,key);
 }
 const missing=await fixture();missing.prime(value);missing.context.getTransform=undefined;assert.equal(missing.paint(value).notifications,1);
});

test('non-opaque or transformed surfaces keep notifying every full paint',async()=>{
 const edits=[context=>context.globalAlpha=.5,context=>context.globalCompositeOperation='destination-over',context=>context.filter='blur(1px)',context=>context.transform.e=.25];
 for(const change of edits){const f=await fixture(),value=input();f.prime(value);change(f.context);assert.equal(f.paint(value).notifications,1);assert.equal(f.paint(value).notifications,1);}
 const f=await fixture(),value=input();f.prime(value);f.canvas.width=1024;assert.equal(f.paint(value).notifications,1);assert.equal(f.paint(value).notifications,1);
});

test('diagnostics are fresh frozen snapshots and controls remain immediately accessible',async()=>{
 const f=await fixture(),before=f.lcd.diagnostics,value=input();assert(Object.isFrozen(before));assert.notEqual(before,f.lcd.diagnostics);assert.throws(()=>{before.updateCalls=999;},TypeError);
 f.paint(value);const after=f.lcd.diagnostics;assert.equal(before.updateCalls,0);assert.equal(after.updateCalls,1);assert.equal(after.source,'hoverbike-lcd');
 for(let i=0;i<6;i++)f.click(i);assert.deepEqual(f.commands,['previous','toggle','next','quieter','louder','library']);
 assert.equal(f.document.body.children[0].attributes['aria-label'],'Cockpit radio and JARVS controls');
 f.lcd.setInteraction({},true);assert.equal(f.document.body.children[0].hidden,false);f.lcd.setVisible(false);assert.equal(f.lcd.root.visible,false);f.lcd.setInteraction({},false);assert.equal(f.document.body.children[0].hidden,true);
});

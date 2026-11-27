// This file supplies deterministic surrounding state and declared fault adapters.
// Every minimap/background/delegate drawing body is extracted by build.mjs.
export function installFixture(binding:any) {
 const {original,candidate,tapes,schedule,visibilityCss}=binding;
 const fields=['fillStyle','strokeStyle','lineWidth','globalAlpha','font','textAlign'];
 const surface=['clearRect','drawImage','beginPath','moveTo','lineTo','closePath','arc','ellipse','fill','stroke','fillRect','fillText','strokeText','save','restore','translate','rotate','setLineDash'];
 const paints=new Set(['fill','stroke','fillRect','fillText','strokeText']);
 const require=(value:any,message:string)=>{if(!value)throw new Error(message);};
 const clone=(v:any)=>structuredClone(v);
 const equal=(a:any,b:any)=>JSON.stringify(a)===JSON.stringify(b);
 const side=new URL(location.href).searchParams.get('side');
 if(side){
  require(['original','candidate','control'].includes(side),'Unknown lane');
  document.head.insertAdjacentHTML('beforeend',`<style>html,body{margin:0;padding:0;background:rgb(40,57,65);font:12px system-ui;direction:ltr;color-scheme:normal}#navigation{margin:0;padding:0;border:0;width:420px;height:290px;background:transparent}#minimap{width:420px;height:290px;display:block;margin:0;padding:0;border:0}#settings{display:none}[hidden]{display:none!important}${visibilityCss}</style>`);
  document.body.innerHTML='<div id="navigation"><canvas id="minimap" width="420" height="290"></canvas></div><div id="settings"><h2>Settings</h2><input id="motion" type="checkbox" checked><select id="quality"><option value="high">High</option></select></div>';
  const minimap=document.getElementById('minimap') as HTMLCanvasElement,navigation=document.getElementById('navigation')!;
  const ctx=minimap.getContext('2d')!,mapLayer=document.createElement('canvas');mapLayer.width=420;mapLayer.height=290;
  const baseCtx=mapLayer.getContext('2d')!;
  require(ctx&&baseCtx,'Native Canvas2D unavailable');
  const data=clone(tapes.data),districts=clone(tapes.districts),courses=clone(tapes.courses);
  let tape=clone(tapes.frames.a),poisoned=false,fault:string|null=null,faultUsed=false,hookMode:string|null=null,currentTick=0,reads=0;
  let beforeBaseRaw:any=null,methodCounts:any={},fieldCounts:any={},providerCalls:any[]=[],events:any[]=[],canonical:any[]=[],tickReceipts:any[]=[];
  const note=(kind:string,detail:any={})=>{require(events.length<256,'Event receipt bound');events.push({kind,tick:currentTick,...detail});};
  const input=(name:string,detail:any=null)=>{require(!poisoned,'Reveal re-sampled '+name);require(providerCalls.length<256,'Provider receipt bound');providerCalls.push({tick:currentTick,clock:tape.clock,name,detail});};
  const state=()=>{
   const m=ctx.getTransform();const properties:any={};for(const k of fields)properties[k]=(ctx as any)[k];
   const invariant:any={};for(const k of ['globalCompositeOperation','lineCap','lineJoin','miterLimit','lineDashOffset','textBaseline','direction','fontKerning','fontStretch','fontVariantCaps','letterSpacing','wordSpacing','shadowBlur','shadowColor','shadowOffsetX','shadowOffsetY','imageSmoothingEnabled','imageSmoothingQuality'])invariant[k]=(ctx as any)[k]??null;
   return {properties,transform:[m.a,m.b,m.c,m.d,m.e,m.f],dash:ctx.getLineDash(),invariant,canvas:{width:minimap.width,height:minimap.height},computed:{font:getComputedStyle(minimap).font,direction:getComputedStyle(minimap).direction},contextAttributes:ctx.getContextAttributes(),isContextLost:ctx.isContextLost()};
  };
  const raw=()=>{reads++;const bytes=ctx.getImageData(0,0,420,290).data;let s='';for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode(...bytes.subarray(i,i+8192));return {data:btoa(s),state:state(),readbacks:reads};};
  const originals=new Map<string,Function>();
  function wrap(native:CanvasRenderingContext2D,role:string){
   for(const name of [...surface,'reset','strokeRect']){
    const fn=(native as any)[name];require(typeof fn==='function','Native operation unavailable '+name);
    if(role==='target')originals.set(name,fn);
    Object.defineProperty(native,name,{configurable:true,value:function(this:any,...args:any[]){
     require(this===native,'Unexpected native receiver');
     const key=role+'.'+name;methodCounts[key]=(methodCounts[key]??0)+1;
     if(role==='base'&&name==='clearRect'&&fault==='observe-before-base-clear'&&!faultUsed){faultUsed=true;beforeBaseRaw=raw();note('old-target-read-before-base-clear');}
     if(role==='target'&&name==='arc'&&fault==='native-arc'&&!faultUsed){faultUsed=true;args=args.slice();args[2]=-1;note('native-invalid-arc');}
     const result=Reflect.apply(fn,native,args);
     if(role==='target'&&name==='clearRect'){
      note('native-background-clear');
      if(fault==='invalid-source'&&!faultUsed){faultUsed=true;mapLayer.width=0;note('private-source-zero-after-clear');}
     }
     if(role==='target'&&name==='drawImage')note('native-background-blit');
     if(role==='target'&&name==='rotate'&&fault==='partial-rotate'&&!faultUsed){faultUsed=true;note('after-native-rotate-error');throw new Error('fixture-after-native-rotate');}
     if(role==='base'&&name==='fillRect'&&fault==='base-fill'&&!faultUsed){faultUsed=true;note('after-native-base-fill-error');throw new Error('fixture-after-native-base-fill');}
     return result;
    }});
   }
   for(const key of fields){
    let proto:any=native,descriptor:any;
    while(proto&&!descriptor){descriptor=Object.getOwnPropertyDescriptor(proto,key);proto=Object.getPrototypeOf(proto);}
    require(descriptor?.get&&descriptor?.set,'Missing native descriptor '+key);
    Object.defineProperty(native,key,{configurable:true,get(){return descriptor.get.call(native);},set(value){fieldCounts[role+'.'+key]=(fieldCounts[role+'.'+key]??0)+1;return descriptor.set.call(native,value);}});
   }
  }
  wrap(ctx,'target');wrap(baseCtx,'base');
  const activityObject:any={get dispatch(){input('activity.dispatch');return tape.activity==='photo'?null:{phase:'dropoffs',contract:{dropoffs:tape.activity==='cap'?Array.from({length:tapes.capFixture.stopCount},(_,i)=>({id:'cap-'+i,x:tapes.capFixture.xOrigin+i%tapes.capFixture.xModulo*tapes.capFixture.xStep,z:tapes.capFixture.zOrigin+Math.floor(i/tapes.capFixture.xModulo)*tapes.capFixture.zStep})):tapes.dispatchStops},completedDropoffIds:[]};},get photoAttempt(){input('activity.photoAttempt');return tape.activity==='photo'?{}:null;},nextSubject(){input('activity.nextSubject');return tapes.photoTarget;},subjectCenter(v:any){input('activity.subjectCenter');return v;}};
  const raceObject={showPaths:true,courses,course:courses[0],rules:{racers:[{id:'self',next:5}]},local:[{id:'self'}]};
  const gpsObject={get state(){input('gps.state');return {status:'tracking',fix:tape.gps};}};
  const env:any={minimap,navigation,ctx,baseCtx,mapLayer,data,districts,districtDestinations:[{id:'city-destination'}],
   opacity:{get value(){input('opacity');return String(tape.opacity);}},performance:{now(){input('performance.now');return tape.clock;}},
   online:{get members(){input('online.members');return [{id:'self'},{id:'one'},{id:'two'}];},get self(){input('online.self');return 'self';},buffers:new Map(['one','two'].map((id,i)=>[id,{sample(time:number){input('online.sample',{id,time});return {pose:tape.remote[i]};}}]))},
   destination(t:any){return data.landmarks[t.destination];},
   makeRace(method:Function){return {drawMap(c:any,px:any,pz:any){input('race.drawMap');return method.call(raceObject,c,px,pz);}};},
   makeActivities(method:Function){return {drawMap(c:any,px:any,pz:any){
    input('activity.drawMap');
    if(hookMode==='canonical'){
     c.fillStyle='#AbC';c.strokeStyle='#12345678';c.lineWidth=-1;c.globalAlpha=2;c.font='12px system-ui';c.textAlign='right';
     canonical.push({phase:'accepted',values:Object.fromEntries(fields.map(k=>[k,c[k]]))});
     c.fillStyle='not-a-color';c.strokeStyle='not-a-color';c.lineWidth=0;c.globalAlpha=-1;c.font='not a valid font';c.textAlign='sideways';
     canonical.push({phase:'ignored-invalid',values:Object.fromEntries(fields.map(k=>[k,c[k]]))});
    }
    const result=method.call(activityObject,c,px,pz);
    if(hookMode==='unsupported'){note('declared-unsupported-strokeRect');c.strokeRect(14,23,31,17);}
    if(hookMode==='reset'){note('declared-unsupported-reset');c.reset();}
    return result;
   }};},
   makeGps(method:Function){return {get snapshot(){input('gps.snapshot');return {status:'tracking',fix:tape.gps};},drawMap(c:any,px:any,pz:any){input('gps.drawMap');return method.call(gpsObject,c,px,pz);}};},
   noteReveal(){note('pre-preset-materialize',{preset:document.body.dataset.hudPreset,providerCalls:providerCalls.length});}
  };
  localStorage.setItem('belle-presentation-v1',JSON.stringify({preset:'exploration',compact:true}));
  const source=(side==='original'?original:candidate)(env);
  const api:any={
   ready:true,sourceKind:source.sourceKind,
   tick(name:string,overrides:any={}){
    poisoned=false;tape={...clone(tapes.frames[name]),...clone(overrides)};currentTick++;
    const before=providerCalls.length,clear=methodCounts['target.clearRect']??0,blit=methodCounts['target.drawImage']??0;
    let error:any=null;try{source.tick(tape);}catch(e:any){error={name:e.name,message:e.message};}
    const receipt={tick:currentTick,tapeName:name,tape:clone(tape),providerReads:providerCalls.length-before,clears:(methodCounts['target.clearRect']??0)-clear,blits:(methodCounts['target.drawImage']??0)-blit,error};tickReceipts.push(receipt);return receipt;
   },
   preset(value:string,poison=false){if(poison)poisoned=true;const before=providerCalls.length;const p=document.getElementById('hud-preset') as HTMLSelectElement;p.value=value;p.dispatchEvent(new Event('change'));require(providerCalls.length===before,'Preset resampled providers');require(document.body.dataset.hudPreset===value,'Preset application failed');return {preset:value,reads:providerCalls.length-before};},
   guards(nav:boolean,map:boolean){navigation.hidden=nav;minimap.hidden=map;},
   fault(value:string|null){fault=value;faultUsed=false;},hook(value:string|null){hookMode=value;},
   raw,state,
   cached(){require(beforeBaseRaw,'Missing before-base checkpoint');return beforeBaseRaw;},
   poison(){poisoned=true;},
   continuation(count:number){ctx.strokeStyle='#ff004d';ctx.lineWidth=4;ctx.stroke();for(let i=0;i<count;i++)ctx.restore();ctx.fillStyle='#0099ff';ctx.fillRect(6,260,19,13);},
   pathSeed(){ctx.beginPath();ctx.moveTo(20,220);ctx.lineTo(120,240);ctx.lineTo(200,200);},
   pathStroke(){ctx.strokeStyle='#ff0033';ctx.lineWidth=7;ctx.stroke();},
   mutateState(){ctx.globalAlpha=.625;},mutatePath(){ctx.beginPath();},
   mutatePixel(){ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=1;ctx.fillStyle='#ff00ff';ctx.fillRect(1,1,1,1);ctx.restore();note('native-pixel-detector',{x:1,y:1,width:1,height:1,fillStyle:'#ff00ff'});},
   sourceReset(){mapLayer.width=mapLayer.width;note('private-source-same-value-reset');},
   lossPolicy(){minimap.width=minimap.width;minimap.dispatchEvent(new Event('contextlost'));minimap.dispatchEvent(new Event('contextrestored'));note('synthetic-listener-policy',{trusted:false,actualContextLost:ctx.isContextLost(),realLossProven:false});},
   css(mode:string){document.body.className=mode;return {nav:getComputedStyle(navigation).display,canvas:getComputedStyle(minimap).display,visible:navigation.getClientRects().length>0&&minimap.getClientRects().length>0,viewport:{width:innerWidth,height:innerHeight}};},
   summary(){return {sourceKind:source.sourceKind,methodCounts,fieldCounts,providerCalls,events,canonical,tickReceipts,readbacks:reads,preset:document.body.dataset.hudPreset,width:minimap.width,height:minimap.height};},
   rect(){const r=minimap.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,visible:minimap.getClientRects().length>0&&getComputedStyle(navigation).display!=='none'};},
   dispose(){source.dispose();}
  };
  (window as any).lane=api;return;
 }
 // Parent document controls fixed sequential cases. It never executes drawing bodies.
 document.head.insertAdjacentHTML('beforeend','<style>html,body{margin:0;background:rgb(40,57,65);overflow:hidden}iframe{position:absolute;top:10px;border:0;width:420px;height:600px}</style>');
 let caseNotes:any[]=[];let deferralEvidence:any=null;let pair:any=null,stepIndex=0,groupId='',steps:(()=>Promise<any>)[]=[],pending:any=null,globalSummary:any[]=[],savedP1:any=null;
 const call=(name:string,...args:any[])=>[pair.a[name](...args),pair.b[name](...args)];
 const assertSame=(values:any[],label:string)=>require(equal(values[0],values[1]),label+' differs');
 async function fresh(id:string,third=false){
  if(pair){pair.a.dispose();pair.b.dispose();pair.control?.dispose();pair.frames.forEach((f:HTMLIFrameElement)=>f.remove());}
  const frames:HTMLIFrameElement[]=[],apis:any[]=[];
  for(const [i,s]of ['original','candidate',...(third?['control']:[])].entries()){
   const f=document.createElement('iframe');f.style.left=(10+i*440)+'px';f.src='/fixture.html?side='+s+'&pair='+id;frames.push(f);
   await new Promise<void>((resolve,reject)=>{f.onload=()=>{const a=(f.contentWindow as any)?.lane;if(!a?.ready)return reject(new Error('Frame initialization failed'));apis.push(a);resolve();};f.onerror=()=>reject(new Error('Frame failed'));document.body.append(f);});
  }
  pair={id,a:apis[0],b:apis[1],control:apis[2],frames};
 }
 const goodTick=(name:string,overrides:any={})=>{const r=call('tick',name,overrides);assertSame(r,'scheduled ticks');require(r.every(v=>!v.error&&v.clears===1&&v.blits===1&&v.providerReads>0),'Expected native background and one source draw');return r;};
 const failedTick=(name:string,errorName:string,message:string|null=null)=>{const r=call('tick',name);assertSame(r,'failed source ticks');require(r.every(v=>v.error?.name===errorName&&(!message||v.error.message===message)),'Expected native/source exception');return r;};
 const reveal=()=>assertSame(call('preset','exploration',true),'poisoned reveal');
 function checkpoint(id:string,cached=false){
  const spec=schedule.checkpoints.find((v:any)=>v.id===id);require(spec&&spec.pair===pair.id,'Checkpoint/pair schedule mismatch '+id);
  const summaries=call('summary');require(summaries.every((s:any)=>s.readbacks===spec.readbacksPerCanvasBefore+(cached?1:0)),'Readback schedule violated '+id);
  assertSame(summaries.map((s:any)=>s.providerCalls),'provider tape');
  const value={id,group:groupId,pair:pair.id,spec,cached,summaries,composition:spec.composition,states:call('state'),deferralEvidence,caseNotes};
  pending=value;return {id,group:groupId,pair:pair.id,composition:spec.composition,readbacksBefore:summaries.map((s:any)=>s.readbacks)};
 }
 function rects(){return pair.frames.map((f:HTMLIFrameElement,i:number)=>{const fr=f.getBoundingClientRect(),r=(i===0?pair.a:i===1?pair.b:pair.control).rect();require(r.visible&&r.width===420&&r.height===290,'Actual canvas not visible at exact size');const x=fr.x+r.x,y=fr.y+r.y;require([x,y].every(Number.isInteger),'Noninteger composition coordinates');return {x,y,width:r.width,height:r.height};});}
 const api:any={
  async start(group:string){require(!pending,'Unconsumed checkpoint');require(schedule.groups.includes(group),'Unknown group');groupId=group;stepIndex=0;caseNotes=[];deferralEvidence=null;
   const result=(id:string,cached=false)=>async()=>checkpoint(id,cached);
   if(group==='P1')steps=[async()=>{await fresh('p1',true);goodTick('a');const c=pair.control.tick('a');require(!c.error,'Control source failed');pair.control.mutatePixel();return checkpoint('p1-visible');},async()=>{goodTick('city');return checkpoint('p1-city');},async()=>{require(savedP1,'Missing P1 reference');pending={id:'n1-byte-mutant',group:'P1',pair:'saved-p1',spec:schedule.checkpoints.find((s:any)=>s.id==='n1-byte-mutant'),saved:true};return {id:pending.id,group:'P1',pair:pending.pair,composition:false};}];
   if(group==='P2')steps=[async()=>{await fresh('p2');call('preset','cinematic');for(const id of ['a','b','c'])goodTick(id);const paintCounts=call('summary').map((s:any)=>[...paints].reduce((n,k)=>n+(s.methodCounts['target.'+k]??0),0));require(paintCounts[0]>0&&paintCounts[1]===0,'Supported hidden foreground was not deferred');deferralEvidence={nativeForegroundPaintsBeforeReveal:paintCounts,hiddenTicks:3,backgroundBlits:call('summary').map((s:any)=>s.methodCounts['target.drawImage'])};reveal();return checkpoint('p2-latest');},async()=>{call('preset','cinematic');goodTick('d');reveal();call('continuation',1);return checkpoint('p2-second-reveal');}];
   if(group==='P3')steps=[async()=>{await fresh('p3');call('preset','cinematic');for(const g of [[true,false],[false,true]]){call('guards',...g);const r=call('tick','a');assertSame(r,'hidden guard');require(r.every(v=>!v.error&&v.providerReads===0&&v.clears===0&&v.blits===0),'Hidden guard performed work');}return checkpoint('p3-guards');},async()=>{call('guards',false,false);goodTick('a');pair.frames.forEach((f:HTMLIFrameElement)=>f.style.height='400px');for(const mode of ['island-trial','belle-hud-focus','belle-hud-focus island-trial']){const r=call('css',mode);assertSame(r,'CSS visibility');require(r.every(v=>!v.visible&&v.viewport.height===400),'Cinematic short-viewport CSS exposed canvas');caseNotes.push({kind:'concealment',mode,values:r});}pair.frames.forEach((f:HTMLIFrameElement)=>f.style.height='600px');call('css','');call('guards',false,true);const r=call('tick','b');require(r.every(v=>v.providerReads===0),'Collapsed resampled');reveal();call('guards',false,false);return checkpoint('p3-collapse-reveal');}];
   if(group==='P4')steps=[async()=>{await fresh('p4-success');call('preset','cinematic');goodTick('a');call('fault','observe-before-base-clear');goodTick('rebuild');return checkpoint('p4-before-rebuild',true);},async()=>{reveal();return checkpoint('p4-new-generation');},async()=>{await fresh('p4-base-failure');call('preset','cinematic');goodTick('a');call('fault','base-fill');failedTick('rebuild','Error','fixture-after-native-base-fill');reveal();return checkpoint('p4-base-failure');},async()=>{await fresh('p4-drawimage-failure');call('preset','cinematic');goodTick('a');call('fault','invalid-source');failedTick('b','InvalidStateError');reveal();return checkpoint('p4-drawimage-failure');}];
   if(group==='P5')steps=[async()=>{await fresh('p5');call('preset','cinematic');call('fault','partial-rotate');failedTick('a','Error','fixture-after-native-rotate');reveal();return checkpoint('p5-partial');},async()=>{call('continuation',2);return checkpoint('p5-continuation');}];
   if(group==='P6')steps=[async()=>{await fresh('p6-cap');call('preset','cinematic');goodTick('a',{activity:'cap'});const counts=call('summary').map((s:any)=>Object.fromEntries([...paints].map(k=>[k,s.methodCounts['target.'+k]??0])));assertSame(counts,'Cap prefix/remainder native paint counts');return checkpoint('p6-cap');},async()=>{goodTick('b');return checkpoint('p6-after-cap');},async()=>{await fresh('p6-unsupported');call('preset','cinematic');call('hook','unsupported');goodTick('a');return checkpoint('p6-unsupported');}];
   if(group==='P7')steps=[async()=>{await fresh('p7');call('preset','cinematic');call('hook','canonical');goodTick('a');reveal();const r=call('summary').map((s:any)=>s.canonical);assertSame(r,'Canonical setter readback');require(equal(r[0][0].values,r[0][1].values),'Native ignored setters changed state');return checkpoint('p7-canonical');},async()=>{call('continuation',1);return checkpoint('p7-path-continuation');},async()=>{pair.b.mutateState();return checkpoint('n2-state-only');},async()=>{pair.a.mutateState();call('pathSeed');pair.b.mutatePath();call('pathStroke');return checkpoint('n3-current-path');},async()=>{await fresh('p7-arc-error');call('preset','cinematic');call('fault','native-arc');failedTick('a','IndexSizeError');reveal();return checkpoint('p7-arc-error');},async()=>{call('continuation',1);return checkpoint('p7-arc-continuation');}];
   if(group==='P8')steps=[async()=>{await fresh('p8-source-reset');call('preset','cinematic');goodTick('a');call('sourceReset');reveal();return checkpoint('p8-source-reset');},async()=>{await fresh('p8-native-reset');call('preset','cinematic');call('hook','reset');goodTick('a');return checkpoint('p8-native-reset');},async()=>{call('hook',null);goodTick('b');return checkpoint('p8-after-reset');},async()=>{await fresh('p8-loss-listener');call('preset','cinematic');goodTick('a');call('lossPolicy');reveal();return checkpoint('p8-loss-listener');}];
   return {group,steps:steps.length};
  },
  async next(){require(!pending,'Read previous checkpoint first');if(stepIndex>=steps.length)return {done:true,group:groupId};return await steps[stepIndex++]();},
  async composition(){require(pending?.composition,'Not a composition checkpoint');require(call('summary').every((s:any)=>s.readbacks===0),'Composition pair already read back');await new Promise<void>(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r())));return {id:pending.id,rectangles:rects(),dpr:devicePixelRatio,viewport:{width:innerWidth,height:innerHeight},matte:getComputedStyle(document.body).backgroundColor,noPriorReadbacks:true,priorReadbacks:call('summary').map((s:any)=>s.readbacks),control:pending.id==='p1-visible',controlSummary:pair.control?.summary()??null};},
  screenshotRecorded(){require(pending?.composition,'No composition pending');require(call('summary').every((s:any)=>s.readbacks===0),'Readback preceded native screenshot');pending.screenshotRecorded=true;},
  read(){require(pending,'No checkpoint');const p=pending;require(!p.composition||p.screenshotRecorded,'Native screenshot must precede first readback');let values;
   if(p.saved)values=clone(savedP1);else values=p.cached?call('cached'):call('raw');
   const out={...p,values,summaries:p.saved?clone(savedP1.summaries):call('summary')};
   if(p.id==='p1-visible'){savedP1=clone(values);savedP1.summaries=out.summaries;}
   globalSummary.push({id:p.id,pair:p.pair,summaries:out.summaries});pending=null;return out;
  },
  finish(){require(!pending,'Pending checkpoint at finish');const ids=globalSummary.map(s=>s.id);require(equal(ids,schedule.checkpoints.map((s:any)=>s.id)),'Fixed checkpoint set incomplete');if(pair){pair.a.dispose();pair.b.dispose();pair.control?.dispose();}return {ids,methodCoverage:surface.filter(k=>globalSummary.some(p=>p.summaries[0].methodCounts['target.'+k]||p.summaries[0].methodCounts['base.'+k])),fieldCoverage:fields.filter(k=>globalSummary.some(p=>p.summaries[0].fieldCounts['target.'+k])),realContextLossProven:false,canvasStorageBackendAttested:false,providerReplayObserved:false};}
 };
 (window as any).proof=api;
}

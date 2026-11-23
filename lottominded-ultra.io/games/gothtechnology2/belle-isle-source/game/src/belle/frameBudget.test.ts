import {test} from 'node:test';import assert from 'node:assert/strict';import {FrameBudget,sceneFrameCap} from './frameBudget.ts';
test('menus and unfocused previews reduce rendering without capping active riding',()=>{assert.equal(sceneFrameCap(60,true,false,true),60);assert.equal(sceneFrameCap(60,true,true,true),10);assert.equal(sceneFrameCap(60,true,false,false),5);assert.equal(sceneFrameCap(60,false,false,true),30);});
test('automatic scaling reacts to sustained slow frames and recovers gradually',()=>{const b=new FrameBudget();for(let i=0;i<400;i++)b.sample(1/25,60,true);assert(b.scale<1&&b.scale>=.65);const low=b.scale;for(let i=0;i<400;i++)b.sample(1/60,60,true);assert.equal(b.scale,low);for(let i=0;i<3000;i++)b.sample(1/60,60,true);assert(b.scale>low&&b.scale<=1);});
test('a brief load hitch and menus do not degrade automatic resolution',()=>{const b=new FrameBudget();for(let i=0;i<600;i++)b.sample(1/60,60,true);b.sample(.2,60,true);for(let i=0;i<600;i++)b.sample(.1,60,false);assert.equal(b.scale,1);b.reset();assert.equal(b.scale,1);});

test('recurring severe foreground stalls finish warmup and reach the resolution floor',()=>{
 for(const cap of [30,60])for(const dt of [.3,.5,1,2]){
  const b=new FrameBudget(),changes:number[]=[];
  // Includes the cold start: slow frames must advance warmup rather than be discarded.
  let frames=0;
  while(b.scale>.65&&frames<80){frames++;if(b.sample(dt,cap,true))changes.push(b.scale);}
  assert.deepEqual(changes,[.65],`${dt}s foreground frames at a ${cap}fps target`);
  assert.equal(b.scale,.65);
  assert(frames*dt<=16,`severe ${dt}s stalls reach the lightest tier promptly`);
 }
});

test('ordinary 25fps pressure at a 60fps target lowers quality gradually',()=>{
 const b=new FrameBudget(),changes:{seconds:number;scale:number}[]=[];
 for(let i=1;i<=500;i++)if(b.sample(1/25,60,true))changes.push({seconds:i/25,scale:b.scale});
 assert.deepEqual(changes.map(change=>change.scale),[.9,.8,.7,.65]);
 for(let i=1;i<changes.length;i++)assert(changes[i].seconds-changes[i-1].seconds>=2.9);
});

test('exactly three times the target interval stays on the gradual path',()=>{
 const b=new FrameBudget(),changes:number[]=[];
 for(let i=0;i<300;i++)if(b.sample(.05,60,true))changes.push(b.scale);
 assert.deepEqual(changes,[.9,.8,.7,.65]);
});

test('one subsecond severe window interrupted by a menu cannot combine with the next visit',()=>{
 const b=new FrameBudget();
 for(let i=0;i<180;i++)b.sample(1/60,60,true);
 b.sample(.1,60,false);
 for(let visit=0;visit<10;visit++){
  for(let i=0;i<3;i++)b.sample(.5,60,true);
  assert.equal(b.scale,1,'one severe window is insufficient');
  b.sample(.3,60,false);
 }
});

test('one long foreground hitch cannot degrade quality or spend multiple evidence windows',()=>{
 for(const dt of [.3,2,60]){
  const b=new FrameBudget();
  for(let i=0;i<180;i++)b.sample(1/60,60,true);
  assert.equal(b.sample(dt,60,true),false);
  for(let i=0;i<900;i++)assert.equal(b.sample(1/60,60,true),false);
  assert.equal(b.scale,1,`isolated ${dt}s hitch`);
 }
 const cold=new FrameBudget();
 assert.equal(cold.sample(60,60,true),false);
 assert.equal(cold.scale,1,'one cold-start hitch does not bypass sustained-pressure evidence');
});

test('menus and resume exclusions break pressure streaks between separate slow bursts',()=>{
 const b=new FrameBudget();
 for(let i=0;i<180;i++)b.sample(1/60,60,true);
 for(let visit=0;visit<20;visit++){
  // A short slow burst is interrupted by a menu/background interval and a
  // separately excluded resume frame; neither interval is foreground evidence.
  for(let i=0;i<3;i++)b.sample(.5,60,true);
  b.sample(2,60,false);b.sample(.3,60,false);
  assert.equal(b.scale,1);
 }
 for(let i=0;i<80;i++)b.sample(.3,60,true);
 assert.equal(b.scale,.65,'continuous foreground pressure still adapts after interruptions');
});

test('invalid timing samples interrupt stale pressure without changing the scale',()=>{
 const b=new FrameBudget();
 for(let i=0;i<180;i++)b.sample(1/60,60,true);
 for(const invalid of [NaN,Infinity,-1,0]){
  for(let i=0;i<3;i++)b.sample(.5,60,true);
  assert.equal(b.sample(invalid,60,true),false);
  assert.equal(b.scale,1);
 }
});

test('recovery requires sustained good frames and an isolated hitch does not cause a quality bounce',()=>{
 const b=new FrameBudget();
 for(let i=0;i<80;i++)b.sample(.5,60,true);
 assert.equal(b.scale,.65);
 const changes:{seconds:number;scale:number}[]=[];
 let seconds=0;
 for(let i=0;i<7200;i++){
  seconds+=1/60;
  if(b.sample(1/60,60,true))changes.push({seconds,scale:b.scale});
 }
 assert.equal(b.scale,1);
 assert(changes.length>0);
 let previousTime=0,previousScale=.65;
 for(const change of changes){
  assert(change.seconds-previousTime>=10,'recovery steps need sustained headroom');
  assert(change.scale>previousScale&&change.scale-previousScale<=.050001,'recovery remains gradual');
  previousTime=change.seconds;previousScale=change.scale;
 }
 assert.equal(b.sample(2,60,true),false);
 for(let i=0;i<240;i++)b.sample(1/60,60,true);
 assert.equal(b.scale,1,'one later load hitch does not reverse recovery');
});

test('three consecutive critical foreground frames reach the floor even from cold warmup',()=>{
 for(const cap of [30,60])for(const dt of [1,2,10]){
  const b=new FrameBudget();
  assert.equal(b.sample(dt,cap,true),false);assert.equal(b.scale,1);
  assert.equal(b.sample(dt,cap,true),false);assert.equal(b.scale,1);
  assert.equal(b.sample(dt,cap,true),true);assert.equal(b.scale,.65,`${dt}s critical frames at ${cap}fps`);
 }
});

test('a normal, ineligible or invalid interval breaks consecutive critical evidence',()=>{
 const interruptions:[number,boolean][]=[[.02,true],[.5,true],[10,false],[NaN,true],[Infinity,true],[-Infinity,true],[0,true],[-1,true]];
 for(const [dt,eligible] of interruptions){
  const b=new FrameBudget();b.sample(10,60,true);b.sample(10,60,true);
  assert.equal(b.sample(dt,60,eligible),false);assert.equal(b.scale,1);
  assert.equal(b.sample(10,60,true),false);assert.equal(b.sample(10,60,true),false);
  assert.equal(b.scale,1,'two critical frames after an interruption cannot reuse the previous streak');
  assert.equal(b.sample(10,60,true),true);assert.equal(b.scale,.65);
 }
});

test('a slow-rendering regression trace waits for the final three consecutive critical frames',()=>{
 const b=new FrameBudget(),changes:boolean[]=[],scales:number[]=[];
 // Algorithm regression inspired by the observed slow-frame pattern, not a
 // reconstruction of the browser artifact's unavailable raw interval trace.
 for(const dt of [10,10,.02,10,10,10]){changes.push(b.sample(dt,60,true));scales.push(b.scale);}
 assert.deepEqual(changes,[false,false,false,false,false,true]);
 assert.deepEqual(scales,[1,1,1,1,1,.65]);
});

test('two separated critical bursts and an isolated huge hitch do not trigger the critical path',()=>{
 for(const trace of [[60],[10,10,.02,10,10,.02]]){
  const b=new FrameBudget();
  for(const dt of trace)assert.equal(b.sample(dt,60,true),false);
  for(let i=0;i<900;i++)assert.equal(b.sample(1/60,60,true),false);
  assert.equal(b.scale,1);
 }
 const reset=new FrameBudget();reset.sample(10,60,true);reset.sample(10,60,true);reset.reset();
 assert.equal(reset.sample(10,60,true),false);assert.equal(reset.scale,1,'reset clears the previous critical streak');
});

test('critical fallback stays idempotent at the floor and recovery still takes gradual sustained headroom',()=>{
 const b=new FrameBudget();b.sample(2,60,true);b.sample(2,60,true);assert.equal(b.sample(2,60,true),true);
 for(let i=0;i<30;i++)assert.equal(b.sample(10,60,true),false,'the floor does not produce repeated change callbacks');
 assert.equal(b.scale,.65);
 const changes:{seconds:number;scale:number}[]=[];
 for(let i=1;i<=7200;i++)if(b.sample(1/60,60,true))changes.push({seconds:i/60,scale:b.scale});
 assert.deepEqual(changes.map(change=>change.scale),[.7,.75,.8,.85,.9,.95,1]);
 assert(changes[0].seconds>=12&&changes[0].seconds<14,'fallback clears warmup while retaining the recovery evidence requirement');
 for(let i=1;i<changes.length;i++)assert(changes[i].seconds-changes[i-1].seconds>=12);
});

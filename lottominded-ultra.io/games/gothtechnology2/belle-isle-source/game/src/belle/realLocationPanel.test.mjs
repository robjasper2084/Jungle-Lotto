import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

// Execute the real panel without loading CSS or accessing browser sensors.
// The small DOM fixture verifies control bindings, not layout, hit testing or
// browser permission gestures; those remain browser/device integration checks.
const source=readFileSync(new URL('./realLocationPanel.ts',import.meta.url),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{
  target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,
}}).outputText;

function loadPanel(){
  class Element {
    children=[];attributes={};dataset={};disabled=false;hidden=false;checked=false;
    append(...children){this.children.push(...children);}
    setAttribute(name,value){this.attributes[name]=value;}
    addEventListener(){}
  }
  class Compass {
    active=false;enableCalls=0;stopCalls=0;
    constructor(onChange){this.onChange=onChange;}
    emit(status){this.onChange({status,headingDegrees:null,accuracyDegrees:null});}
    enable(){this.enableCalls++;this.active=true;this.emit('requesting');return Promise.resolve();}
    stop(){this.stopCalls++;this.active=false;this.emit('off');}
  }
  class Tracker {
    constructor(options){this.emit=options.onChange;}
  }
  const document={body:new Element(),createElement:()=>new Element(),
    createTextNode:text=>({textContent:text}),querySelector:()=>null,getElementById:()=>null};
  const exports={};
  vm.runInNewContext(compiled,{exports,document,performance:{now:()=>1000},require:name=>{
    if(name==='./realCompass.ts')return {BrowserCompass:Compass};
    if(name==='./realLocation.ts')return {BrowserLocationTracker:Tracker};
    if(name==='./realLocation.css')return {};
    throw new Error('Unexpected panel dependency: '+name);
  }},{filename:'realLocationPanel.ts'});
  return exports.RealLocationPanel;
}

const fix={x:20,z:40,accuracy:5,timestampMs:1000,receivedAtMs:1000,headingDegrees:null,speedMps:1};
function updateFixture(){
  const Panel=loadPanel();
  let reduced=false;
  // No constructor/DOM is needed to exercise the production update method.
  const panel=Object.create(Panel.prototype);
  Object.assign(panel,{
    options:{canFollow:()=>null,reducedMotion:()=>reduced},isFollowing:true,
    state:{status:'tracking',highAccuracy:false,fix:{...fix}},
    compassState:{status:'tracking',headingDegrees:90,accuracyDegrees:5},
    displayed:{x:0,z:0,headingY:Math.PI,speedMps:0},
  });
  return {panel,setReduced:value=>{reduced=value;}};
}

test('normal follow eases position and heading; enabling reduced motion applies the current target immediately',()=>{
  const {panel,setReduced}=updateFixture();
  const eased=panel.update(.02);
  assert.ok(eased.x>0&&eased.x<fix.x);
  assert.ok(eased.z>0&&eased.z<fix.z);
  assert.ok(eased.headingY>Math.PI/2&&eased.headingY<Math.PI);
  setReduced(true);
  const immediate=panel.update(0);
  assert.equal(immediate.x,fix.x);
  assert.equal(immediate.z,fix.z);
  assert.equal(immediate.headingY,Math.PI/2);
  assert.equal(immediate.speedMps,fix.speedMps);
});

test('reduced motion continues to apply new fixes without waiting for elapsed frame time',()=>{
  const {panel,setReduced}=updateFixture();setReduced(true);
  panel.update(.02);
  panel.state.fix={...fix,x:25,z:34};
  panel.compassState.headingDegrees=180;
  const sample=panel.update(0);
  assert.equal(sample.x,25);assert.equal(sample.z,34);assert.equal(sample.headingY,0);
  setReduced(false);panel.state.fix={...fix,x:30,z:50};
  const held=panel.update(0);
  assert.equal(held.x,25);assert.equal(held.z,34);
});

test('stale, unavailable and stopped compass headings are removed when travel direction is unknown',()=>{
  for(const status of ['stale','unavailable','off']){
    const {panel}=updateFixture();
    assert.notEqual(panel.update(.02).headingY,null);
    panel.compassState={status,headingDegrees:null,accuracyDegrees:null};
    panel.state.fix={...fix,headingDegrees:null,speedMps:0};
    assert.equal(panel.update(.02).headingY,null,status);
  }
});

test('a stale compass can fall back to a valid GPS travel direction',()=>{
  const {panel,setReduced}=updateFixture();setReduced(true);
  panel.compassState={status:'stale',headingDegrees:null,accuracyDegrees:null};
  panel.state.fix={...fix,headingDegrees:270,speedMps:2};
  assert.equal(panel.update(0).headingY,-Math.PI/2);
});

test('an active but unavailable compass retains a working Stop control even after GPS accuracy degrades',()=>{
  const Panel=loadPanel();
  const panel=new Panel({contains:()=>true,canFollow:()=>null,onFollowChanged:()=>{},onOpen:()=>{},reducedMotion:()=>false});
  panel.tracker.emit({status:'tracking',fix,highAccuracy:false});
  panel.compassButton.onclick();
  assert.equal(panel.compass.enableCalls,1);
  panel.compass.emit('unavailable');
  panel.tracker.emit({status:'poor-accuracy',highAccuracy:false});
  assert.equal(panel.compassButton.textContent,'Stop compass');
  assert.equal(panel.compassButton.attributes['aria-pressed'],'true');
  assert.equal(panel.compassButton.disabled,false);
  panel.compassButton.onclick();
  assert.equal(panel.compass.stopCalls,1);
  assert.equal(panel.compass.enableCalls,1);
  assert.equal(panel.compass.active,false);
  assert.equal(panel.compassButton.attributes['aria-pressed'],'false');
  assert.equal(panel.compassButton.disabled,true);
});

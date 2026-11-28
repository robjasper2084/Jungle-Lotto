import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import {runInNewContext} from 'node:vm';
import {canPreviewTravel} from '../src/previewAvailability.ts';

const source=readFileSync(new URL('../../../lottominded-ultra.io/games/gothtechnology2/belle-isle-source/game/src/belle/startup.ts',import.meta.url),'utf8');

// Run the original native transition bodies so this regression follows their
// real DOM state, including leave() deliberately leaving Start disabled.
function nativeStartup(){
  const controls={
    start:{disabled:false},welcome:{hidden:false,dataset:{state:'ready'}},
    rideHud:{hidden:true},destination:{disabled:false},
  };
  const context={
    screen:controls.welcome,start:controls.start,friends:{disabled:false},friendsDisabled:false,
    setup:{name:'Onewheel',disable(){}},label:{textContent:''},loading:{textContent:''},hint:{textContent:''},
    ready:true,leaving:false,preview:undefined,picker:{open:false},next:{disabled:false},leaveTimer:undefined,
    motionOff:true,clearTimeout(){},setTimeout(){return 1;},
    document:{body:{classList:{add(){},remove(){}}}},location:{reload(){}},
  };
  function method(name:string,next?:string){
    const begin=source.indexOf('  '+name+'('),end=source.indexOf(next?'\n  '+next+'(':'\n };',begin);
    assert.ok(begin>=0&&end>begin,'Original startup method remains available: '+name);
    return runInNewContext(stripTypeScriptTypes('({'+source.slice(begin,end)+'})'),context)[name] as (...args:unknown[])=>void;
  }
  return {controls,preparing:method('preparing','retryRide'),leave:method('leave','show'),error:method('error')};
}

const ready={ready:true,travelPending:false,error:null};

test('preview travel follows original preparing and leave transitions into the active riding HUD',()=>{
  const native=nativeStartup(),canTravel=()=>canPreviewTravel(ready,native.controls);
  assert.equal(canTravel(),true,'Ready native Start permits travel from the menu');
  native.preparing();
  assert.equal(native.controls.start.disabled,true);
  assert.equal(canTravel(),false,'Selected ride preparation blocks travel');
  native.leave(()=>{native.controls.rideHud.hidden=false;});
  assert.equal(native.controls.welcome.hidden,true);
  assert.equal(native.controls.start.disabled,true,'Original leave does not reenable Start');
  assert.equal(canTravel(),true,'The active native HUD permits travel despite disabled Start');
  native.controls.rideHud.hidden=true;
  assert.equal(canTravel(),false,'A hidden welcome alone does not imply an active ride');
});

test('native startup failure stays unavailable even though original error enables its retry button',()=>{
  const native=nativeStartup();
  native.preparing();native.error('Missing original model');
  assert.equal(native.controls.start.disabled,false);
  assert.equal(native.controls.welcome.dataset.state,'error');
  assert.equal(canPreviewTravel(ready,native.controls),false);
});

test('active riding retains world, pending-travel, source-error and per-destination guards',()=>{
  const native=nativeStartup();
  native.leave(()=>{native.controls.rideHud.hidden=false;});
  for(const state of [{...ready,ready:false},{...ready,travelPending:true},{...ready,error:'Map unavailable'}]){
    assert.equal(canPreviewTravel(state,native.controls),false);
  }
  assert.equal(canPreviewTravel(ready,{...native.controls,destination:null}),false);
  assert.equal(canPreviewTravel(ready,{...native.controls,destination:{disabled:true}}),false);
  assert.equal(canPreviewTravel(ready,{...native.controls,welcome:null}),false);
  assert.equal(canPreviewTravel(ready,native.controls),true,'Recovery restores availability without reenabling Start');
});

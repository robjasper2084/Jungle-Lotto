import test from 'node:test';
import assert from 'node:assert/strict';
import {createOpenDialogCheck,observeModalMeasurementBoundaries} from './modalMeasurementBoundary.ts';
import {RideProfileStats} from './rideProfileStats.ts';

const mutation=(target:{nodeName:string;open?:boolean},attributeName='open')=>({type:'attributes',attributeName,target} as unknown as MutationRecord);
function fixture(){
 const stats=new RideProfileStats();let now=0,previous=0,lastEligible=false,boundaries=0,disconnected=0;
 let notify:(records:readonly MutationRecord[])=>void=()=>{};
 const root={} as Node;
 const dispose=observeModalMeasurementBoundaries(root,()=>{
  boundaries++;previous=now;lastEligible=false;stats.breakCallback();
 },callback=>{
  notify=callback;
  return {observe(node,options){assert.equal(node,root);assert.deepEqual(options,{subtree:true,attributes:true,attributeFilter:['open']});},disconnect(){disconnected++;}};
 });
 return {stats,dispose,boundaries:()=>boundaries,disconnected:()=>disconnected,
  mutationAt(time:number,records:readonly MutationRecord[]){now=time;notify(records);},
  render(time:number){now=time;const dt=(now-previous)/1000,eligible=lastEligible;previous=now;lastEligible=true;
   stats.sample({dt,times:[1,1,1,4,1],draws:10,triangles:100,textures:3,geometries:4,x:0,z:0,speed:0,place:'Bridge',eligible,hidden:false});
  },
 };
}

test('a dialog opened and closed between renders excludes only the crossing/resume interval',()=>{
 const f=fixture();f.render(16);f.render(32);
 // Both attribute records arrive together and the dialog is already closed.
 // No game callback occurred while it was open.
 const dialog={nodeName:'DIALOG',open:false};
 f.mutationAt(1000,[mutation(dialog),mutation(dialog)]);
 assert.equal(f.boundaries(),1);
 f.render(1016);f.render(1032);
 let report=f.stats.report();assert.equal(report.frames,2);assert.equal(report.over250ms,0);
 assert(Math.abs(report.activeSeconds-.032)<1e-9);
 // A subsequent genuine foreground stall is retained in full, even though
 // this same capture previously crossed a menu boundary.
 f.render(1400);report=f.stats.report();
 assert.equal(report.frames,3);assert.equal(report.over250ms,1);assert.equal(report.maxFrameMs,368);
 assert(Math.abs(report.activeSeconds-.4)<1e-9);
});

test('GPU-skipped callbacks without a modal transition remain real measured stalls',()=>{
 const f=fixture();f.render(16);f.render(32);
 // The game renderer does not execute while its prior GPU frame is pending.
 f.render(632);
 const report=f.stats.report();assert.equal(f.boundaries(),0);assert.equal(report.over250ms,1);
 assert.equal(report.maxFrameMs,600);assert.equal(report.frames,2);
 assert(Math.abs(report.activeSeconds-.616)<1e-9);
});

test('QA disclosures and unrelated attribute mutations never reset foreground timing',()=>{
 const f=fixture();f.render(16);f.render(32);
 f.mutationAt(300,[mutation({nodeName:'DETAILS',open:false}),mutation({nodeName:'DIALOG',open:true},'class')]);
 f.render(332);
 const report=f.stats.report();assert.equal(f.boundaries(),0);assert.equal(report.over250ms,1);assert.equal(report.maxFrameMs,300);
});

test('each later modal batch invalidates the next interval and disposal releases observation',()=>{
 const f=fixture(),dialog={nodeName:'DIALOG',open:true};
 f.render(16);f.render(32);f.mutationAt(40,[mutation(dialog)]);f.render(56);
 dialog.open=false;f.mutationAt(80,[mutation(dialog)]);f.render(96);f.render(112);
 assert.equal(f.boundaries(),2);assert.equal(f.stats.report().frames,2);
 f.dispose();f.dispose();assert.equal(f.disconnected(),1);
 f.mutationAt(200,[mutation(dialog)]);assert.equal(f.boundaries(),2);
 f.render(412);assert.equal(f.stats.report().over250ms,1);
});


test('live modal check preserves immediate attribute and collection changes, with no stale frame cache',()=>{
 const dialog=()=>{
  const attributes=new Map<string,string>();
  return {attributes,hasAttribute:(name:string)=>attributes.has(name)};
 };
 const one=dialog(),two=dialog(),dialogs=[one,two],hasOpen=createOpenDialogCheck(dialogs);
 assert.equal(hasOpen(),false);
 one.attributes.set('open','');assert.equal(hasOpen(),true);
 one.attributes.delete('open');assert.equal(hasOpen(),false);
 two.attributes.set('open','false');assert.equal(hasOpen(),true,'attribute presence, not value');
 dialogs.pop();assert.equal(hasOpen(),false,'removing an open dialog must unblock synchronously');
 dialogs.push(two);assert.equal(hasOpen(),true,'inserting an already-open dialog must block synchronously');
 one.attributes.set('open','');two.attributes.delete('open');assert.equal(hasOpen(),true,'another open dialog still blocks');
 one.attributes.delete('open');assert.equal(hasOpen(),false);
 dialogs.splice(0);assert.equal(hasOpen(),false);
});

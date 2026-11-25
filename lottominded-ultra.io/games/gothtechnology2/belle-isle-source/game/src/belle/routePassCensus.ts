/** Isolated local diagnostic: observe Three's own render.info counters on
 * original draw calls, without GPU queries, readbacks, syncs or render changes. */
import type {WebGLRenderer} from 'three';
const names=['shadow','screen','offscreen'] as const;
type Pass=typeof names[number];
const keys=['calls','triangles','lines','points'] as const;
type Counts=Record<typeof keys[number],number>;
type Bucket=Counts&{directCalls:number};
type Label=Bucket&{objectId:number;object:string;parent:string;material:string;materialUuid:string};
type Frame={passes:Record<Pass,Bucket>;objects:Record<Pass,Map<string,Label>>;invalid:number};
type Located={sample:number;frameMs:number;renderMs:number;x:number;z:number;place:string};
type Row=Located&{passes:Record<Pass,Bucket>;top:Record<Pass,Label[]>;invalid:number};
const empty=():Bucket=>({directCalls:0,calls:0,triangles:0,lines:0,points:0});
const frame=():Frame=>({passes:{shadow:empty(),screen:empty(),offscreen:empty()},objects:{shadow:new Map(),screen:new Map(),offscreen:new Map()},invalid:0});
const label=(value:string)=>value.slice(0,96);
function add(to:Bucket,delta:Counts){to.directCalls++;for(const key of keys)to[key]+=delta[key];}
export function installRoutePassCensus(renderer:WebGLRenderer){
 const original=renderer.renderBufferDirect;
 const stride=4,limit=2048;
 let current:Frame|null=null,attempts=0,discarded=0,dropped=0,missing=0,depth=0;
 let rows:Row[]=[];
 const copy=():Counts=>{const r=renderer.info.render;return {calls:r.calls,triangles:r.triangles,lines:r.lines,points:r.points};};
 const wrapped:typeof original=function(this:WebGLRenderer,...args:Parameters<typeof original>){
  const active=current;
  if(!active||this!==renderer)return Reflect.apply(original,this,args);
  if(depth){active.invalid++;return Reflect.apply(original,this,args);}
  let before:Counts|undefined,pass:Pass|undefined;
  try{before=copy();pass=args[1]===null?'shadow':renderer.getRenderTarget()===null?'screen':'offscreen';}catch{active.invalid++;}
  depth++;
  let completed=false;
  try{const result=Reflect.apply(original,this,args);completed=true;return result;}
  finally{
   depth--;
   if(current===active&&completed&&before&&pass)try{
    const after=copy(),delta:Counts={calls:0,triangles:0,lines:0,points:0};
    for(const key of keys){delta[key]=after[key]-before[key];if(!Number.isFinite(delta[key])||delta[key]<0)throw Error('counter reset or invalid delta');}
    add(active.passes[pass],delta);
    const object=args[4],material=args[3],id=object.id+':'+material.uuid;
    const bucket=active.objects[pass];let entry=bucket.get(id);
    if(!entry){entry={...empty(),objectId:object.id,object:label(object.name),parent:label(object.parent?.name??''),material:label(material.name||material.type),materialUuid:material.uuid};bucket.set(id,entry);}
    add(entry,delta);
   }catch{active.invalid++;}
   else if(current===active&&!completed)active.invalid++;
  }
 };
 renderer.renderBufferDirect=wrapped;
 return {
  reset(){current=null;rows=[];attempts=discarded=dropped=missing=0;},
  cancel(){if(current)discarded++;current=null;},
  begin(enabled:boolean){if(current)discarded++;current=null;if(!enabled)return;
   if((attempts++%stride)!==0)return;
   if(renderer.renderBufferDirect!==wrapped){missing++;return;}
   if(rows.length>=limit){dropped++;return;}current=frame();},
  accept(location:Located){const active=current;current=null;if(!active)return;
   if(![location.sample,location.frameMs,location.renderMs,location.x,location.z].every(Number.isFinite)){discarded++;return;}
   if(renderer.renderBufferDirect!==wrapped)active.invalid++;
   const top=Object.fromEntries(names.map(pass=>[pass,[...active.objects[pass].values()].sort((a,b)=>b.triangles-a.triangles||b.calls-a.calls||a.objectId-b.objectId).slice(0,12)])) as Row['top'];
   rows.push({...location,passes:active.passes,top,invalid:active.invalid});},
  report(){return {version:1,stride,limit,attempts,discarded,dropped,missing,rows:structuredClone(rows),note:'Sampled every fourth eligible render attempt. Accepted sample IDs join the ordinary route trace. Three info deltas count its own submissions, not GPU timings or raw GL command receipts. Scene=null is the pinned Three shadow path; other draws are classified by current render target. Top 12 object/material rows per pass are not an exhaustive inventory. Counters may include nested work; invalid rows are retained and must not support attribution. The following frame interval, not the current one, follows this submission; use previous association only across valid uninterrupted route rows.'};}
 };
}
export type RoutePassCensus=ReturnType<typeof installRoutePassCensus>;

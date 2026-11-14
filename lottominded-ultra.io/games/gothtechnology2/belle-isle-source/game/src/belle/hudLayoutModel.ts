/** Data-only HUD contracts. Coordinates describe feasible travel, not screen pixels. */
export const HUD_VERSION = 1;
export const HUD_STORAGE_KEY = 'belle-hud-layouts-v1';
export const MAX_IMPORT_BYTES = 128 * 1024;
export const PROFILE_IDS = ['custom-1', 'custom-2', 'custom-3'] as const;
export type ProfileId = typeof PROFILE_IDS[number];
export type HudMode = 'foot' | 'euc' | 'hover';
export type Handedness = 'right' | 'left';
export const CONTROL_IDS = [
 'stick','brake','hop','mount','recover','sprint','view','pause','tools','map','speed','location','photo',
 'hover-stick','hover-brake','hover-up','hover-down','hover-takeoff','hover-exit','hover-recover','hover-boost',
 'hover-lights','hover-sound','hover-instruments','hover-options','hover-cruise','jarvs','radio','trial',
 'coop-stick','coop-camera','coop-recover','coop-join','coop-mount','coop-hop','coop-brake','coop-up','coop-down','coop-drive','coop-info'
] as const;
export type ControlId = typeof CONTROL_IDS[number];
export type Placement = {u:number;v:number;scale:number;opacity:number;hidden:boolean};
export type HudLayout = {handedness:Handedness;centerGuardFraction:number;controls:Partial<Record<ControlId,Placement>>};
export type HudProfile = {id:ProfileId;name:string;layouts:Record<string,HudLayout>};
export type HudArchive = {schemaVersion:1;active:ProfileId;profiles:HudProfile[]};
export type Rect = {left:number;top:number;width:number;height:number};
export type ControlGeometry = {id:ControlId;label:string;width:number;height:number;interactive:boolean;essential:boolean;minScale?:number};
export const clamp = (value:number,low:number,high:number) => Math.max(low,Math.min(high,value));
export const clone = <T>(value:T):T => JSON.parse(JSON.stringify(value)) as T;
export function emptyArchive():HudArchive {
 return {schemaVersion:1,active:'custom-1',profiles:PROFILE_IDS.map((id,i)=>({id,name:`Custom ${i+1}`,layouts:{}}))};
}
export function profileOf(archive:HudArchive):HudProfile {
 const profile=archive.profiles.find(p=>p.id===archive.active);
 if(!profile)throw new Error('Selected HUD profile is missing.');
 return profile;
}
export function validContext(key:string):boolean {
 const match=/^(solo|coop-([2-4])-(horizontal|vertical)-p([1-4])):(foot|euc|hover):(portrait|landscape)$/.exec(key);
 return !!match&&(!match[2]||Number(match[4])<=Number(match[2]));
}
export function controlInContext(id:ControlId,key:string):boolean {
 const [,mode]=key.split(':');
 if(key.startsWith('coop-'))return id.startsWith('coop-')&&(!['coop-up','coop-down','coop-drive'].includes(id)||mode==='hover');
 if(id.startsWith('coop-'))return false;
 if(id.startsWith('hover-')||id==='jarvs')return mode==='hover';
 if(['stick','brake','hop','mount','recover','speed'].includes(id))return mode!=='hover';
 if(id==='sprint')return mode==='foot';
 return true;
}
function record(value:unknown,label:string):Record<string,unknown> {
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.getPrototypeOf(value)!==Object.prototype)throw new Error(`${label} must be a plain object.`);
 return value as Record<string,unknown>;
}
function keys(value:Record<string,unknown>,allowed:readonly string[],label:string){
 for(const key of Object.keys(value))if(!allowed.includes(key))throw new Error(`${label}: unknown field ${key}.`);
}
function finite(value:unknown,min:number,max:number,label:string):number {
 if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max)throw new Error(`${label} must be between ${min} and ${max}.`);
 return value;
}
export function validateArchive(value:unknown):HudArchive {
 const a=record(value,'HUD profile');keys(a,['schemaVersion','active','profiles'],'HUD profile');
 if(a.schemaVersion!==HUD_VERSION)throw new Error('Unsupported HUD profile version.');
 if(!PROFILE_IDS.includes(a.active as ProfileId))throw new Error('Unknown active profile.');
 if(!Array.isArray(a.profiles)||a.profiles.length!==3)throw new Error('Exactly three custom profiles are required.');
 const ids=new Set<string>();
 const profiles=a.profiles.map((raw,index):HudProfile=>{
  const p=record(raw,`Profile ${index+1}`);keys(p,['id','name','layouts'],'Profile');
  if(!PROFILE_IDS.includes(p.id as ProfileId)||ids.has(String(p.id)))throw new Error('Unknown or duplicated profile ID.');ids.add(String(p.id));
  if(typeof p.name!=='string'||p.name.trim().length<1||p.name.length>40||/[\u0000-\u001f\u007f]/.test(p.name))throw new Error('Profile names must be 1–40 printable characters.');
  const layouts=record(p.layouts,'Layouts');if(Object.keys(layouts).length>114)throw new Error('Too many layout contexts.');
  const result:Record<string,HudLayout>={};
  for(const [context,rawLayout]of Object.entries(layouts)){
   if(!validContext(context))throw new Error(`Unknown layout context: ${context}.`);
   const l=record(rawLayout,'Layout');keys(l,['handedness','centerGuardFraction','controls'],'Layout');
   if(l.handedness!=='right'&&l.handedness!=='left')throw new Error('Unknown handedness.');
   const guard=finite(l.centerGuardFraction,0,.24,'Center guard');
   const controls=record(l.controls,'Controls');if(Object.keys(controls).length>CONTROL_IDS.length)throw new Error('Too many controls.');
   const placed:Partial<Record<ControlId,Placement>>={};
   for(const [id,rawPlacement]of Object.entries(controls)){
    if(!CONTROL_IDS.includes(id as ControlId)||!controlInContext(id as ControlId,context))throw new Error(`Unavailable control: ${id}.`);
    const c=record(rawPlacement,`Control ${id}`);keys(c,['u','v','scale','opacity','hidden'],`Control ${id}`);
    if(typeof c.hidden!=='boolean')throw new Error('Control visibility must be boolean.');
    placed[id as ControlId]={u:finite(c.u,0,1,'Horizontal position'),v:finite(c.v,0,1,'Vertical position'),scale:finite(c.scale,.5,1.6,'Scale'),opacity:finite(c.opacity,.2,1,'Opacity'),hidden:c.hidden};
   }
   result[context]={handedness:l.handedness,centerGuardFraction:guard,controls:placed};
  }
  return {id:p.id as ProfileId,name:p.name.trim(),layouts:result};
 });
 return {schemaVersion:1,active:a.active as ProfileId,profiles};
}
export function importArchive(text:string):HudArchive {
 if(new TextEncoder().encode(text).length>MAX_IMPORT_BYTES)throw new Error('HUD import exceeds 128 KiB.');
 // Reject prototype keys at any level before constructing an application object.
 const parsed:unknown=JSON.parse(text,(key,value)=>{
  if(['__proto__','prototype','constructor'].includes(key))throw new Error('Unsafe profile key.');
  return value;
 });
 return validateArchive(parsed);
}
export function placementRect(p:Placement,g:ControlGeometry,view:Rect):Rect {
 const width=g.width*p.scale,height=g.height*p.scale;
 return {left:view.left+p.u*(view.width-width),top:view.top+p.v*(view.height-height),width,height};
}
export function normalizedPosition(rect:Rect,view:Rect):{u:number;v:number}{
 return {u:clamp((rect.left-view.left)/Math.max(1,view.width-rect.width),0,1),v:clamp((rect.top-view.top)/Math.max(1,view.height-rect.height),0,1)};
}
export function contains(rect:Rect,x:number,y:number):boolean {
 return Number.isFinite(x)&&Number.isFinite(y)&&x>=rect.left&&y>=rect.top&&x<rect.left+rect.width&&y<rect.top+rect.height;
}
export function intersects(a:Rect,b:Rect):boolean {
 return Math.min(a.left+a.width,b.left+b.width)-Math.max(a.left,b.left)>1&&Math.min(a.top+a.height,b.top+b.height)-Math.max(a.top,b.top)>1;
}
export function layoutProblems(layout:HudLayout,geometries:readonly ControlGeometry[],view:Rect):string[]{
 const errors:string[]=[],hit:{label:string;rect:Rect}[]=[];
 if(!Number.isFinite(view.width)||!Number.isFinite(view.height)||view.width<=0||view.height<=0)return ['Player viewport is unavailable.'];
 for(const g of geometries){
  const p=layout.controls[g.id];if(!p){if(g.essential)errors.push(`${g.label} must remain available.`);continue;}
  if(p.hidden){if(g.essential)errors.push(`${g.label} cannot be hidden.`);continue;}
  const r=placementRect(p,g,view);
  if(![r.left,r.top,r.width,r.height].every(Number.isFinite)||p.u<0||p.u>1||p.v<0||p.v>1||p.scale<.5||p.scale>1.6||p.opacity<.2||p.opacity>1)errors.push(`${g.label} has an invalid placement.`);
  if(r.width>view.width+.5||r.height>view.height+.5||r.left<view.left-.5||r.top<view.top-.5||r.left+r.width>view.left+view.width+.5||r.top+r.height>view.top+view.height+.5)errors.push(`${g.label} is outside the safe player viewport.`);
  if(g.interactive){
   if(r.width<44-.01||r.height<44-.01||p.scale<(g.minScale??0)-.001)errors.push(`${g.label} needs a 44 × 44 pixel minimum touch target.`);
   hit.push({label:g.label,rect:r});
  }
 }
 for(let i=0;i<hit.length;i++)for(let j=i+1;j<hit.length;j++)if(intersects(hit[i].rect,hit[j].rect))errors.push(`${hit[i].label} overlaps ${hit[j].label}.`);
 return errors;
}
export function presetLayout(kind:'default'|'left'|'compact',baseline:HudLayout,geometries:readonly ControlGeometry[]):HudLayout{
 const layout=clone(baseline);layout.handedness=kind==='left'?'left':'right';layout.centerGuardFraction=.08;
 for(const g of geometries){const p=layout.controls[g.id];if(!p)continue;p.hidden=false;p.scale=1;
  if(kind==='left')p.u=1-p.u;
  if(kind==='compact')p.scale=g.interactive?Math.min(1,Math.max(g.minScale??0,44/g.width,44/g.height,56/Math.max(g.width,g.height))):.85;
 }
 return layout;
}
/** Bounded, data-only undo history; no storage or game mutations on edit. */
export class HudHistory<T>{
 private undoStack:T[]=[];private redoStack:T[]=[];value:T;
 constructor(initial:T){this.value=clone(initial);}
 replace(next:T){if(JSON.stringify(next)===JSON.stringify(this.value))return;this.undoStack.push(clone(this.value));if(this.undoStack.length>50)this.undoStack.shift();this.redoStack=[];this.value=clone(next);}
 undo(){const prev=this.undoStack.pop();if(prev){this.redoStack.push(clone(this.value));this.value=prev;}return this.value;}
 redo(){const next=this.redoStack.pop();if(next){this.undoStack.push(clone(this.value));this.value=next;}return this.value;}
 get canUndo(){return this.undoStack.length>0;}get canRedo(){return this.redoStack.length>0;}
}

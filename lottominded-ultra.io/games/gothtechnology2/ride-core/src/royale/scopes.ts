import type {Vec3} from '../terrain.ts';

export const SCOPE_REVISION='collectible-optics-2';
export const SCOPES={scope2:{zoom:2,label:'2× scope',color:'#65e9d6'},scope4:{zoom:4,label:'4× scope',color:'#83b5ff'},scope8:{zoom:8,label:'8× scope',color:'#e1a0ff'}} as const;
export type Scope=keyof typeof SCOPES;
export const SCOPE_KINDS=Object.keys(SCOPES) as Scope[];
export const isScope=(kind:string):kind is Scope=>Object.hasOwn(SCOPES,kind);
export const scopeZoom=(kind:Scope|null|undefined)=>kind?SCOPES[kind].zoom:1;
/** Magnification is relative to the established iron-sight FOV, not degrees / zoom. */
export const scopedFov=(ironFov:number,kind:Scope|null)=>2*Math.atan(Math.tan(ironFov*Math.PI/360)/scopeZoom(kind))*180/Math.PI;
export function cycleScope(owned:readonly Scope[],current:Scope|null):Scope|null{
 const choices:[null,...Scope[]]=[null,...SCOPE_KINDS.filter(s=>owned.includes(s))];
 return choices[(choices.indexOf(current)+1)%choices.length];
}
export const bestScope=(owned:readonly Scope[]):Scope|null=>[...SCOPE_KINDS].reverse().find(s=>owned.includes(s))??null;

/** Visible pickup + vertical and occlusion checks prevent collection through walls/floors. */
export function canReachScope(p:Vec3,item:Vec3,line:(a:Vec3,b:Vec3,r?:number)=>boolean){
 return Math.hypot(p.x-item.x,p.z-item.z)<=2.5&&Math.abs(p.y-item.y)<1.25&&line({...p,y:p.y+.7},{...item,y:item.y+.7},.12);
}

/** One accessible 2x near each start, then evenly distributed sites on the connected road graph. */
export function scopeSites(nodes:readonly Vec3[],starts:readonly {position:Vec3;headingY:number}[],center:Vec3,radius:number){
 const distance=(a:Vec3,b:Vec3)=>Math.hypot(a.x-b.x,a.z-b.z);
 const candidates=nodes.filter(p=>distance(p,center)<radius-10);
 const sites:{p:Vec3;kind:Scope}[]=[];
 for(const s of starts){
  const desired={x:s.position.x+Math.sin(s.headingY)*9,y:s.position.y,z:s.position.z+Math.cos(s.headingY)*9};
  const near=candidates.filter(p=>distance(p,s.position)>=6&&distance(p,s.position)<=25&&sites.every(q=>distance(q.p,p)>5));
  const p=near.sort((a,b)=>distance(a,desired)-distance(b,desired))[0];
  if(p)sites.push({p:{...p},kind:'scope2'});
 }
 const count=Math.min(72,candidates.length);
 while(sites.length<count){
  let best:Vec3|undefined,score=-1;
  for(const p of candidates){const d=sites.length?Math.min(...sites.map(s=>distance(p,s.p))):distance(p,center);if(d>score){score=d;best=p;}}
  if(!best||score<20)break;
  const i=sites.length;sites.push({p:{...best},kind:i%6===0?'scope8':i%2===0?'scope4':'scope2'});
 }
 return sites;
}


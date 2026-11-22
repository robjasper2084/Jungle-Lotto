import type {Matrix4} from 'three';

type Reader<Source extends object>={get(source:Source):unknown};
type Entry={key:readonly unknown[];elements:Float64Array};
const rawFields=['id','x','y','z','yaw','scale','heightScale'] as const;
const ordinary=(value:object)=>{const proto=Object.getPrototypeOf(value);return proto===Object.prototype||proto===null;};
const finite=(value:unknown):value is number=>typeof value==='number'&&Number.isFinite(value);
const same=(left:readonly unknown[],right:readonly unknown[])=>{
 if(left.length!==right.length)return false;
 for(let index=0;index<left.length;index++)if(!Object.is(left[index],right[index]))return false;
 return true;
};

/** Cache only the placement objects owned by the parsed production plan.
 * New objects, including Proxy wrappers, take the original path before probes.
 * Private canopy objects come from canopyProfile; arbitrary Proxies injected
 * into those private WeakMaps are outside that ownership contract.
 */
export class NaturePlacementMatrices<Source extends object>{
 private readonly owned=new WeakSet<Source>();
 private readonly entries=new WeakMap<Source,(Entry|undefined)[]>();
 private readonly key:unknown[]=new Array(12);
 private busy=false;private generation=0;
 private attempts=0;private compositionCalls=0;private reuses=0;private fallbacks=0;private failures=0;private registeredSources=0;private storedEntries=0;

 constructor(plan:{trees:readonly Source[];ground:readonly Source[]},private readonly trees:ReadonlySet<string>,private readonly growth:Reader<Source>,private readonly crown:Reader<Source>,private readonly target:Matrix4,private readonly compose:(source:Source,hidden:boolean,crown:boolean)=>Matrix4){
  for(const sources of [plan.trees,plan.ground])for(const source of sources){
   // The caller supplies its just-parsed JSON plan, not caller-extensible registrations.
   if(source&&typeof source==='object'&&!this.owned.has(source)){this.owned.add(source);this.registeredSources++;}
  }
 }

 /** Called immediately before the original dummy.updateMatrix invocation.
  * An earlier raw-input failure increments attempts/failures, not this count. */
 composition(){this.compositionCalls++;}

 get diagnostics(){return Object.freeze({source:'nature-placement-matrices' as const,attempts:this.attempts,compositionCalls:this.compositionCalls,reuses:this.reuses,fallbacks:this.fallbacks,failures:this.failures,registeredSources:this.registeredSources,storedEntries:this.storedEntries});}

 private forget(source:Source,slot:number){
  const entries=this.entries.get(source);
  if(entries?.[slot]){entries[slot]=undefined;this.storedEntries--;}
 }

 private readKey(source:Source,hidden:boolean,crown:boolean){
  try{
   if(!ordinary(source))return false;
   for(let index=0;index<rawFields.length;index++){
    const name=rawFields[index],descriptor=Object.getOwnPropertyDescriptor(source,name);
    if(descriptor&&!('value' in descriptor))return false;
    // Optional heightScale may be absent, but must not resolve an inherited getter.
    if(!descriptor&&(name!=='heightScale'||name in source))return false;
    const value=descriptor?.value;
    if(index===0?typeof value!=='string':name==='heightScale'?(value!=null&&!finite(value)):!finite(value))return false;
    this.key[index]=value;
   }
   let width=1,height=1,overlap:unknown=1;
   if(crown){
    overlap=this.crown.get(source);
    // Do not call the original lazy helpers earlier, or infer cold derived values.
    if(!finite(overlap))return false;
    if(this.trees.has(this.key[0] as string)){
     const growth=this.growth.get(source);
     if(!growth||typeof growth!=='object'||!ordinary(growth))return false;
     const w=Object.getOwnPropertyDescriptor(growth,'width'),h=Object.getOwnPropertyDescriptor(growth,'height');
     if((w&&!('value' in w))||(h&&!('value' in h))||(!w&&'width' in growth)||(!h&&'height' in growth))return false;
     width=w?.value??1;height=h?.value??1;
     if(!finite(width)||!finite(height))return false;
    }
   }
   this.key[7]=hidden;this.key[8]=crown;this.key[9]=width;this.key[10]=height;this.key[11]=overlap;
   return true;
  }catch{return false;}
 }

 get(source:Source,hidden=false,crown=false):Matrix4{
  this.attempts++;
  if(this.busy){
   // A reentrant original computation may alter the same dummy or dependencies.
   this.generation++;this.fallbacks++;
   try{return this.compose(source,hidden,crown);}catch(error){this.failures++;throw error;}
  }
  const slot=(hidden?2:0)+(crown?1:0),generation=this.generation;
  this.busy=true;
  try{
   if(!this.owned.has(source)||typeof hidden!=='boolean'||typeof crown!=='boolean'||!this.readKey(source,hidden,crown)){
    this.forget(source,slot);this.fallbacks++;return this.compose(source,hidden,crown);
   }
   const previous=this.entries.get(source)?.[slot];
   if(generation===this.generation&&previous&&same(previous.key,this.key)){
    const elements=this.target.elements;
    for(let index=0;index<16;index++)elements[index]=previous.elements[index];
    this.reuses++;return this.target;
   }
   // Key allocation is confined to misses; hits use the reusable scratch key.
   const key=this.key.slice();this.forget(source,slot);
   const result=this.compose(source,hidden,crown);
   // Optional cache bookkeeping must not turn a completed original computation
   // into a new failure. Publish only a complete fixed-size private snapshot.
   try{
    if(result===this.target&&generation===this.generation&&this.readKey(source,hidden,crown)&&same(key,this.key)&&generation===this.generation){
     const values=result.elements,elements=new Float64Array(16);
     let valid=true;
     for(let index=0;index<16;index++){const value=values[index];if(!finite(value)){valid=false;break;}elements[index]=value;}
     if(valid&&generation===this.generation){
      let entries=this.entries.get(source);
      if(!entries){entries=new Array(4);this.entries.set(source,entries);}
      entries[slot]={key,elements};this.storedEntries++;
     }
    }
   }catch{/* Preserve the successful original result without caching it. */}
   return result;
  }catch(error){this.forget(source,slot);this.failures++;throw error;}
  finally{this.busy=false;}
 }
}

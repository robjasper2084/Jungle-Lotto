/** Diagnostic transport only. No rendering, capture, or acceptance policy lives here. */
export const PAGE_CHARACTERS = 262144;
const TAG = '__roof_evidence_scalar_v1__';
const own = (value: object, key: PropertyKey) => Object.prototype.hasOwnProperty.call(value, key);
function check(ok: unknown, message: string): asserts ok { if (!ok) throw Error(message); }
const set = (value: object, key: PropertyKey, item: unknown) => Object.defineProperty(value, key, {value:item, enumerable:true, writable:true, configurable:true});
const safeKey = (key: unknown): key is string => typeof key === 'string' && !['__proto__', 'prototype', 'constructor', TAG].includes(key);
function plain(value:any) {
  check(value && typeof value === 'object','Missing evidence object');
  const proto=Object.getPrototypeOf(value);
  check(Array.isArray(value) || proto === Object.prototype || proto === null,'Unsupported evidence object');
  check(!own(value,TAG),'Reserved evidence scalar key');
  check(Object.getOwnPropertySymbols(value).length === 0,'Symbol evidence key');
  for(const key of Object.getOwnPropertyNames(value)) {
    const descriptor=Object.getOwnPropertyDescriptor(value,key)!;
    check(!descriptor.get && !descriptor.set,'Evidence accessor');
  }
}

/** Preserve the scalar distinctions supported by the original Playwright read.
 * The evidence is acyclic plain data. Reject exotic types, accessors and reserved
 * marker collisions instead of silently changing their meaning. */
export function encodeEvidence(value: unknown): string {
  // JSON calls toJSON before its replacer. Check the entire source first so
  // neither that hook nor an accessor can execute and rewrite a receipt.
  const ancestors=new WeakSet<object>();
  function validate(item:any) {
    check(!['function','symbol','bigint'].includes(typeof item),'Unsupported evidence scalar');
    if(!item || typeof item !== 'object')return;
    plain(item);
    for(let at=item;at;at=Object.getPrototypeOf(at)) {
      const descriptor=Object.getOwnPropertyDescriptor(at,'toJSON');
      if(descriptor) {check(!descriptor.get && !descriptor.set && typeof descriptor.value !== 'function','Unsupported evidence toJSON');break;}
    }
    check(!ancestors.has(item),'Cyclic evidence');ancestors.add(item);
    if(Array.isArray(item))for(let index=0;index<item.length;index++)validate(item[index]);
    else for(const key of Object.keys(item))validate(item[key]);
    ancestors.delete(item);
  }
  validate(value);
  const result = JSON.stringify(value, function(key, item) {
    const original = this[key];
    // Original Playwright enumerates array indices and materializes holes as
    // undefined. Preserve that original analyzer input, not JSON's nulls.
    if (typeof original === 'undefined') return {[TAG]:'undefined'};
    if (typeof original === 'number') {
      if (Object.is(original,-0)) return {[TAG]:'-0'};
      if (!Number.isFinite(original)) return {[TAG]:String(original)};
    }
    return item;
  });
  check(typeof result === 'string', 'Evidence did not encode');
  return result;
}

export function decodeEvidence(encoded: string): any {
  function visit(value: any): any {
    if (!value || typeof value !== 'object') return value;
    if (own(value,TAG)) {
      check(Object.keys(value).length === 1, 'Malformed evidence scalar');
      switch(value[TAG]) {
        case 'undefined': return undefined;
        case '-0': return -0;
        case 'NaN': return NaN;
        case 'Infinity': return Infinity;
        case '-Infinity': return -Infinity;
        default: throw Error('Unknown evidence scalar');
      }
    }
    for (const key of Object.keys(value)) {
      set(value,key,visit(value[key]));
    }
    return value;
  }
  return visit(JSON.parse(encoded));
}

async function digest(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256',bytes);
  return Array.from(new Uint8Array(hash),n=>n.toString(16).padStart(2,'0')).join('');
}
const identity = (value: unknown) => encodeEvidence(value);
type Source = {head: string; tree: string};
type Path = [string] | ['cases',number,string];
type Shape = {rootKeys:string[]; caseKeys:string[][]};
type Descriptor = {path:Path; characters:number; sha256:string};
type Manifest = Shape & {protocol:1; session:string; revision:number; mode:string; source:Source; sections:Descriptor[]; sha256:string};
type Section = {path:Path; encoded:string; sha256:string; value?:any};
type Snapshot = {manifest:Manifest; sections:Section[]};

function split(value: any): {shape:Shape; rows:{path:Path;encoded:string}[]} {
  plain(value);
  check(value && Object.getPrototypeOf(value) === Object.prototype, 'Missing plain evidence root');
  check(Array.isArray(value.cases) && value.cases.length <= 4, 'Unexpected evidence cases');
  plain(value.cases);
  for(let index=0;index<value.cases.length;index++) {check(own(value.cases,index),'Sparse evidence cases');plain(value.cases[index]);}
  const rootKeys = Object.keys(value),caseKeys = value.cases.map((item:any)=>Object.keys(item));
  check(rootKeys.every(safeKey) && caseKeys.every((keys:string[])=>keys.every(safeKey)), 'Unsafe evidence path');
  const rows:{path:Path;encoded:string}[]=[];
  for (const key of rootKeys) {
    if (key === 'cases') {
      for (let index=0;index<value.cases.length;index++) {
        const item=value.cases[index];
        check(item && Object.getPrototypeOf(item) === Object.prototype, 'Missing plain case');
        for (const name of caseKeys[index]) rows.push({path:['cases',index,name],encoded:encodeEvidence(item[name])});
      }
    } else rows.push({path:[key],encoded:encodeEvidence(value[key])});
  }
  return {shape:{rootKeys,caseKeys},rows};
}
function paths(shape:Shape): Path[] {
  const result:Path[]=[];
  for (const key of shape.rootKeys) {
    if (key === 'cases') shape.caseKeys.forEach((keys,index)=>keys.forEach(name=>result.push(['cases',index,name])));
    else result.push([key]);
  }
  return result;
}
function assemble(manifest:Manifest,sections:Map<string,Section>): any {
  const value:any={};
  for (const key of manifest.rootKeys) {
    if (key === 'cases') set(value,key,manifest.caseKeys.map((keys,index)=>{
      const item={}; for (const name of keys) set(item,name,sections.get(identity(['cases',index,name]))!.value); return item;
    }));
    else set(value,key,sections.get(identity([key]))!.value);
  }
  return value;
}

/** Each begin takes a synchronous scalar-preserving snapshot. Only strings from
 * that immutable snapshot are paged. finish rejects any concurrent mutation. */
export function createEvidencePager(getValue:()=>any,expected:{mode:string;source:Source}) {
  let session:string|null=null,revision=0,active:Snapshot|null=null,building=false,previous:Snapshot|null=null;
  function requireActive(request:{session:string;revision:number}): Snapshot {
    check(active && request.session === session && request.revision === active.manifest.revision,'Wrong evidence session or revision');
    return active;
  }
  return Object.freeze({
    async begin(request:{session:string}):Promise<Manifest> {
      check(!active && !building,'Evidence transaction already active');
      check(typeof request.session === 'string' && request.session.length > 0 && request.session.length <= 128,'Invalid evidence session');
      check(session === null || session === request.session,'Evidence session changed');
      session=request.session;building=true;
      try {
        const value=getValue();
        plain(value);
        check(value.mode === expected.mode && identity(value.source) === identity(expected.source),'Evidence source changed');
        const {shape,rows}=split(value);
        const old=new Map(previous?.sections.map(row=>[identity(row.path),row])??[]);
        const sections:Section[]=[];
        // All live values were copied above, before the first asynchronous hash.
        for (const row of rows) {
          const prior=old.get(identity(row.path));
          sections.push({...row,sha256:prior?.encoded === row.encoded ? prior.sha256 : await digest(row.encoded)});
        }
        const metadata={protocol:1 as const,session,revision:++revision,mode:expected.mode,source:{...expected.source},...shape,
          sections:sections.map(({path,encoded,sha256})=>({path,characters:encoded.length,sha256}))};
        const manifest={...metadata,sha256:await digest(identity(metadata))};
        active={manifest,sections};return manifest;
      } finally {building=false;}
    },
    page(request:{session:string;revision:number;index:number;offset:number}) {
      const snapshot=requireActive(request),{index,offset}=request;
      check(Number.isSafeInteger(index) && index >= 0 && index < snapshot.sections.length,'Invalid evidence section');
      const section=snapshot.sections[index];
      check(Number.isSafeInteger(offset) && offset >= 0 && offset < section.encoded.length && offset % PAGE_CHARACTERS === 0,'Invalid evidence page offset');
      const data=section.encoded.slice(offset,offset+PAGE_CHARACTERS);
      return {protocol:1,session,revision:snapshot.manifest.revision,index,offset,characters:section.encoded.length,data};
    },
    finish(request:{session:string;revision:number}) {
      const snapshot=requireActive(request),current=split(getValue());
      check(identity(current.shape) === identity({rootKeys:snapshot.manifest.rootKeys,caseKeys:snapshot.manifest.caseKeys}),'Evidence shape changed during transfer');
      check(current.rows.length === snapshot.sections.length && current.rows.every((row,index)=>identity(row.path) === identity(snapshot.sections[index].path) && row.encoded === snapshot.sections[index].encoded),'Evidence changed during transfer');
      const result={protocol:1,session,revision:snapshot.manifest.revision,sha256:snapshot.manifest.sha256};
      previous=snapshot;active=null;return result;
    },
  });
}

type Remote = (method:'begin'|'page'|'finish',request:any)=>Promise<any>;
export type Checkpoint = {value:any; manifest:Manifest; sections:Map<string,Section>; newSections:Section[]; receipt:any};
/** A single cumulative deadline covers snapshotting, every page, hashes,
 * decoding, the final seal and host reconstruction. A late promise has no
 * access to committed state. The caller persists this result before accepting it. */
export async function readEvidenceCheckpoint(options:{remote:Remote;previous?:Checkpoint|null;session:string;mode:string;source:Source;now?:()=>number;timeoutMs?:number}):Promise<Checkpoint> {
  const {remote,previous,session,mode,source}=options,now=options.now??(()=>performance.now()),timeoutMs=options.timeoutMs??15000,start=now();
  check(timeoutMs > 0 && timeoutMs <= 15000,'Evidence deadline exceeds original 15000 ms');
  function remaining() {
    const elapsed=now()-start;
    check(Number.isFinite(elapsed) && elapsed >= 0,'Invalid evidence monotonic clock');
    if (elapsed >= timeoutMs) {const error=Object.assign(Error('Read partial controlled evidence exceeded '+timeoutMs+' ms'),{code:'DIAGNOSTIC_TIMEOUT'});throw error;}
    return timeoutMs-elapsed;
  }
  async function guarded(operation:()=>Promise<any>):Promise<any> {
    const left=remaining();let timer:ReturnType<typeof setTimeout>|undefined;
    try {
      const result=await Promise.race([Promise.resolve().then(operation),new Promise((_,reject)=>{
        timer=setTimeout(()=>reject(Object.assign(Error('Read partial controlled evidence exceeded '+timeoutMs+' ms'),{code:'DIAGNOSTIC_TIMEOUT'})),left);
      })]);
      remaining();return result;
    } finally {clearTimeout(timer);}
  }
  const request=(method:'begin'|'page'|'finish',args:any)=>guarded(()=>remote(method,args));
  const manifest:Manifest=await request('begin',{session});
  check(manifest?.protocol === 1 && manifest.session === session && manifest.mode === mode && identity(manifest.source) === identity(source),'Wrong evidence manifest identity');
  check(Number.isSafeInteger(manifest.revision) && manifest.revision === (previous?.manifest.revision??0)+1,'Evidence revision gap');
  if (previous) check(previous.manifest.session === session && previous.manifest.mode === mode && identity(previous.manifest.source) === identity(source),'Previous evidence identity mismatch');
  check(Array.isArray(manifest.rootKeys) && manifest.rootKeys.every(safeKey) && new Set(manifest.rootKeys).size === manifest.rootKeys.length && manifest.rootKeys.includes('cases'),'Invalid evidence root shape');
  check(Array.isArray(manifest.caseKeys) && manifest.caseKeys.length <= 4 && manifest.caseKeys.every(keys=>Array.isArray(keys) && keys.every(safeKey) && new Set(keys).size === keys.length),'Invalid evidence case shape');
  const expectedPaths=paths(manifest);
  check(Array.isArray(manifest.sections) && manifest.sections.length === expectedPaths.length && manifest.sections.length <= 512,'Invalid evidence section count');
  const {sha256,...metadata}=manifest;
  check(/^[a-f0-9]{64}$/.test(sha256) && await guarded(()=>digest(identity(metadata))) === sha256,'Evidence manifest hash mismatch');remaining();
  const sections=new Map<string,Section>(),newSections:Section[]=[];let pages=0,characters=0,reused=0;
  for (let index=0;index<manifest.sections.length;index++) {
    const descriptor=manifest.sections[index],key=identity(descriptor.path);
    check(key === identity(expectedPaths[index]),'Evidence section path/order mismatch');
    check(Number.isSafeInteger(descriptor.characters) && descriptor.characters > 0 && /^[a-f0-9]{64}$/.test(descriptor.sha256),'Invalid evidence section descriptor');
    const prior=previous?.sections.get(key);
    if (prior && prior.sha256 === descriptor.sha256 && prior.encoded.length === descriptor.characters) {sections.set(key,prior);reused++;continue;}
    const chunks:string[]=[];
    for (let offset=0;offset<descriptor.characters;offset+=PAGE_CHARACTERS) {
      const page=await request('page',{session,revision:manifest.revision,index,offset});
      check(page?.protocol === 1 && page.session === session && page.revision === manifest.revision && page.index === index && page.offset === offset && page.characters === descriptor.characters,'Wrong evidence page identity or offset');
      check(typeof page.data === 'string' && page.data.length === Math.min(PAGE_CHARACTERS,descriptor.characters-offset),'Truncated or oversized evidence page');
      chunks.push(page.data);pages++;characters+=page.data.length;
    }
    const encoded=chunks.join('');
    check(encoded.length === descriptor.characters && await guarded(()=>digest(encoded)) === descriptor.sha256,'Evidence section hash mismatch');remaining();
    const section={path:descriptor.path,sha256:descriptor.sha256,encoded,value:decodeEvidence(encoded)};
    remaining();sections.set(key,section);newSections.push(section);
  }
  const seal=await request('finish',{session,revision:manifest.revision});
  check(seal?.protocol === 1 && seal.session === session && seal.revision === manifest.revision && seal.sha256 === manifest.sha256,'Evidence final seal mismatch');
  const value=assemble(manifest,sections);
  check(value.mode === mode && identity(value.source) === identity(source),'Decoded evidence identity mismatch');remaining();
  return {value,manifest,sections,newSections,receipt:{protocol:1,session,revision:manifest.revision,manifestSha256:manifest.sha256,
    sections:sections.size,changedSections:newSections.length,reusedSections:reused,pages,characters,elapsedMs:now()-start,deadlineMs:timeoutMs,sealed:true}};
}

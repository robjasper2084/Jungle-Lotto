export type StreamPoint={x:number;z:number};
export type StreamJob={id:string;centers:readonly StreamPoint[];load:()=>Promise<void>};
type Entry=StreamJob&{state:'waiting'|'loading'|'loaded'|'error';promise?:Promise<void>;retryAt:number;error?:string};

/** Fetch nearby art in priority order. Collision/ground data stays resident. */
export class SpatialAssetStream {
 private entries=new Map<string,Entry>();private active=0;private points:readonly StreamPoint[]=[];private radius=0;
 private concurrency:number;private changed:()=>void;
 constructor(concurrency=2,changed:()=>void=()=>{}){
  this.concurrency=concurrency;this.changed=changed;
  if(!Number.isInteger(concurrency)||concurrency<1)throw new RangeError('Invalid stream concurrency');
 }
 add(job:StreamJob){if(this.entries.has(job.id))throw new Error('Duplicate stream job: '+job.id);this.entries.set(job.id,{...job,state:'waiting',retryAt:0});}
 private distance(entry:Entry,points=this.points){let distance=Infinity;for(const p of points)for(const c of entry.centers)distance=Math.min(distance,Math.hypot(p.x-c.x,p.z-c.z));return distance;}
 private async start(entry:Entry){
  if(entry.promise)return entry.promise;if(entry.state==='loaded')return;
  entry.state='loading';this.active++;this.changed();
  entry.promise=Promise.resolve().then(entry.load).then(()=>{entry.state='loaded';entry.error=undefined;},error=>{entry.state='error';entry.error=String(error);entry.retryAt=Date.now()+30000;throw error;}).finally(()=>{this.active--;entry.promise=undefined;this.changed();this.pump();});
  return entry.promise;
 }
 private pump(){
  const nearby=[...this.entries.values()].filter(e=>(e.state==='waiting'||e.state==='error'&&Date.now()>=e.retryAt)&&this.distance(e)<=this.radius).sort((a,b)=>this.distance(a)-this.distance(b));
  for(const entry of nearby){if(this.active>=this.concurrency)break;void this.start(entry).catch(()=>{});}
 }
 update(points:readonly StreamPoint[],radius:number){this.points=points;this.radius=Math.max(0,radius);this.pump();}
 async ensure(id:string){const entry=this.entries.get(id);if(!entry)return;if(entry.state==='error')entry.retryAt=0;await this.start(entry);}
 async warm(points:readonly StreamPoint[],radius:number){
  const jobs=[...this.entries.values()].filter(e=>this.distance(e,points)<=radius).sort((a,b)=>this.distance(a,points)-this.distance(b,points));
  let next=0;await Promise.all(Array.from({length:Math.min(this.concurrency,jobs.length)},async()=>{while(next<jobs.length)await this.ensure(jobs[next++].id);}));
 }
 get status(){const counts={total:this.entries.size,loaded:0,loading:0,deferred:0,errors:0};for(const e of this.entries.values()){if(e.state==='loaded')counts.loaded++;else if(e.state==='loading')counts.loading++;else if(e.state==='error')counts.errors++;else counts.deferred++;}return counts;}
}

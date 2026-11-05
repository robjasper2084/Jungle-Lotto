import {WATER_GRID,WATER_EVENTS,WATER_SPAN,WATER_LIFE,type WaterImpulse} from './waterRipples.ts';
// Narrow structural types keep this optional backend usable without adding a runtime dependency.
type Buffer={mapAsync(mode:number):Promise<void>;getMappedRange():ArrayBuffer;unmap():void;destroy():void};
type Pipeline={getBindGroupLayout(index:number):unknown};
type Encoder={beginComputePass():{setPipeline(p:Pipeline):void;setBindGroup(i:number,g:unknown):void;dispatchWorkgroups(x:number,y:number):void;end():void};copyBufferToBuffer(a:Buffer,b:number,c:Buffer,d:number,e:number):void;finish():unknown};
type Device={lost:Promise<unknown>;destroy():void;createBuffer(d:Record<string,unknown>):Buffer;createShaderModule(d:{code:string}):unknown;createComputePipelineAsync(d:Record<string,unknown>):Promise<Pipeline>;createBindGroup(d:Record<string,unknown>):unknown;createCommandEncoder():Encoder;queue:{writeBuffer(b:Buffer,offset:number,data:Float32Array):void;submit(commands:unknown[]):void}};
type GPU={requestAdapter(d:{powerPreference:string}):Promise<{requestDevice():Promise<Device>}|null>};
export const waterCompute=/* wgsl */`
struct Params { centerTime:vec4f, events:array<vec4f,${WATER_EVENTS}> };
@group(0) @binding(0) var<uniform> params:Params;
@group(0) @binding(1) var<storage,read_write> pixels:array<u32>;
@compute @workgroup_size(8,8)
fn main(@builtin(global_invocation_id) id:vec3u){
 if(id.x>=${WATER_GRID}u||id.y>=${WATER_GRID}u){return;}
 let p=params.centerTime.xy+((vec2f(id.xy)+.5)/${WATER_GRID}.0-.5)*${WATER_SPAN}.0;
 var gradient=vec2f(0.);var foam=0.;
 for(var i=0u;i<${WATER_EVENTS}u;i++){
  let e=params.events[i];let age=params.centerTime.z-e.z;
  if(e.w<=0.||age<0.||age>${WATER_LIFE}){continue;}
  let v=p-e.xy;let r=length(v);let d=r-age*2.2;
  let envelope=exp(-d*d*2.4-age*.95)*e.w;
  let slope=envelope*(cos(d*8.)*8.-sin(d*8.)*d*4.8)*.028;
  gradient+=slope*v/max(.1,r);foam+=envelope*.16;
 }
 let normal=vec2u(round(clamp(vec2f(128.)+gradient*127.,vec2f(0.),vec2f(255.))));
 let f=u32(round(clamp(foam,0.,1.)*255.));pixels[id.y*${WATER_GRID}u+id.x]=normal.x|(normal.y<<8u)|(f<<16u)|0xff000000u;
}`;
/** A 16 KB readback at most 20 times/sec, never awaited by the render loop. */
export async function createWaterGpu(onLost:()=>void){
 const gpu=(navigator as Navigator&{gpu?:GPU}).gpu;if(!gpu||!isSecureContext)return null;
 const adapter=await gpu.requestAdapter({powerPreference:'low-power'});if(!adapter)return null;
 const device=await adapter.requestDevice();let disposed=false;
 device.lost.then(()=>{if(!disposed)onLost();});
 const buffers:Buffer[]=[];const buffer=(size:number,usage:number)=>{const b=device.createBuffer({size,usage});buffers.push(b);return b;};
 try{
  const params=buffer(16+WATER_EVENTS*16,64|8),output=buffer(WATER_GRID*WATER_GRID*4,128|4),readback=buffer(WATER_GRID*WATER_GRID*4,1|8);
  const pipeline=await device.createComputePipelineAsync({layout:'auto',compute:{module:device.createShaderModule({code:waterCompute}),entryPoint:'main'}});
  const bind=device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:params}},{binding:1,resource:{buffer:output}}]});
  const values=new Float32Array(4+WATER_EVENTS*4);
  return {async sample(cx:number,cz:number,time:number,events:readonly WaterImpulse[],out:Uint8Array){
   values.fill(0);values.set([cx,cz,time,0]);events.slice(-WATER_EVENTS).forEach((e,i)=>values.set([e.x,e.z,e.time,e.strength],4+i*4));device.queue.writeBuffer(params,0,values);
   const encoder=device.createCommandEncoder(),pass=encoder.beginComputePass();pass.setPipeline(pipeline);pass.setBindGroup(0,bind);pass.dispatchWorkgroups(WATER_GRID/8,WATER_GRID/8);pass.end();encoder.copyBufferToBuffer(output,0,readback,0,out.length);device.queue.submit([encoder.finish()]);
   await readback.mapAsync(1);try{if(!disposed)out.set(new Uint8Array(readback.getMappedRange()));}finally{if(!disposed)readback.unmap();}
  },dispose(){disposed=true;for(const b of buffers)b.destroy();device.destroy();}};
 }catch(error){disposed=true;for(const b of buffers)b.destroy();device.destroy();throw error;}
}

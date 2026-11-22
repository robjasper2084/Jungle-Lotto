import type {Sphere,TypedArray} from 'three';

/** Successful local sphere transforms only. Stable source IDs are hints: every
 * Float32 matrix bit and the exact base sphere must still match before reuse.
 * Storage is fixed to the original mesh capacity, never the changing selection.
 */
export class LocalTreeBoundsCache {
 private readonly capacity:number;
 private readonly matrices:Uint32Array;
 private readonly spheres:Float64Array;
 private readonly valid:Uint8Array;
 private readonly base=new Float64Array(4);
 private hasBase=false;
 private source:Float32Array|undefined;
 private words:Uint32Array|undefined;

 constructor(capacity:number){
  this.capacity=Number.isSafeInteger(capacity)&&capacity>=0?capacity:0;
  this.matrices=new Uint32Array(this.capacity*16);
  this.spheres=new Float64Array(this.capacity*4);
  this.valid=new Uint8Array(this.capacity);
 }

 prepare(base:Sphere,source:TypedArray){
  const {x,y,z}=base.center,r=base.radius;
  if(!this.hasBase||!Object.is(this.base[0],x)||!Object.is(this.base[1],y)||!Object.is(this.base[2],z)||!Object.is(this.base[3],r)){
   this.valid.fill(0);this.base[0]=x;this.base[1]=y;this.base[2]=z;this.base[3]=r;this.hasBase=true;
  }
  if(!(source instanceof Float32Array)||!Number.isFinite(x)||!Number.isFinite(y)||!Number.isFinite(z)||!Number.isFinite(r)||r<0){
   this.source=undefined;this.words=undefined;return;
  }
  if(this.source!==source){
   this.source=source;this.words=new Uint32Array(source.buffer,source.byteOffset,source.length);
  }
 }

 private key(sourceId:number|undefined,offset:number){
  return Number.isSafeInteger(sourceId)&&sourceId!>=0&&sourceId!<this.capacity&&
   Number.isSafeInteger(offset)&&offset>=0&&this.words!==undefined&&offset+16<=this.words.length?sourceId!:-1;
 }

 restore(sourceId:number|undefined,offset:number,target:Sphere){
  const key=this.key(sourceId,offset);
  if(key<0||!this.valid[key])return false;
  const matrix=key*16,values=key*4,words=this.words!;
  for(let n=0;n<16;n++)if(this.matrices[matrix+n]!==words[offset+n])return false;
  target.center.set(this.spheres[values],this.spheres[values+1],this.spheres[values+2]);target.radius=this.spheres[values+3];
  return true;
 }

 /** The caller invokes this only after the original transform succeeds. */
 remember(sourceId:number|undefined,offset:number,sphere:Sphere){
  const key=this.key(sourceId,offset),{x,y,z}=sphere.center,r=sphere.radius;
  if(key<0||!Number.isFinite(x)||!Number.isFinite(y)||!Number.isFinite(z)||!Number.isFinite(r)||r<0)return;
  const matrix=key*16,values=key*4,words=this.words!;
  for(let n=0;n<16;n++)this.matrices[matrix+n]=words[offset+n];
  this.spheres[values]=x;this.spheres[values+1]=y;this.spheres[values+2]=z;this.spheres[values+3]=r;this.valid[key]=1;
 }
}

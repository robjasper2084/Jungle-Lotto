/** Lossless JSON records for observational values, including nonfinite terrain heights. */
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve,dirname,relative} from 'node:path';
import {createHash} from 'node:crypto';

export const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
export const gitBlob=bytes=>createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
const tag='$bellePreflightScalar';
export function rawJson(value,pretty=false){
 return JSON.stringify(value,(_key,item)=>{
  if(typeof item==='number'&&(!Number.isFinite(item)||Object.is(item,-0)))return{[tag]:Object.is(item,-0)?'-0':String(item)};
  if(item===undefined)return{[tag]:'undefined'};
  assert(!(item&&typeof item==='object'&&Object.hasOwn(item,tag)),'Reserved raw scalar tag in evidence');
  return item;
 },pretty?2:undefined)+'\n';
}
export function parseRaw(text){
 const decoded=JSON.parse(text);
 const visit=value=>{
  if(value&&typeof value==='object'){
   if(Object.hasOwn(value,tag)){
    assert.deepEqual(Object.keys(value),[tag],'Malformed raw scalar');
    const labels={'NaN':NaN,'Infinity':Infinity,'-Infinity':-Infinity,'-0':-0,'undefined':undefined};
    assert(Object.hasOwn(labels,value[tag]),'Unknown raw scalar');return labels[value[tag]];
   }
   for(const key of Object.keys(value))value[key]=visit(value[key]);
  }
  return value;
 };return visit(decoded);
}
export function evidencePath(root,file){
 assert(typeof file==='string'&&file.length&&!file.includes('\\')&&!file.startsWith('/')&&!file.split('/').some(p=>p==='..'||p==='.'||p===''),'Unsafe evidence path');
 const path=resolve(root,file);assert.equal(relative(root,path).split('\\').join('/'),file);return path;
}
export async function writeRaw(root,file,value,{pretty=false,exclusive=true}={}){
 const path=evidencePath(root,file),bytes=Buffer.from(rawJson(value,pretty));await mkdir(dirname(path),{recursive:true});
 await writeFile(path,bytes,{flag:exclusive?'wx':'w'});return{file,bytes:bytes.length,sha256:sha256(bytes)};
}
export async function readRaw(root,receipt){
 const bytes=await readFile(evidencePath(root,receipt.file));assert.equal(bytes.length,receipt.bytes,'Raw evidence length changed');
 assert.equal(sha256(bytes),receipt.sha256,'Raw evidence hash changed');return parseRaw(bytes.toString());
}

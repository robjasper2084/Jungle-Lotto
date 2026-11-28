import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,relative,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {gzipSync,gunzipSync} from 'node:zlib';
import {repoRoot,belleRoot,startupDerivedRoot,assertPreviewOutput} from './paths.mjs';

const belle='lottominded-ultra.io/games/gothtechnology2/belle-isle-source/';
export const STARTUP_PACKING_POLICY=Object.freeze({
 format:'gzip',level:9,
 sourceDigests:Object.freeze({
  [belle+'tools/pack-startup-assets.mjs']:'ca7a5d50bf8e324d1507e96534cde518267138b0d850ca374d665b030a96be1c',
  [belle+'game/src/belle/startupAssets.json']:'4b31ef42df6b66ab3637c006c50e75dcf2dcd693457a10f60f09e79b0b946edf',
  [belle+'game/src/belle/startupAssets.ts']:'01b406cb5a396cec76f7c44729fc83e870cd476e15589ba8d6550bcfc3f0d2c5',
 }),
});
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
const gitBlob=bytes=>createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');

/** Reproduce the original packaging recipe in ignored preview output only.
 * The original production packer is never run: it also removes source copies
 * from its hard-coded production dist. Native startup loaders remain unchanged. */
export async function prepareStartupAssets(sourceManifest,{directory=startupDerivedRoot}={}){
 assertPreviewOutput(directory);
 for(const [source,expected]of Object.entries(STARTUP_PACKING_POLICY.sourceDigests)){
  if(sha256(await readFile(resolve(repoRoot,source)))!==expected)throw Error('Original startup packaging policy changed: '+source);
 }
 const paths=JSON.parse(await readFile(resolve(belleRoot,'src/belle/startupAssets.json'),'utf8'));
 const records={};let originalBytes=0,packedBytes=0;
 for(const path of paths){
  if(typeof path!=='string'||!path.startsWith('belle/')||path.split('/').includes('..'))throw Error('Unexpected native startup asset path');
  const url='/'+path,packedUrl=url+'.gz',raw=sourceManifest[url];
  if(!raw?.gitBlob||resolve(repoRoot,raw.source)!==resolve(belleRoot,'public',path))throw Error('Startup asset must be the original Belle source: '+path);
  if(sourceManifest[packedUrl])throw Error('Startup gzip conflicts with a committed source asset: '+packedUrl);
  const input=await readFile(resolve(repoRoot,raw.source));
  if(gitBlob(input)!==raw.gitBlob)throw Error('Startup source bytes differ from their Git identity: '+path);
  const packed=gzipSync(input,{level:9});
  if(!gunzipSync(packed).equals(input))throw Error('Startup asset failed its lossless roundtrip: '+path);
  const file=resolve(directory,path+'.gz');assertPreviewOutput(file);
  await mkdir(dirname(file),{recursive:true});await writeFile(file,packed);
  records[packedUrl]={source:relative(repoRoot,file).replaceAll('\\','/'),sha256:sha256(packed),bytes:packed.length,derivedFrom:{url,source:raw.source,gitBlob:raw.gitBlob,bytes:input.length},compression:{format:'gzip',level:9,losslessRoundtrip:true}};
  originalBytes+=input.length;packedBytes+=packed.length;
 }
 return {policy:STARTUP_PACKING_POLICY,assetCount:paths.length,originalBytes,packedBytes,records};
}

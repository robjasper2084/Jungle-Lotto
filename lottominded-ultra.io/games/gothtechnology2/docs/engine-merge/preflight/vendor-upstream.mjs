// Preserve the full pinned source, never merge arbitrary newer upstream files.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname,relative} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const pack=resolve(import.meta.dirname,'../../..'),repo=resolve(pack,'../../..');
const source=resolve(repo,'.game-builds/breadflowerdos-upstream');
const target=resolve(pack,'engine/breadflowerdos/upstream');
const pin='6b4d4e1f10dee9b1c8932db95f91b92e3eceb7db';
const git=(...args)=>execFileSync('git',['-C',source,...args]);
if(git('rev-parse','HEAD').toString().trim()!==pin)throw Error('PIN_MISMATCH');
const entries=git('ls-tree','-rz','--full-tree',pin).toString().split('\0').filter(Boolean);
const files=[];
for(const entry of entries){
 const [info,file]=entry.split('\t'),[mode,kind,blob]=info.split(' ');
 if(kind!=='blob'||mode!=='100644')throw Error('Unexpected upstream tree mode '+entry);
 const output=resolve(target,file);if(relative(target,output).startsWith('..'))throw Error('PATH_ESCAPE');
 const data=git('cat-file','blob',blob),hash=createHash('sha1').update(`blob ${data.length}\0`).update(data).digest('hex');
 if(hash!==blob)throw Error('BLOB_MISMATCH '+file);
 let existing;try{existing=await readFile(output);}catch(e){if(e.code!=='ENOENT')throw e;}
 if(existing&&!existing.equals(data))throw Error('REFUSE_OVERWRITE '+file);
 if(!existing){await mkdir(dirname(output),{recursive:true});await writeFile(output,data);}
 files.push({file,gitBlob:blob,sha256:createHash('sha256').update(data).digest('hex'),bytes:data.length});
}
await writeFile(resolve(target,'../UPSTREAM_SOURCE.json'),JSON.stringify({repository:'https://github.com/kiwidoggie/breadflowerdos',commit:pin,license:'MIT',subset:false,patches:[],files},null,2)+'\n');
console.log(JSON.stringify({commit:pin,fullUpstreamFiles:files.length,bytes:files.reduce((n,f)=>n+f.bytes,0),sourceOnly:true,gameIntegration:false}));

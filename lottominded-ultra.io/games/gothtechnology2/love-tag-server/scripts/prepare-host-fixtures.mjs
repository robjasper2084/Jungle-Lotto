import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
// Build-time conversion only. Canonical multiplayer hash and every physics byte
// are retained; runtime does not materialize a 140 MB base64 JSON string.
const root=resolve(import.meta.dirname,'..','fixtures');
await mkdir(root,{recursive:true});
for(const product of ['swoop-detroit','elmwood-explorer']){
 const canonical=await readFile(resolve(root,product+'.json.gz'));
 const sourceHash=createHash('sha256').update(canonical).digest('hex');
 const fixture=JSON.parse(gunzipSync(canonical).toString('utf8'));
 const physics=Buffer.from(fixture.physics,'base64');
 fixture.physics='';
 const physicsHash=createHash('sha256').update(physics).digest('hex');
 let existing;try{existing=await readFile(resolve(root,product+'.physics.bin'));}catch(error){if(error.code!=='ENOENT')throw error;}
 if(!existing||createHash('sha256').update(existing).digest('hex')!==physicsHash)await writeFile(resolve(root,product+'.physics.bin'),physics);
 await writeFile(resolve(root,product+'.server.json'),JSON.stringify({fixture,physicsHash,sourceHash}));
 console.log(product+': '+physics.length+' verified binary physics bytes; canonical map '+fixture.hash);
}

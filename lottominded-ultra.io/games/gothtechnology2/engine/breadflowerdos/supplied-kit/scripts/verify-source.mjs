import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url);
const checks=[
 ['third_party/breadflowerdos/src/dice/hfe/io/PlayerInput.hpp','9f7195e8424c3d95c6fef3c8ce48c6410a8feb68'],
 ['third_party/breadflowerdos/LICENSE','ac85cbb0290692129cad8960d25b357051d4db58'],
];
for(const [path,expected] of checks){
 const data=await readFile(new URL(path,root));
 const actual=createHash('sha1').update(`blob ${data.length}\0`).update(data).digest('hex');
 if(actual!==expected) throw new Error(`${path}: expected Git blob ${expected}, received ${actual}`);
 console.log(`PASS ${path}: ${actual}`);
}

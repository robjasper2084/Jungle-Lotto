import {writeFile,rename,unlink} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {dirname,join} from 'node:path';
// Review packages can hard-link authoring assets. Replace the directory entry,
// never truncate its inode, so compression cannot alter an original export.
export async function atomicGameAsset(path,bytes){
 const temporary=join(dirname(path),'.asset-'+randomUUID()+'.tmp');
 try{await writeFile(temporary,bytes,{flag:'wx'});await rename(temporary,path);}
 finally{await unlink(temporary).catch(error=>{if(error.code!=='ENOENT')throw error;});}
}

import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {gunzipSync} from 'node:zlib';
import type {TagFixture} from '@digital-static/ridecore/tag';

export async function loadHostFixture(root:string,product:string):Promise<{fixture:TagFixture;physics:()=>Promise<Uint8Array|undefined>}>{
  const canonical=await readFile(resolve(root,product+'.json.gz'));
  const sourceHash=createHash('sha256').update(canonical).digest('hex');
  try{
    const prepared=JSON.parse(await readFile(resolve(root,product+'.server.json'),'utf8')) as {fixture:TagFixture;physicsHash:string;sourceHash?:string};
    // A cached host map must come from the exact canonical map shipped to clients.
    // Old prepared files otherwise silently preserve retired buildings/collisions.
    if(prepared.sourceHash!==sourceHash){
      const fixture:TagFixture=JSON.parse(gunzipSync(canonical).toString('utf8'));
      return {fixture,async physics(){return undefined;}};
    }
    const {fixture,physicsHash}=prepared;
    if(fixture.product!==product||fixture.physics!==''||!/^[a-f0-9]{64}$/.test(physicsHash))throw Error('Invalid prepared server fixture');
    return {fixture,async physics(){const bytes=await readFile(resolve(root,product+'.physics.bin'));if(createHash('sha256').update(bytes).digest('hex')!==physicsHash)throw Error('Server physics checksum mismatch');return bytes;}};
  }catch(error){
    if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;
    const fixture:TagFixture=JSON.parse(gunzipSync(canonical).toString('utf8'));
    return {fixture,async physics(){return undefined;}};
  }
}

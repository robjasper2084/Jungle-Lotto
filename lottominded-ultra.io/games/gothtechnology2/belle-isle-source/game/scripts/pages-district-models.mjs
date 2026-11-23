import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';

// Local and standalone builds retain the normal bundled GLBs.
const base='https://raw.githubusercontent.com/robjasper2084/Jungle-Lotto/01f7f0c80a26c14261d3fe165600bcfbf78555e6/lottominded-ultra.io/games/gothtechnology2/belle-isle-source/game/src/belle/districtModels/';
const hashes={
 'detroit-scenery':'45b909a248ab197d1cfe39136fc73abf31fa1133611f718f2a5606ee16f0e1a8',
 'elmwood-chapel':'d6ec9fe8c3d806d0e7771cf9de352131d4642a8fe83138e68e10ca8ceee0f006',
 'elmwood-entrance-sign':'071d811091a3e8b14f9266939664502b0683dd93e3663f731d1744ab463cba34',
 'elmwood-gatehouse':'6e365f69ba951e090c3f3950aa823ce1b1f4d1729a6d66aca911833135043b65',
 'street-at-sunset':'217fa0a4a077dd554e1992d3196997de6f189c8e40e0bdd067d27c83b87afa92',
};
export function pagesDistrictModels(){
 const id='\0belle-pages-district-models';
 let root;
 return {
  name:'belle-pages-district-models',enforce:'pre',apply:'build',
  configResolved(config){root=config.root;},
  resolveId(source,importer){
   if(source==='./districtModelUrls.ts'&&importer?.endsWith('/src/belle/detroitAssets.ts'))return id;
  },
  async load(source){
   if(source!==id)return;
   const urls={};
   for(const [name,expected] of Object.entries(hashes)){
    const bytes=await readFile(resolve(root,'src/belle/districtModels',name+'.glb'));
    if(createHash('sha256').update(bytes).digest('hex')!==expected)throw Error('Update the Pages pin for '+name);
    urls[name]=base+name+'.glb';
   }
   return 'export default '+JSON.stringify(urls);
  },
 };
}

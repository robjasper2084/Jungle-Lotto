import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';

/** Reuse the real app's formula and UI source without booting its account or audio runtime. */
export async function syncLottoComponents(source=resolve(import.meta.dirname,'..')){
 const app=resolve(source,'../../../../lotto mind refined'),out=resolve(source,'src/vendor');
 await mkdir(out,{recursive:true});
 const records=[];
 for(const name of ['core','registry','ui']){
  const original=await readFile(resolve(app,'systems',name+'.js'),'utf8'),text=original.replaceAll('\r\n','\n');
  let converted;
  if(name==='core'){
   const marker='function buildSystemsCore() {';
   if(!text.includes(marker)||!text.trimEnd().endsWith('}));'))throw Error('LottoMind core wrapper changed');
   converted='const api=(()=>{'+text.slice(text.indexOf(marker)+marker.length).trimEnd().slice(0,-4)+'})();\nexport default api;\n';
  }else if(name==='registry'){
   converted=text.replace('(function systemsRegistryFactory(root) {','const api=(()=>{').replace('root.LottoMindSystemsRegistry =','return').replace(/\}\(typeof globalThis[^\n]+\)\);\s*$/,'})();\nexport default api;\n');
  }else{
   converted=text.replace('(function systemsUiFactory(root) {','export default function createSystemsUi(root) {').replace('root.LottoMindSystemsUI =','return').replace(/\}\(typeof globalThis[^\n]+\)\);\s*$/,'}\n');
   // The in-store tools begin without fictional draw history.
   converted=converted.replace(/const sharedHistory[34] = "[^\n]+";/g,match=>match.replace(/"[^\n]+"/,'""'));
   // Match the app's rejection disclosure for every history-based component.
   converted=converted.replace('metric("Draws", result.drawCount)','metric("Draws", result.drawCount)}${metric("Rejected", result.rejected.length)');
  }
  if(converted.includes('typeof globalThis'))throw Error('Unexpected global wrapper: '+name);
  await writeFile(resolve(out,'lottomind-'+name+'.mjs'),'// Generated from LottoMind Refined systems/'+name+'.js by sync_lotto_components.mjs.\n'+converted);
  records.push({source:'lotto mind refined/systems/'+name+'.js',sha256:createHash('sha256').update(original).digest('hex')});
 }
 const appCode=await readFile(resolve(app,'app.js'),'utf8'),games=appCode.match(/const LOTTO_GAMES = (\[[\s\S]*?\n\]);/);
 if(!games)throw Error('LottoMind game registry changed');
 await writeFile(resolve(source,'src/detroit/lottoGames.ts'),'// Generated from the LottoMind Refined game registry.\nexport const LOTTO_GAMES = '+games[1]+' as const;\n');
 await writeFile(resolve(source,'art/studio-retail/lottomind-component-provenance.json'),JSON.stringify({sources:records,note:'Formula and UI reuse; account, wallet and online services stay in the hosted app. In-store history starts empty.'},null,2)+'\n');
}
if(process.argv[1]&&resolve(process.argv[1])===import.meta.filename)await syncLottoComponents();

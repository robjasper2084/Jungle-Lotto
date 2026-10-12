import {resolve,dirname} from 'node:path';
import {existsSync} from 'node:fs';
/** Optional review-only routing; regular builds continue using the source core. */
export function reviewCorePlugin(){return {name:'review-core-root',enforce:'pre',resolveId(id,importer){
 const target=process.env.GAME_REVIEW_CORE_ROOT;if(!target)return;
 const original=resolve(import.meta.dirname,'../ride-core').replaceAll('\\','/');
 const path=(id.startsWith('.')&&importer?resolve(dirname(importer),id):id).replaceAll('\\','/');
 if(path.startsWith(original+'/')){const replacement=resolve(target,path.slice(original.length+1));if(existsSync(replacement))return replacement.replaceAll('\\','/');}
}};}

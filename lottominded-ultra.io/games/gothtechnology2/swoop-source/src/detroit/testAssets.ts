// Existing binary asset pack is an explicit test dependency, not duplicated game content.
import {existsSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
let base=dirname(fileURLToPath(import.meta.url));
while(dirname(base)!==base&&!existsSync(resolve(base,'Digital_Static_Street_Asset_Pack')))base=dirname(base);
export const assetPack=resolve(process.env.SWOOP_ASSET_PACK??resolve(base,'Digital_Static_Street_Asset_Pack'));
export const assetPath=(path:string,...rest:string[])=>resolve(assetPack,path.replace(/^\.\.\/\.\.\//,''),...rest);

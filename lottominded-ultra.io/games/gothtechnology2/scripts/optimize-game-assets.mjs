import {textureDownloadVariants} from './texture-download-variants.mjs';
import {resolve,dirname,basename} from 'node:path';
import {readdir,writeFile} from 'node:fs/promises';
import {shareRideTextures} from '../../../../scripts/share-ride-textures.mjs';
import {compressRideModels} from '../../../../scripts/compress-ride-models.mjs';
import {losslessRidingTextures} from '../../../../scripts/lossless-riding-textures.mjs';
import {modelDependencies} from './game-package.mjs';

/** Run after mobile variants are authored. A standalone game keeps its texture
 * pool inside its own package; deployment may additionally share across games. */
export async function optimizeGameAssets(directory){
 directory=resolve(directory);
 const options={arcade:dirname(directory),products:[basename(directory)],canonical:resolve(directory,'shared-textures'),preserveTextReferences:true};
 const sharing=await shareRideTextures('',options);
 const textures=await losslessRidingTextures('',options);
 const geometry=await compressRideModels('',options);
  if(basename(directory)==='swoop-detroit')await textureDownloadVariants(directory);
 const models=[];
 async function walk(dir,prefix=''){for(const e of await readdir(dir,{withFileTypes:true})){if(e.isSymbolicLink())throw Error('Unexpected symlink in game package');const path=prefix+e.name;if(e.isDirectory())await walk(resolve(dir,e.name),path+'/');else if(e.name.endsWith('.glb'))models.push(path);}}
 await walk(directory);await modelDependencies(directory,models);
 const report={game:basename(directory),models:models.length,sharing,textures,geometry,savedBytes:sharing.saved+textures.saved+geometry.saved,preserves:'Decoded texture pixels, dimensions, mesh and animation buffer bytes, rig hierarchy; originals retained in source'};
 await writeFile(resolve(directory,'asset-optimization.json'),JSON.stringify(report,null,2)+'\n');
 return report;
}
if(process.argv[1]&&resolve(process.argv[1])===import.meta.filename){
 const root=resolve(import.meta.dirname,'../store/public/arcade');
 for(const game of process.argv.slice(2).length?process.argv.slice(2):['swoop-detroit','elmwood-explorer']){
  if(!['swoop-detroit','elmwood-explorer'].includes(game))throw Error('Expected one of the two game packages');
  console.log(JSON.stringify(await optimizeGameAssets(resolve(root,game))));
 }
}

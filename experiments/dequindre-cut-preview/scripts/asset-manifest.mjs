import {execFileSync} from 'node:child_process';
import {statSync} from 'node:fs';
import {relative,resolve} from 'node:path';
import {repoRoot,assetRoots} from './paths.mjs';
import {orderedAssetRoots,assetRootForPath} from './asset-roots.mjs';

/** Git identities let the built preview mount original assets read-only and
 * reject changed bytes. Media is not duplicated into the production artifact. */
export function assetManifest(roots=assetRoots,{repository=repoRoot}={}){
  const result={};
  const ordered=orderedAssetRoots(roots);
  for(const root of ordered){
    for(const directory of root.directories){
      const base=relative(repository,directory).replaceAll('\\','/');
      if(base==='..'||base.startsWith('../'))throw Error('Asset manifest source is outside its repository');
      const listing=execFileSync('git',['ls-files','--stage','-z','--',base],{cwd:repository,encoding:'utf8',maxBuffer:32*1024*1024});
      for(const line of listing.split('\0')){
        if(!line)continue;
        const match=/^(\d+) ([0-9a-f]{40}) 0\t(.+)$/.exec(line);
        if(!match||!match[3].startsWith(base+'/'))throw Error('Unexpected asset index record');
        if(match[1]!=='100644'&&match[1]!=='100755')continue;
        const pathname=root.prefix+match[3].slice(base.length+1);
        if(assetRootForPath(ordered,pathname)!==root)continue;
        // The source-public copy wins when both original trees contain a file.
        // Never overwrite that decision with the published media fallback.
        if(!Object.hasOwn(result,pathname))result[pathname]={gitBlob:match[2],source:match[3]};
      }
    }
  }
  for(const record of Object.values(result)){
    let available=false;try{available=statSync(resolve(repository,record.source)).isFile();}catch{}
    if(!available)throw Error('Original preview asset is not checked out: '+record.source+'. Include its source media directory before building.');
  }
  return result;
}

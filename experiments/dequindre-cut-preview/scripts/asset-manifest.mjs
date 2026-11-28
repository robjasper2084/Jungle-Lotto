import {execFileSync} from 'node:child_process';
import {relative} from 'node:path';
import {repoRoot,assetRoots} from './paths.mjs';

/** Git identities let the built preview mount original assets read-only and
 * reject changed bytes. Media is not duplicated into the production artifact. */
export function assetManifest(){
  const result={};
  for(const {prefix,directory}of assetRoots){
    const base=relative(repoRoot,directory).replaceAll('\\','/');
    const listing=execFileSync('git',['ls-files','--stage','-z','--',base],{cwd:repoRoot,encoding:'utf8',maxBuffer:32*1024*1024});
    for(const line of listing.split('\0')){
      if(!line)continue;
      const match=/^(\d+) ([0-9a-f]{40}) 0\t(.+)$/.exec(line);
      if(!match||!match[3].startsWith(base+'/'))throw Error('Unexpected asset index record');
      if(match[1]!=='100644'&&match[1]!=='100755')continue;
      result[prefix+match[3].slice(base.length+1)]={gitBlob:match[2],source:match[3]};
    }
  }
  return result;
}

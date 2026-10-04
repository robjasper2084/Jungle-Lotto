import {access,stat,readdir,readFile,writeFile,mkdir,rename,rmdir,realpath} from 'node:fs/promises';
import {resolve,dirname,relative} from 'node:path';
import {randomUUID} from 'node:crypto';

export async function readableTree(path){
  const info=await stat(path);await access(path);
  if(info.isDirectory())for(const name of await readdir(path))await readableTree(resolve(path,name));
  else if(!info.size)throw Error('Empty package dependency: '+path);
}

export async function runtimeLicenses(source,{ridecore=false}={}){
  const files=['three','@dimforge/rapier3d-compat','fflate'].map(name=>({
    input:resolve(source,'node_modules',name,'LICENSE'),output:'licenses/'+name.replaceAll('/','-')+'.txt'
  }));
  files.push({input:resolve(import.meta.dirname,'notices/meshoptimizer-LICENSE.txt'),output:'licenses/meshoptimizer-LICENSE.txt'});
  if(ridecore)files.push({input:resolve(source,'LICENSE'),output:'LICENSE-EUC-Thrills.txt'},
    {input:resolve(source,'node_modules/@digital-static/ridecore/LICENSE.txt'),output:'LICENSE-RideCore.txt'});
  // RideCore's online client is bundled from its own linked dependencies.
  // Preserve the installed SDK and dependency notices alongside the game.
  const core=await realpath(resolve(source,'node_modules/@digital-static/ridecore'));
  const seen=new Set();
  async function include(name,owner){
    if(seen.has(name))return;seen.add(name);
    let directory,ancestor=owner;
    for(;;){
      const candidate=resolve(ancestor,'node_modules',name);
      try{await access(resolve(candidate,'package.json'));directory=candidate;break;}catch(error){if(error.code!=='ENOENT')throw error;}
      const parent=dirname(ancestor);if(parent===ancestor)throw Error('Missing runtime license dependency: '+name);ancestor=parent;
    }
    const metadata=JSON.parse(await readFile(resolve(directory,'package.json'),'utf8'));
    const notices=(await readdir(directory)).filter(file=>/^(?:license|copying|copyrightnotice|notice)(?:\.|$)/i.test(file));
    // Some npm distributions omit their notice. Preserve their original
    // metadata for the release audit; this does not replace a missing license.
    if(!notices.length)files.push({input:resolve(directory,'package.json'),output:'licenses/'+name.replaceAll('/','-')+'-MISSING-NOTICE.package.json'});
    for(const notice of notices)files.push({input:resolve(directory,notice),output:'licenses/'+name.replaceAll('/','-')+'-'+notice});
    for(const dependency of Object.keys(metadata.dependencies??{}))await include(dependency,directory);
  }
  await include('@colyseus/sdk',core);
  for(const f of files)await readableTree(f.input);
  return files;
}

/** Include already-externalized GLB images/buffers as well as embedded resources. */
export async function modelDependencies(directory,files){
  const dependencies=new Set();
  for(const file of files){
    if(!file.endsWith('.glb'))continue;
    const path=resolve(directory,file),bytes=await readFile(path);
    const model=JSON.parse(bytes.toString('utf8',20,20+bytes.readUInt32LE(12)));
    for(const resource of [...model.images??[],...model.buffers??[]]){
      if(!resource.uri||resource.uri.startsWith('data:'))continue;
      if(/^(?:[a-z]+:|\/)/i.test(resource.uri))throw Error('Non-local model resource: '+path+' -> '+resource.uri);
      const dependency=resolve(dirname(path),decodeURIComponent(resource.uri));
      const rel=relative(directory,dependency);
      if(rel.startsWith('..'))throw Error('Model resource escapes package: '+path+' -> '+resource.uri);
      await readableTree(dependency);dependencies.add(rel.replaceAll('\\','/'));
    }
  }
  return dependencies;
}

export async function validatePackage(directory,entry){
  const html=await readFile(resolve(directory,entry),'utf8');
  if(!html.includes('<script'))throw Error('Missing game entry scripts: '+entry);
  // Check the actual nested entry's scripts and styles before replacing any package.
  for(const match of html.matchAll(/(?:src|href)=["']([^"']+)["']/g)){
    const url=match[1].split(/[?#]/)[0];
    if(!url||/^(?:[a-z]+:|\/|\.\.\/)/i.test(url)||!/(?:\.js|\.css)$/.test(url))continue;
    const file=resolve(directory,url);
    if(relative(directory,file).startsWith('..'))throw Error('Asset escapes package: '+url);
    await readableTree(file);
  }
  await readableTree(resolve(directory,'SOURCE.md'));
  await readableTree(resolve(directory,'licenses'));
  const models=[];
  async function walk(dir){for(const item of await readdir(dir,{withFileTypes:true})){const file=resolve(dir,item.name);if(item.isDirectory())await walk(file);else if(item.name.endsWith('.glb'))models.push(relative(directory,file));}}
  await walk(directory);await modelDependencies(directory,models);
}

/** Promote a complete set. Keep previous outputs, and restore all of them on a failed rename. */
export async function promotePackages(packages,backupRoot,move=rename){
  for(const p of packages)await validatePackage(p.staged,p.entry);
  await mkdir(backupRoot,{recursive:true});
  const journal=[];
  try{
    for(const p of packages){
      const item={...p,backup:resolve(backupRoot,p.name),saved:false,installed:false};journal.push(item);
      try{await stat(p.destination);await move(p.destination,item.backup);item.saved=true;}
      catch(error){if(error.code!=='ENOENT')throw error;}
      await move(p.staged,p.destination);item.installed=true;
    }
  }catch(error){
    const failures=[];
    for(const p of journal.reverse())try{
      if(p.installed)await move(p.destination,p.staged);
      if(p.saved)await move(p.backup,p.destination);
    }catch(rollback){failures.push(rollback);}
    if(failures.length)throw new AggregateError([error,...failures],'Promotion failed; manual rollback from '+backupRoot+' is required.');
    throw error;
  }
}

/** Plans must all preflight successfully before this function is called. */
export async function buildRelease(store,plans){
  const root=resolve(store,'.game-builds'),lock=resolve(root,'build.lock');await mkdir(root,{recursive:true});
  try{await mkdir(lock);}catch(error){if(error.code==='EEXIST')throw Error('Another game build is active. Inspect '+lock+' before retrying.');throw error;}
  const stage=resolve(root,randomUUID());
  try{
    const packages=[];
    for(const plan of plans){
      const staged=resolve(stage,plan.name);await mkdir(staged,{recursive:true});
      await plan.build(staged);await validatePackage(staged,plan.entry);
      packages.push({...plan,staged,destination:resolve(store,'store/public/arcade',plan.name)});
    }
    await promotePackages(packages,resolve(stage,'previous'));
    const receipt={time:new Date().toISOString(),backup:resolve(stage,'previous'),packages:plans.map(p=>({name:p.name,source:p.source,entry:p.entry}))};
    await writeFile(resolve(stage,'release.json'),JSON.stringify(receipt,null,2)+'\n');
    console.log(JSON.stringify(receipt,null,2));return receipt;
  }finally{await rmdir(lock);}
}

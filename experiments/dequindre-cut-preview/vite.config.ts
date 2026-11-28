import {defineConfig,type Plugin} from 'vite';
import MagicString from 'magic-string';
import {readFile,mkdir,writeFile,readdir} from 'node:fs/promises';
import {resolve,relative} from 'node:path';
import {execFileSync} from 'node:child_process';
import {previewRoot,repoRoot,gameRoot,belleRoot,swoopRoot,generatedRoot,outputRoot,assetRoots,assertPreviewOutput} from './scripts/paths.mjs';
import {BELLE_ROOT,GAME_ROOT,PINNED_BASE,SOURCE_DIGESTS,digest,previewHtml,belleMainEdits,belleWorldEdits,belleDistrictEdits,belleCompanionEdits,swoopEdits,assertOfflineRoomBoundary} from './scripts/source-transforms.mjs';
import {previewAssets} from './scripts/asset-server.mjs';
import {assetManifest} from './scripts/asset-manifest.mjs';

export default defineConfig(async()=>{
  assertPreviewOutput(generatedRoot);assertPreviewOutput(outputRoot);
  await mkdir(generatedRoot,{recursive:true});
  await writeFile(resolve(generatedRoot,'index.html'),previewHtml(await readFile(resolve(belleRoot,'index.html'),'utf8')));
  const sourceManifest=assetManifest();
  const transformed=new Set<string>();
  const previewInputs:Record<string,string>={};
  for(const name of ['package.json','package-lock.json','vite.config.ts',...(await readdir(resolve(previewRoot,'scripts'))).filter(name=>/\.(?:mjs|ts)$/.test(name)).map(name=>'scripts/'+name)]){
    previewInputs['experiments/dequindre-cut-preview/'+name]=digest(await readFile(resolve(previewRoot,name)));
  }
  const plugin:Plugin={
    name:'isolated-dequindre-cut-adapter',enforce:'pre',
    resolveId(source){
      if(source==='/__dequindre-belle-entry__.ts')return resolve(belleRoot,'src/belle/entry.ts');
      if(source==='/__dequindre-preview-bootstrap__.ts')return resolve(previewRoot,'src/preview.ts');
    },
    transform(source,id){
      assertOfflineRoomBoundary([id]);
      const clean=id.split('?')[0],file=relative(repoRoot,clean).replaceAll('\\','/');
      if(id===clean&&file.startsWith('experiments/dequindre-cut-preview/src/'))previewInputs[file]=digest(source);
      let edits:any[]=[];
      if(file===BELLE_ROOT+'/src/belle/main.ts')edits=belleMainEdits(source);
      else if(file===BELLE_ROOT+'/src/belle/world.ts')edits=belleWorldEdits(source);
      else if(file===BELLE_ROOT+'/src/belle/parkCompanion.ts')edits=belleCompanionEdits(source);
      else if(file.startsWith(BELLE_ROOT+'/src/belle/detroit'))edits=belleDistrictEdits(source,file);
      else if(file.startsWith(GAME_ROOT+'/swoop-source/src/'))edits=swoopEdits(source,file);
      if(!edits.length)return null;
      const code=new MagicString(source);
      for(const edit of edits)code.overwrite(edit.start,edit.end,edit.replacement);
      transformed.add(file);
      return {code:code.toString(),map:code.generateMap({source:clean,includeContent:true,hires:true})};
    },
    configureServer(server){server.middlewares.use(previewAssets(assetRoots));},
    async configurePreviewServer(server){
      const built=JSON.parse(await readFile(resolve(outputRoot,'preview-manifest.json'),'utf8'));
      if(built.status!=='UNPUBLISHED_DRAFT'||built.productionDeployment!==false)throw Error('Invalid isolated preview build receipt');
      server.middlewares.use(previewAssets(assetRoots,{manifest:built.assets,sourceBase:repoRoot}));
    },
    generateBundle(_options,bundle){
      for(const file of [BELLE_ROOT+'/src/belle/main.ts',BELLE_ROOT+'/src/belle/world.ts',BELLE_ROOT+'/src/belle/parkCompanion.ts',BELLE_ROOT+'/src/belle/detroitScene.ts',BELLE_ROOT+'/src/belle/detroitAssets.ts',BELLE_ROOT+'/src/belle/detroitProps.ts'])if(!transformed.has(file))throw Error('Required preview adapter was not compiled: '+file);
      const threeRoots=new Set<string>();
      for(const item of Object.values(bundle))if(item.type==='chunk')for(const id of Object.keys(item.modules)){
        assertOfflineRoomBoundary([id]);
        const match=id.replaceAll('\\','/').match(/^(.*\/node_modules\/three)\//);
        if(match)threeRoots.add(match[1]);
      }
      if(threeRoots.size!==1)throw Error('Preview requires exactly one Three.js module installation; saw '+threeRoots.size);
      const workingTreeDirty=execFileSync('git',['status','--porcelain','--untracked-files=normal','--','experiments/dequindre-cut-preview'],{cwd:repoRoot,encoding:'utf8'}).trim()!=='';
      this.emitFile({type:'asset',fileName:'preview-manifest.json',source:JSON.stringify({schemaVersion:1,status:'UNPUBLISHED_DRAFT',productionDeployment:false,productionRooms:false,base:PINNED_BASE,sourceHead:execFileSync('git',['rev-parse','HEAD'],{cwd:repoRoot,encoding:'utf8'}).trim(),workingTreeDirty,artifactState:workingTreeDirty?'working-tree-preview':'committed-source-preview',previewInputDigests:previewInputs,sourceDigests:SOURCE_DIGESTS,transformedSources:[...transformed].sort(),threeModuleRoots:threeRoots.size,assetMode:'read-only source mounts verified by Git blob identity',assets:sourceManifest},null,2)});
    },
  };
  return {
    root:generatedRoot,base:'./',publicDir:false,plugins:[plugin],
    resolve:{dedupe:['three','fflate','@dimforge/rapier3d-compat','@supabase/realtime-js'],alias:[
      {find:/^@dequindre-preview\/(.+)$/,replacement:resolve(previewRoot,'src')+'/$1.ts'},
      {find:/^@digital-static\/ridecore$/,replacement:resolve(gameRoot,'ride-core/src/index.ts')},
      {find:'@digital-static/ridecore/cycling-view',replacement:resolve(gameRoot,'ride-core/src/cyclingView.ts')},
      {find:/^three$/,replacement:resolve(previewRoot,'node_modules/three/build/three.module.js')},
      {find:/^three\/addons\//,replacement:resolve(previewRoot,'node_modules/three/examples/jsm')+'/'},
    ]},
    build:{outDir:outputRoot,emptyOutDir:true,target:'es2022',cssCodeSplit:false,sourcemap:true,rollupOptions:{input:resolve(generatedRoot,'index.html')}},
    server:{host:'127.0.0.1',port:8317,strictPort:true,fs:{strict:true,allow:[previewRoot,belleRoot,swoopRoot,resolve(gameRoot,'ride-core'),resolve(gameRoot,'greater-detroit-world'),resolve(gameRoot,'elmwood-source'),resolve(gameRoot,'greater-detroit-graphics')]}},
    preview:{host:'127.0.0.1',port:8317,strictPort:true},
  };
});

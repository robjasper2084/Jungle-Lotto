import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const game='lottominded-ultra.io/games/gothtechnology2/belle-isle-source/game/';
const hash=b=>createHash('sha256').update(b).digest('hex');
const blob=b=>createHash('sha1').update(`blob ${b.length}\0`).update(b).digest('hex');
const insist=(v,m)=>{if(!v)throw new Error(m);};
export function sourceScope(main){
 insist(main.includes('if(now-lastUI>300){lastUI=now;'),'Original scheduled UI predicate changed');
 insist(main.includes('if(navigation.hidden||minimap.hidden)return;'),'Original hidden guard changed');
 insist(!/\bminimap\s*\.\s*(width|height)\s*=/.test(main),'Unowned minimap backing-size writer');
 insist(!/\bminimap\s*\.\s*setAttribute\s*\(/.test(main),'Unowned minimap attribute writer');
 return {originalSchedule:true,hiddenGuard:true,noTargetBackingSizeWriter:true};
}
export async function build(originalRoot,candidateRoot,toolchainRoot,outDir){
 const manifest=JSON.parse(await fs.readFile(path.join(here,'manifest.json'),'utf8'));
 const req=createRequire(path.join(toolchainRoot,'package.json'));
 const ts=req('typescript'),esbuild=req('esbuild');
 insist(ts.version===manifest.runtime.typescript,'TypeScript runtime drift');
 insist(esbuild.version===manifest.runtime.esbuild,'esbuild runtime drift');
 const inputs=[],spans=[],texts=new Map();
 async function checked(root,row,side){
  const bytes=await fs.readFile(path.join(root,row.path));
  insist(bytes.length===row.bytes&&hash(bytes)===row.sha256&&blob(bytes)===row.gitBlob,`Source pin mismatch ${side}:${row.path}`);
  inputs.push({side,...row});texts.set(`${side}:${row.path}`,bytes.toString('utf8'));return bytes.toString('utf8');
 }
 for(const row of manifest.source.originalFiles)await checked(originalRoot,row,'original');
 for(const row of manifest.source.candidateFiles)await checked(candidateRoot,row,'candidate');
 // All reused original delegates and policy must also match in the candidate checkout.
 for(const row of manifest.source.originalFiles.filter(r=>r.path.startsWith(game+'src/')&&!manifest.source.candidateFiles.some(c=>c.path===r.path)))await checked(candidateRoot,row,'candidate');
 function source(side,file){return texts.get(`${side}:${game}src/belle/${file}`);}
 function nodeSlice(side,file,predicate,label){
  const s=source(side,file);insist(typeof s==='string',`Missing ${file}`);
  const sf=ts.createSourceFile(file,s,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);const found=[];
  const visit=n=>{if(predicate(n))found.push(n);ts.forEachChild(n,visit);};visit(sf);
  insist(found.length===1,`Expected one ${side}:${file}:${label}, saw ${found.length}`);
  const n=found[0],start=n.getStart(sf),end=n.end,text=s.slice(start,end);
  spans.push({side,path:game+'src/belle/'+file,label,startUtf16:start,endUtf16:end,bytes:Buffer.byteLength(text),sha256:hash(text),text});return text;
 }
 const fn=(side,file,name)=>nodeSlice(side,file,n=>ts.isFunctionDeclaration(n)&&n.name?.text===name,name);
 const variable=(side,file,name)=>nodeSlice(side,file,n=>ts.isVariableDeclaration(n)&&n.name.getText()===name,name);
 const method=(file,name)=>nodeSlice('original',file,n=>ts.isMethodDeclaration(n)&&n.name.getText()===name,name);
 const originalScope=sourceScope(source('original','main.ts')),candidateScope=sourceScope(source('candidate','main.ts'));
 const drawOriginal=fn('original','main.ts','drawMap'),drawCandidate=fn('candidate','main.ts','drawMap');
 const foregroundOriginal=drawOriginal.slice(drawOriginal.indexOf("ctx.strokeStyle='#c3c98e'"),-1);
 const foregroundCandidate=drawCandidate.slice(drawCandidate.indexOf("ctx.strokeStyle='#c3c98e'"),drawCandidate.lastIndexOf('});'));
 insist(foregroundOriginal===foregroundCandidate,'Original foreground statements changed');
 insist(drawCandidate.includes('ctx.clearRect(0,0,420,290);mapForeground.backgroundCleared();ctx.drawImage(mapLayer,0,0);'),'Candidate background ordering changed');
 const baseOriginal=fn('original','main.ts','drawMapLayer'),baseCandidate=fn('candidate','main.ts','drawMapLayer');
 insist(baseCandidate.replace('  mapForeground.materialize();\n','')===baseOriginal,'Unexpected base-layer delta');
 const race=method('racing.ts','drawMap'),activities=method('islandActivities.ts','drawMap'),gps=method('realLocationPanel.ts','drawMap');
 const racePaths=fn('original','raceMap.ts','drawRacePaths').replace(/^export /,'');
 const dispatch=fn('original','dispatchRules.ts','getDispatchTargets').replace(/^export /,'');
 const colors=[variable('original','raceCourses.ts','ROUTE_COLORS'),variable('original','onlineProtocol.ts','PLAYER_COLORS')].map(s=>'const '+s+';').join('\n');
 const css=[];
 for(const [file,select] of [['visualPolish.css',s=>s.startsWith('body[data-hud-preset=cinematic]')],['islandTrials.css',s=>s.startsWith('body.island-trial #navigation')]]){
  const s=source('original',file),lines=s.split('\n'),matches=lines.filter(select);insist(matches.length===1,`Visibility CSS ${file}`);css.push(matches[0]);spans.push({side:'original',path:game+'src/belle/'+file,label:'visibility-rule',text:matches[0],sha256:hash(matches[0])});
 }
 css.push(source('original','hudFocus.css'));
 const modules=[];
 for(const side of ['original','candidate']){
  const root=side==='original'?originalRoot:candidateRoot;
  const main=side==='original'?drawOriginal:drawCandidate,base=side==='original'?baseOriginal:baseCandidate;
  const init=['cityMap','mapFrame','px','pz','mapLayerOpacity'].map(n=>'let '+variable(side,'main.ts',n)+';').join('\n');
  const text=`import {installCinematicPresentation} from ${JSON.stringify(path.join(root,game,'src/belle/cinematicPresentation.ts'))};\n${side==='candidate'?`import {createLegacyMinimapForeground} from ${JSON.stringify(path.join(candidateRoot,game,'src/belle/legacyMinimapForeground.ts'))};`:''}\n${colors}\n${racePaths}\n${dispatch}\nconst raceMethod=({${race}}).drawMap, activityMethod=({${activities}}).drawMap, gpsMethod=({${gps}}).drawMap;\nexport function create(env){\n const {minimap,navigation,ctx,baseCtx,mapLayer,data,districts,opacity,performance}=env;\n let destination=null;const districtDestinations=env.districtDestinations;\n const online=env.online;const race=env.makeRace(raceMethod);const activities=env.makeActivities(activityMethod);const realLocation=env.makeGps(gpsMethod);\n ${side==='candidate'?'const mapForeground=createLegacyMinimapForeground(ctx);':''}\n ${init}\n ${base}\n ${main}\n installCinematicPresentation({configure(){throw new Error('Unexpected sky mutation');}}${side==='candidate'?',()=>{env.noteReveal();mapForeground.materialize();}':''});\n return {tick(tape){destination=env.destination(tape);drawMap(tape.x,tape.z,tape.heading);},dispose(){${side==='candidate'?'mapForeground.dispose();':''}},sourceKind:${JSON.stringify(side)}};\n}\n`;
  const p=path.join(outDir,`${side}-source.ts`);await fs.mkdir(outDir,{recursive:true});await fs.writeFile(p,text);modules.push(p);
 }
 const entry=`import {create as original} from './original-source.ts';import {create as candidate} from './candidate-source.ts';import {installFixture} from ${JSON.stringify(path.join(here,'fixture.ts'))};import tapes from ${JSON.stringify(path.join(here,'tapes.json'))};import schedule from ${JSON.stringify(path.join(here,'schedule.json'))};installFixture({original,candidate,tapes,schedule,visibilityCss:${JSON.stringify(css.join('\n'))}});`;
 await fs.writeFile(path.join(outDir,'entry.ts'),entry);
 await esbuild.build({entryPoints:[path.join(outDir,'entry.ts')],outfile:path.join(outDir,'fixture.js'),bundle:true,format:'iife',platform:'browser',target:'chrome158',minifyWhitespace:true,legalComments:'none',sourcemap:false,logLevel:'silent'});
 // Re-read every source after compilation so a mixed concurrent source set cannot be blessed.
 for(const row of inputs){const b=await fs.readFile(path.join(row.side==='original'?originalRoot:candidateRoot,row.path));insist(hash(b)===row.sha256,'Source changed during build');}
 const bundle=await fs.readFile(path.join(outDir,'fixture.js'));
 const receipt={schema:'minimap-exact-source-extraction-v1',sourceOnly:true,executionBound:manifest.executionBound,originalCommit:manifest.source.originalCommit,candidateCommit:manifest.source.candidateCommit,inputs,spans,scope:{original:originalScope,candidate:candidateScope,originalForegroundUnchanged:true,immediateBackground:true},toolchain:{typescript:ts.version,esbuild:esbuild.version},bundle:{bytes:bundle.length,sha256:hash(bundle)},noFullGameBuild:true,noProducerBodyRecreation:true};
 await fs.writeFile(path.join(outDir,'source-receipt.json'),JSON.stringify(receipt,null,2)+'\n');
 return receipt;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const [original,candidate,tools,out]=process.argv.slice(2);if(!out)throw new Error('Usage: build.mjs originalRoot candidateRoot lockedGameToolchain outDir');
 const result=await build(...[original,candidate,tools,out].map(p=>path.resolve(p)));console.log(JSON.stringify({sourceOnly:true,bundle:result.bundle,inputs:result.inputs.length,spans:result.spans.length,executionBound:result.executionBound}));
}

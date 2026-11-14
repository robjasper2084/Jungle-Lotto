import os,pathlib,subprocess,json,hashlib,shutil
root=pathlib.Path(os.environ['GITHUB_WORKSPACE'])/'work';diag=pathlib.Path(__file__).parent;G=root/'lottominded-ultra.io/games/gothtechnology2/belle-isle-source/game';out=root/'integration-evidence'
mode=os.environ['MEDIA_VARIANT'];assert mode in ['baseline','preload-auto','cache-fresh']
proof=json.loads((out/'source.json').read_text());assert proof['candidateTree']=='828e8045564aa35e4bf070cd3eb8ba2b9d964441'
for f in proof['files']:assert hashlib.sha256((root/f['path']).read_bytes()).hexdigest()==f['sha256']
p=G/'src/belle/belleMusicPlayer.ts';text=p.read_text();assert "this.audio.preload='none'" in text
if mode=='preload-auto':p.write_text(text.replace("this.audio.preload='none'","this.audio.preload='auto'",1))
if mode=='cache-fresh':
 p=G/'scripts/preview-media-server.mjs';t=p.read_text();assert t.count("no-cache, max-age=0, must-revalidate")==1;p.write_text(t.replace('no-cache, max-age=0, must-revalidate','private, max-age=600',1))
p=root/'scripts/belle-cinematic-browser-smoke.mjs';original=p.read_text();t=original
assert t.count("  const tap=locator=>")==1 and t.count("  finally{phase='cleanup';")==1
shutil.copyfile(diag/'fullgame-media-observer.mjs',root/'scripts/fullgame-media-observer.mjs')
t="import {observeMedia} from './fullgame-media-observer.mjs';\n"+t
t=t.replace("  const tap=locator=>","  const finishMedia=await observeMedia(context,page,resolve(output,entry.name+'-media.jsonl'));\n  const tap=locator=>",1)
t=t.replace("  finally{phase='cleanup';","  finally{await finishMedia();phase='cleanup';",1);p.write_text(t)
# Ensure diagnostic additions are the ONLY differences to the full native test.
assert t.replace("import {observeMedia} from './fullgame-media-observer.mjs';\n",'',1).replace("  const finishMedia=await observeMedia(context,page,resolve(output,entry.name+'-media.jsonl'));\n",'',1).replace("await finishMedia();phase='cleanup';","phase='cleanup';",1)==original
(out/'fullgame-media-variant.json').write_text(json.dumps({'variant':mode,'originalTree':proof['candidateTree'],'originalTestSha256':hashlib.sha256(original.encode()).hexdigest(),'allAssertionsAndDeadlinesUnchanged':True,'scope':'Diagnostic comparison; not release acceptance or deployment'},indent=2))

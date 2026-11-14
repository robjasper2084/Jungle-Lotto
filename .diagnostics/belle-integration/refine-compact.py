import pathlib,os,subprocess,json,hashlib,tarfile
root=pathlib.Path(os.environ['GITHUB_WORKSPACE'])/'work';out=root/'integration-evidence';G='lottominded-ultra.io/games/gothtechnology2/belle-isle-source/game/'
def git(*args):return subprocess.check_output(['git',*args],cwd=root)
def digest(b):return hashlib.sha256(b).hexdigest()
proof=json.loads((out/'source.json').read_text());assert proof['candidateTree']=='7450f01b4177c3a5cb6dcd85d526f342d68affba';assert git('write-tree').decode().strip()==proof['candidateTree']
for f in proof['files']:assert digest((root/f['path']).read_bytes())==f['sha256'],f['path']
changed=[]
def edit(name,before,after,fn):
 p=root/name;assert digest(p.read_bytes())==before,name;t=fn(p.read_text());assert digest(t.encode())==after,(name,digest(t.encode()));p.write_text(t);changed.append(name)
css='''
/* In narrow landscape the default Boost lane is reserved separately from the
   header. Custom validated placements retain their fixed coordinates. */
@media(max-width:600px) and (max-height:520px){
 body.on-hoverbike:not(.royale-camera-mode):not(.coop-playing) .ride-header:not(:has(.belle-hud-control)){right:calc(max(var(--hud-edge),env(safe-area-inset-right)) + 120px)}
 body.on-hoverbike:not(.royale-camera-mode) .ride-header>.location-chip:not(.belle-hud-control){overflow:hidden}
}
@media(max-width:360px) and (max-height:520px){
 body.on-hoverbike:not(.royale-camera-mode) .ride-header>.location-chip:not(.belle-hud-control){display:none}
}
'''
edit(G+'src/belle/hudLayoutEditor.css','b7165cbd98ebda7bb762a1dd7572ca252df5801549f2bb8b79c8efbb7cb91fb6','68cee08a25e8b68fab58ab439614843122800cd7813977db7c9570d9501daf38',lambda t:t+css)
def hud(t):
 old="  await verifyHitTarget('#hover-move-zone','#hover-move-zone','flight-zone-'+viewport.width);";assert t.count(old)==1
 return t.replace(old,"  for(const id of ['view','pause','tools-toggle','hover-boost'])await verifyHitTarget('#'+id,undefined,'flight-header-'+viewport.width+'-'+id);\n"+old,1)
edit(G+'scripts/hud-layout-browser-smoke.mjs','4aa8f7dac2f7147b58f9ebaf26699cc5ea13b7083b7d71b42c0e64f923f6f640','a550d90489bd87510a6349e8fb25924746c1bdea2e1bb3de2acc549bed3e4333',hud)
def cinematic(t):
 old="assert(evidence.rendering.live&&evidence.rendering.width>0&&evidence.rendering.height>0);await shot('exploration');"
 new="""assert(evidence.rendering.live&&evidence.rendering.width>0&&evidence.rendering.height>0);
   evidence.explorationHitTargets={};
   for(const id of ['pause','tools-toggle','view','hover-boost']){
    const hit=await page.locator('#'+id).evaluate(el=>{const r=el.getBoundingClientRect();return{width:r.width,height:r.height,inside:r.x>=0&&r.y>=0&&r.right<=innerWidth&&r.bottom<=innerHeight,points:[[.5,.5],[.25,.5],[.75,.5],[.5,.25],[.5,.75]].map(([u,v])=>{const at=document.elementFromPoint(r.x+r.width*u,r.y+r.height*v);return{hit:at===el||el.contains(at),covering:at?.id||at?.tagName};})};});
    evidence.explorationHitTargets[id]=hit;
    assert(hit.width>=44&&hit.height>=44&&hit.inside&&hit.points.every(p=>p.hit),'Accessible exploration '+id+' at '+entry.name);
   }
   await shot('exploration');"""
 assert t.count(old)==1;return t.replace(old,new,1)
edit('scripts/belle-cinematic-browser-smoke.mjs','866374e2473744fff06b555d4079bd7c6caeb7e3aec9e8466c7891e8752013ff','59e2de9fde2e00d4d3c70d93b7ea1839d815955d20243232c0c36d45e8cb4101',cinematic)
extra="\n\ntest('default compact Boost and header controls have separate lanes and native regression coverage',()=>{\n const css=readFileSync(new URL('./hudLayoutEditor.css',import.meta.url),'utf8'),hud=readFileSync(new URL('../../scripts/hud-layout-browser-smoke.mjs',import.meta.url),'utf8'),cine=readFileSync(new URL('../../../../../../../scripts/belle-cinematic-browser-smoke.mjs',import.meta.url),'utf8');\n assert.match(css,/ride-header:not\\(:has\\(\\.belle-hud-control\\)\\)\\{right:calc/);assert.match(css,/120px/);\n for(const source of [hud,cine])assert.match(source,/'view','pause','tools-toggle','hover-boost'|'pause','tools-toggle','view','hover-boost'/);\n assert.match(cine,/explorationHitTargets/);\n});\n"
edit(G+'src/belle/cinematicPolicy.test.ts','2fdc408a61746a2391219815990ae87c71782d33ee3b374b30116670fb90f964','fc4c0d8e0dd611631fa7cfd79553ef5f9758fd663174d3a165ffb4c80d0f6f57',lambda t:t+extra)
git('add','--',*changed);proof['previousCandidateTree']=proof['candidateTree'];proof['candidateTree']=git('write-tree').decode().strip();proof['files']=[]
for name in git('diff','--cached','--name-only',proof['production']).decode().splitlines():
 p=root/name;assert p.is_file();proof['files'].append({'path':name,'bytes':p.stat().st_size,'sha256':digest(p.read_bytes()),'blob':git('rev-parse',':'+name).decode().strip()})
proof['validationStatus']='NOT YET PASSED';proof['compactHeaderRepair']='Actual 390x340 screenshot and five-point hit test show Boost covered by Pause/Tools. Reserve its existing lane without shrinking controls; extend real HUD/cinematic acceptance to all header buttons plus Boost.'
(out/'source.json').write_text(json.dumps(proof,indent=2));(out/'candidate-tree.txt').write_text(proof['candidateTree']+'\n');(out/'combined.patch').write_bytes(git('diff','--cached','--binary',proof['production']))
with tarfile.open(out/'combined-source.tar.gz','w:gz') as tar:
 for f in proof['files']:tar.add(root/f['path'],arcname=f['path'],recursive=False)
print(json.dumps(proof,indent=2))

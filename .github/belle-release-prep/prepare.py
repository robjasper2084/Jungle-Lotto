"""One-shot, pinned preparation of Git objects. NEVER updates refs or deploys.
The caller separately verifies the resulting commits before advancing PR branches.
"""
import base64, datetime, hashlib, json, os, pathlib, re, shutil, subprocess, time, traceback, urllib.request, urllib.parse
REPO='robjasper2084/Jungle-Lotto'
PINS={147:'d6d70c765b5c6fb274efd27bc45c471c5d5b377a',148:'d5608b6dd17d339db68ea3d6bab4c3cbf2db150a',149:'7a60e56025a1de9d331b3e70e3a1402d893f6476'}
GAME='lottominded-ultra.io/games/gothtechnology2/belle-isle-source/game/'
BELLE=GAME+'src/belle/'
RUNNER=GAME+'run-tests.mjs'
PACK='.github/belle-release-prep/'
WORKFLOW='.github/workflows/belle-release-prepare.yml'
OUT=pathlib.Path('/tmp/belle-release-prepared');OUT.mkdir(exist_ok=True)
report={'repository':REPO,'sourcePins':PINS,'productionRefModified':False,'fullReleaseGatesPassed':False,'candidates':{}}

def git(*args,check=True,env=None):
    p=subprocess.run(['git',*args],text=True,capture_output=True,env=env)
    if check and p.returncode: raise RuntimeError('git '+args[0]+': '+p.stderr[-8000:])
    return p.stdout.strip() if check else p

def api(path,data=None):
    request=urllib.request.Request('https://api.github.com/repos/'+REPO+path,
        data=None if data is None else json.dumps(data).encode(),
        headers={'Authorization':'Bearer '+os.environ['GITHUB_TOKEN'],'Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json'})
    with urllib.request.urlopen(request,timeout=60) as response:return json.load(response)

def read_at(ref,path):
    p=subprocess.run(['git','show',ref+':'+path],check=True,capture_output=True)
    return p.stdout.decode()

def one(text,before,after):
    if text.count(before)!=1:raise RuntimeError('Expected exactly one source marker: '+before[:110])
    return text.replace(before,after,1)

def register(name):
    p=pathlib.Path(RUNNER);s=p.read_text()
    if "'"+name+"'" not in s:p.write_text(one(s,"'--test',","'--test','"+name+"',"))

def merge_runner(a,b):
    patterns=[r'(entryPoints:\[)(.*?)(\])',r'(spawnSync\(process\.execPath,\[)(.*?)(\],\{stdio:)']
    masked=[];groups=[]
    for text in (a,b):
        current=text;lists=[]
        for pattern in patterns:
            m=re.search(pattern,current);assert m,'Unknown test runner structure'
            raw=m[2];values=re.findall(r"'([^']*)'",raw)
            assert re.sub(r"'[^']*'|,|\s",'',raw)=='','Nonliteral test runner list'
            lists.append(values);current=current[:m.start(2)]+'__LIST__'+current[m.end(2):]
        masked.append(current.strip());groups.append(lists)
    assert masked[0]==masked[1],'Runner implementation differs; manual review required'
    result=a
    for i,pattern in enumerate(patterns):
        values=list(dict.fromkeys(groups[0][i]+groups[1][i]));m=re.search(pattern,result)
        result=result[:m.start(2)]+','.join("'"+v+"'" for v in values)+result[m.end(2):]
    return result

def install_css(templates):
    for name in ['loaded-stylesheets.mjs','loaded-stylesheets.test.mjs']:
        pathlib.Path(GAME+'scripts/'+name).write_text(templates[name])
    path=pathlib.Path(GAME+'scripts/polish-browser-smoke.mjs');s=path.read_text()
    if "from './loaded-stylesheets.mjs'" not in s:
        s=one(s,"import assert from 'node:assert/strict';","import assert from 'node:assert/strict';\nimport {readLoadedStyles} from './loaded-stylesheets.mjs';")
        marker="      log(configuration.name + ': begin isolated CSS fixtures; real game is unloaded');"
        replacement="""      // Capture lazy-loaded game CSS before replacing the real document.
      // Preserve the cascade and media queries; no layout assertion is altered.
      const loadedStyles = await bounded(page.evaluate(readLoadedStyles), 5_000, 'Loaded game CSS evidence');
      shippedCss = loadedStyles.css;
      entry.metrics.loadedStyles = {sheetCount: loadedStyles.sheetCount, sources: loadedStyles.sources};
"""+marker
        s=one(s,marker,replacement);path.write_text(s)
    register('scripts/loaded-stylesheets.test.mjs')

def merge_sources(other):
    current=git('rev-parse','HEAD');base=git('merge-base',current,other)
    runner=merge_runner(read_at(current,RUNNER),read_at(other,RUNNER))
    result=git('merge','--no-commit','--no-ff',other,check=False)
    conflicts=set(git('diff','--name-only','--diff-filter=U').splitlines())
    allowed={RUNNER,BELLE+'cockpitLcd.ts',BELLE+'cockpitTelemetry.ts'}
    assert result.returncode in (0,1) and conflicts<=allowed,'Unexpected integration conflict: '+str(conflicts)+' '+result.stderr[-3000:]
    pathlib.Path(RUNNER).write_text(runner)
    for filename,added,needle,replacement in [
        ('cockpitLcd.ts',"import {cockpitScale} from './cinematicPolicy.ts';\n",
         'setInteraction(camera:T.Camera,enabled:boolean){this.view=camera;',
         "setInteraction(camera:T.Camera,enabled:boolean){const scale=cockpitScale(document.body.dataset.cockpitDensity==='compact',innerWidth);if(this.root.scale.x!==scale)this.root.scale.setScalar(scale);this.view=camera;"),
        ('cockpitTelemetry.ts',"import {clearanceWarning} from './cinematicPolicy.ts';\n",
         "p.speed<-.1?'REVERSE':''", "p.speed<-.1?'REVERSE':clearanceWarning(p.height,p.speed,p.landed)?'LOW CLEARANCE':''")]:
        path=BELLE+filename
        if path not in conflicts:continue
        ours=read_at(current,path);original=read_at(base,path);theirs=read_at(other,path)
        assert (added+one(original,needle,replacement)).rstrip()==ours.rstrip(),'Unexpected cinematic change in '+filename
        pathlib.Path(path).write_text(added+one(theirs,needle,replacement))
    git('add','--',GAME)
    assert not git('diff','--name-only','--diff-filter=U'),'Unresolved merge conflict'

def test(label,files):
    p=subprocess.run(['node','--experimental-strip-types','--test',*files],capture_output=True,text=True)
    (OUT/(label+'-focused.log')).write_text(p.stdout+p.stderr)
    assert p.returncode==0,label+' focused test failed; see artifact'

def publish_objects(label,base,parents):
    git('add','-A');git('diff','--cached','--check')
    paths=git('diff','--cached','--name-only',base).splitlines()
    assert paths and all(p.startswith(GAME) or p.startswith(PACK) or p==WORKFLOW for p in paths),'Unexpected source scope'
    tree=git('write-tree');elements=[]
    for path in paths:
        entry=git('ls-files','-s','--',path)
        if not entry:elements.append({'path':path,'mode':'100644','type':'blob','sha':None});continue
        mode,sha,stage=entry.split('\t',1)[0].split();assert mode=='100644' and stage=='0'
        data=subprocess.check_output(['git','cat-file','blob',sha]);assert len(data)<4000000
        blob=api('/git/blobs',{'encoding':'base64','content':base64.b64encode(data).decode()})
        assert blob['sha']==sha,'Git blob identity mismatch'
        elements.append({'path':path,'mode':mode,'type':'blob','sha':sha})
    remote=api('/git/trees',{'base_tree':git('rev-parse',base+'^{tree}'),'tree':elements})
    assert remote['sha']==tree,'Prepared tree mismatch'
    stamp=datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0).isoformat()
    author={'name':'github-actions[bot]','email':'41898282+github-actions[bot]@users.noreply.github.com','date':stamp}
    message='fix(belle): '+label+' - preserve release gates and integrated controls\n'
    env={**os.environ,'GIT_AUTHOR_NAME':author['name'],'GIT_AUTHOR_EMAIL':author['email'],'GIT_COMMITTER_NAME':author['name'],'GIT_COMMITTER_EMAIL':author['email'],'GIT_AUTHOR_DATE':stamp,'GIT_COMMITTER_DATE':stamp}
    args=['commit-tree',tree];
    for parent in parents:args+=['-p',parent]
    local=git(*args,'-m',message,env=env)
    remote=api('/git/commits',{'tree':tree,'parents':parents,'message':message,'author':author,'committer':author})
    assert remote['sha']==local,'Commit identity mismatch: local '+local+' remote '+remote['sha']
    report['candidates'][label]={'sha':local,'tree':tree,'parents':parents,'base':base,'paths':paths,'focusedTestsPassed':True,'fullReleaseGatesPassed':False}
    (OUT/(label+'.patch')).write_text(subprocess.check_output(['git','diff',base,tree],text=True))
    (OUT/'report.json').write_text(json.dumps(report,indent=2)+'\n')
    print(label+': prepared '+local+' (NO REF UPDATED)',flush=True)
    git('reset','--hard',local)
    return local

def main():
    assert os.environ['GITHUB_REPOSITORY']==REPO
    start=git('rev-parse','HEAD');assert start==os.environ['GITHUB_SHA']
    assert git('rev-parse','HEAD^')=='9ab17355e6434586f7fd28138d57217edb83ac02' and git('rev-parse','HEAD~2')==PINS[149],'Preparation parents moved'
    templates={name:pathlib.Path(PACK+name).read_text() for name in ['loaded-stylesheets.mjs','loaded-stylesheets.test.mjs','cinematicCloning.test.mjs']}
    for number,pinned in PINS.items():
        pr=api('/pulls/'+str(number));expected=start if number==149 else pinned
        assert pr['state']=='open' and pr['head']['sha']==expected and pr['base']['ref']=='main','PR head/base drift '+str(number)
    main_sha=api('/git/ref/heads/main')['object']['sha'];assert main_sha=='d546de77fb304ebb3e113c676ff9d322c0535105','Production advanced'
    report['preparationCommit']=start;report['main']=main_sha
    git('config','user.name','github-actions[bot]');git('config','user.email','41898282+github-actions[bot]@users.noreply.github.com')
    git('fetch','--no-tags','--depth=64','origin',*PINS.values())
    git('checkout','--detach',PINS[147]);install_css(templates)
    test('pr147',[GAME+'scripts/loaded-stylesheets.test.mjs'])
    a=publish_objects('pr147',PINS[147],[PINS[147]])
    git('checkout','--detach',PINS[148]);merge_sources(a);install_css(templates)
    test('pr148',[GAME+'scripts/loaded-stylesheets.test.mjs'])
    b=publish_objects('pr148',PINS[148],[PINS[148],a])
    git('checkout','--detach',start);merge_sources(b);install_css(templates)
    shader=pathlib.Path(BELLE+'cinematicTerrain.ts');s=shader.read_text()
    s=one(s,"if (shader.fragmentShader.includes('varying vec2 terrainXZ;')) {",
        "// Cloned materials may already inherit this decoration through their prior hook.\n            if (shader.fragmentShader.includes('varying vec2 terrainXZ;') && !shader.fragmentShader.includes(LAWN_DETAIL)) {")
    shader.write_text(s)
    pathlib.Path(BELLE+'cinematicCloning.test.mjs').write_text(templates['cinematicCloning.test.mjs'])
    register('src/belle/cinematicCloning.test.mjs')
    lcd=pathlib.Path(BELLE+'cockpitLcd.ts').read_text();assert all(x in lcd for x in ['cockpitScale','Math.min(6,','this.togglePage()','jarvsLcdReading','Show JARVS display'])
    runner=pathlib.Path(RUNNER).read_text()
    for ref in PINS.values():
        old=read_at(ref,RUNNER)
        names=re.findall(r"'([^']+\.test\.(?:ts|mjs))'",old)
        assert all("'"+name+"'" in runner for name in names),'An original test was removed'
    # Fix the real favicon request rather than filtering a 404 from browser logs.
    html=pathlib.Path(GAME+'index.html');source=html.read_text()
    assert not re.search(r'rel=[\"\'](?:shortcut )?icon[\"\']',source,re.I),'Existing icon needs review'
    svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#102a30"/><path d="M9 7h8a5 5 0 0 1 0 10H9V7m0 10h9a4 4 0 0 1 0 8H9V7" fill="none" stroke="#9ceadd" stroke-width="3" stroke-linejoin="round"/></svg>'
    icon='<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,'+urllib.parse.quote(svg,safe='')+'">\n'
    html.write_text(one(source,'</head>',icon+'</head>'))
    icon_test=r"""import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('entry declares a self-contained SVG icon without an origin-root request',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const match=html.match(/<link rel="icon" type="image\/svg\+xml" href="data:image\/svg\+xml,([^"]+)">/);
 assert.ok(match,'Real entry must declare its icon');
 const svg=decodeURIComponent(match[1]);assert.match(svg,/<svg/);assert.doesNotMatch(svg,/<script|https?:\/\/(?!www.w3.org)/);
 assert.ok(html.indexOf(match[0])<html.indexOf('</head>'));
});
"""
    pathlib.Path(GAME+'scripts/favicon-source.test.mjs').write_text(icon_test)
    register('scripts/favicon-source.test.mjs')
    test('pr149',[GAME+'scripts/loaded-stylesheets.test.mjs',BELLE+'cinematicCloning.test.mjs',GAME+'scripts/favicon-source.test.mjs'])
    shutil.rmtree(PACK);pathlib.Path(WORKFLOW).unlink()
    c=publish_objects('pr149',start,[start,b])
    assert api('/git/ref/heads/main')['object']['sha']==main_sha,'Production ref changed externally'
    report['prepared']=True;report['integrationHead']=c

try:main()
except Exception as error:
    report['prepared']=False;report['failure']=str(error);(OUT/'failure.txt').write_text(traceback.format_exc());raise
finally:
    (OUT/'report.json').write_text(json.dumps(report,indent=2)+'\n')

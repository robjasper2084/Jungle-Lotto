import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseMacCommandLine,parsePsIdentity,selectBrowserAndGpu,validateProcessIdentity,
  ensureSettingsOpen,startProfileCapture,stopPartialProfileCapture,
} from './render-gpu-process-sample.mjs';

const browserExecutable='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const gpuExecutable='/Applications/Google Chrome.app/Contents/Frameworks/Google Chrome Framework.framework/Versions/158.0.8127.89/Helpers/Google Chrome Helper (GPU).app/Contents/MacOS/Google Chrome Helper (GPU)';
const nativeFlags=['--enable-gpu','--use-gl=angle','--use-angle=metal'];
const browserArgs=browserExecutable+' --disable-background-networking '+nativeFlags.join(' ')+' --user-data-dir=/var/folders/example/profile --no-startup-window';
function identity(){
  return {
    currentUid:501,currentEffectiveUid:501,browserCommandLine:browserArgs,
    cdp:{processInfo:[{id:100,type:'browser',cpuTime:10},{id:101,type:'GPU',cpuTime:20}]},
    os:{
      browser:{pid:100,ppid:99,uid:501,user:'runner',startTime:'Tue Nov 24 09:00:00 2026',cpuSeconds:10,executable:browserExecutable,realExecutable:browserExecutable,args:browserArgs},
      gpu:{pid:101,ppid:100,uid:501,user:'runner',startTime:'Tue Nov 24 09:00:01 2026',cpuSeconds:20,executable:gpuExecutable,realExecutable:gpuExecutable,
        args:gpuExecutable+' --type=gpu-process --use-angle=metal --gpu-preferences=AAAA --shared-files --trace-process-track-uuid=123'},
    },
  };
}
function alterCommand(snapshot,source,transform){
  if(source==='SystemInfo')snapshot.browserCommandLine=transform(snapshot.browserCommandLine);
  else snapshot.os.browser.args=transform(snapshot.os.browser.args);
}

test('native identity accepts the unquoted macOS executable with spaces and bounded switch evidence',()=>{
  const snapshot=identity();
  assert.deepEqual(parseMacCommandLine(browserArgs,browserExecutable),['--disable-background-networking',...nativeFlags,'--user-data-dir=/var/folders/example/profile','--no-startup-window']);
  assert.deepEqual(validateProcessIdentity(snapshot),{browserPid:100,gpuPid:101,sameUser:true,directBrowserChild:true,stable:false});
});

test('macOS ps identity preserves the executable containing spaces and converts the observed CPU clock',()=>{
  const value=parsePsIdentity('100 99 501 runner Tue Nov 24 09:00:00 2026 1-02:03:04.50 '+browserExecutable,browserArgs+'\n');
  assert.equal(value.executable,browserExecutable);assert.equal(value.args,browserArgs);
  assert.equal(value.cpuSeconds,93784.5);assert.equal(value.pid,100);assert.equal(value.uid,501);
});

test('missing, oversized, quoted, escaped and positional command-line evidence is rejected instead of guessed',()=>{
  const invalid=[null,undefined,7,'',' ',browserExecutable,browserExecutable+' ',browserExecutable+' '+('x'.repeat(1024*1024)),
    '"'+browserExecutable+'" '+nativeFlags.join(' '),
    browserArgs.replace('--use-angle=metal','--use-angle="metal"'),
    browserArgs.replace('--use-angle=metal',"--use-angle='metal'"),
    browserArgs.replace('--use-angle=metal','--use-angle=me\\tal'),
    browserArgs+' --user-agent=two words',browserArgs+'\n--enable-tracing',browserArgs+'\t--enable-tracing',
    browserArgs+'\0',browserArgs+' --',browserArgs+' about:blank',browserArgs+' -use-angle=metal',
    browserArgs.replace(browserExecutable,browserExecutable+'-other'),browserArgs+' '];
  for(const value of invalid)assert.throws(()=>parseMacCommandLine(value,browserExecutable));
});

for(const source of ['SystemInfo','OS']){
  test(source+' requires each native flag exactly once and with its exact value',()=>{
    for(const flag of nativeFlags){
      const name=flag.split('=')[0];
      for(const transform of [
        text=>text.replace(' '+flag,''),
        text=>text+' '+flag,
        text=>text+' '+name+'=other',
        text=>text.replace(flag,name+'=other'),
        text=>text.replace(flag,'--annotation='+flag),
      ]){
        const snapshot=identity();alterCommand(snapshot,source,transform);
        assert.throws(()=>validateProcessIdentity(snapshot),/exactly one native launch switch|conflicting value/);
      }
    }
  });

  test(source+' rejects native conflicts and added instrumentation even when required flags also appear',()=>{
    const forbidden=['--disable-gpu','--disable-gpu=false','--disable-gpu-compositing',
      '--enable-gpu-debugging','--enable-gpu-client-logging','--enable-gpu-command-logging',
      '--enable-gpu-service-logging','--enable-gpu-service-tracing=1','--trace-startup',
      '--trace-startup-duration=8','--trace-config-file=/tmp/trace.json','--enable-tracing=blink'];
    for(const flag of forbidden){
      const snapshot=identity();alterCommand(snapshot,source,text=>text+' '+flag);
      assert.throws(()=>validateProcessIdentity(snapshot),/conflicting native GPU switch|forbidden additional instrumentation switch/);
    }
  });

  test(source+' rejects child-process, empty or mismatched executable evidence',()=>{
    for(const transform of [()=>'',()=>null,text=>text+' --type',text=>text+' --type=renderer',text=>text.replace(browserExecutable,'/tmp/Google Chrome')]){
      const snapshot=identity();alterCommand(snapshot,source,transform);assert.throws(()=>validateProcessIdentity(snapshot));
    }
  });
}

test('a flag-looking value is not mistaken for an additional instrumentation switch',()=>{
  const snapshot=identity();snapshot.browserCommandLine+=' --example-path=/tmp/--enable-tracing';snapshot.os.browser.args+=' --example-path=/tmp/--enable-tracing';
  assert.equal(validateProcessIdentity(snapshot).gpuPid,101);
});

test('OS GPU type must be exactly one gpu-process switch, not a duplicate or conflicting child type',()=>{
  for(const suffix of [' --type=gpu-process',' --type=renderer',' --type']){
    const snapshot=identity();snapshot.os.gpu.args+=suffix;assert.throws(()=>validateProcessIdentity(snapshot),/Exactly one OS GPU command type/);
  }
  for(const replacement of ['--type=renderer','--annotation=--type=gpu-process']){
    const snapshot=identity();snapshot.os.gpu.args=snapshot.os.gpu.args.replace('--type=gpu-process',replacement);
    assert.throws(()=>validateProcessIdentity(snapshot),/Exactly one OS GPU command type/);
  }
});

test('CDP identity rejects duplicate, unknown, malformed or overlapping target processes',()=>{
  const rows=identity().cdp.processInfo;
  for(const value of [[],null,[...rows,rows[0]],[...rows,rows[1]],[rows[0]],
    [{...rows[0],id:101},rows[1]],[{...rows[0],cpuTime:NaN},rows[1]],
    [{...rows[0],id:-1},rows[1]],[{...rows[0],cpuTime:-1},rows[1]]])assert.throws(()=>selectBrowserAndGpu(value));
});

test('same-user, CDP/OS PIDs, direct parent and executable bundle checks remain required',()=>{
  const mutations=[
    s=>{s.currentUid=undefined;},s=>{s.currentEffectiveUid=0;},s=>{s.os.browser.uid=0;},s=>{s.os.gpu.uid=0;},
    s=>{s.os.browser.pid=200;},s=>{s.os.gpu.pid=201;},s=>{s.os.gpu.ppid=99;},
    s=>{s.os.browser.realExecutable='/tmp/Other.app/Contents/MacOS/Other';},
    s=>{s.os.gpu.realExecutable='/Applications/Other.app/Contents/MacOS/Other';},
    s=>{s.os.gpu.executable='relative/gpu';},
  ];
  for(const mutate of mutations){const snapshot=identity();mutate(snapshot);assert.throws(()=>validateProcessIdentity(snapshot));}
});

test('sampling requires stable process identity and monotonically observed CPU counters',()=>{
  const before=identity(),after=structuredClone(before);
  for(const row of after.cdp.processInfo)row.cpuTime+=1;
  for(const row of Object.values(after.os))row.cpuSeconds+=1;
  assert.equal(validateProcessIdentity(after,before).stable,true);
  for(const name of ['browser','gpu']){
    for(const key of ['pid','ppid','uid','user','startTime','executable','realExecutable','args']){
      const changed=structuredClone(after);changed.os[name][key]=typeof changed.os[name][key]==='number'?changed.os[name][key]+1:changed.os[name][key]+'x';
      assert.throws(()=>validateProcessIdentity(changed,before));
    }
    const osBackwards=structuredClone(after);osBackwards.os[name].cpuSeconds=before.os[name].cpuSeconds-1;
    assert.throws(()=>validateProcessIdentity(osBackwards,before),/OS CPU time moved backwards/);
    const cdpBackwards=structuredClone(after),index=name==='browser'?0:1;cdpBackwards.cdp.processInfo[index].cpuTime=before.cdp.processInfo[index].cpuTime-1;
    assert.throws(()=>validateProcessIdentity(cdpBackwards,before),/CDP CPU time moved backwards/);
  }
});

function settingsFixture({visible=false,menuVisible=false}={}){
  const calls=[],state={visible,menuVisible};
  const settings={isVisible:async()=>state.visible};
  const page={locator(selector){
    if(selector==='#settings')return settings;
    if(selector==='#ride-menu')return {isVisible:async()=>state.menuVisible};
    if(selector==='#tools-toggle')return {click:async()=>{calls.push('tools');state.menuVisible=true;}};
    if(selector==='#settings-open')return {click:async()=>{calls.push('settings');state.visible=true;}};
    assert.fail('Unexpected locator '+selector);
  }};
  const expect=locator=>({toBeVisible:async()=>{assert.equal(locator,settings);assert.equal(state.visible,true);calls.push('visible');}});
  return {page,expect,calls,state};
}

test('opening Settings is idempotent, including when the tools menu is hidden',async()=>{
  const f=settingsFixture({visible:true});await ensureSettingsOpen(f.page,f.expect);await ensureSettingsOpen(f.page,f.expect);assert.deepEqual(f.calls,[]);
});

test('opening Settings uses only the missing UI transitions',async()=>{
  for(const menuVisible of [false,true]){
    const f=settingsFixture({menuVisible});await ensureSettingsOpen(f.page,f.expect);
    assert.deepEqual(f.calls,menuVisible?['settings','visible']:['tools','settings','visible']);
    await ensureSettingsOpen(f.page,f.expect);assert.equal(f.calls.filter(value=>value==='settings').length,1);
  }
});

function profileFixture({running=false,panelOpen=true,startError=null,stopError=null,enterRunning=true,trusted=true}={}){
  const calls=[],receipts=[],state={running,panelOpen,settingsVisible:true};
  const panel={
    evaluate:async fn=>fn({open:state.panelOpen}),
    locator(selector){assert.equal(selector,'summary');return {click:async()=>{calls.push('summary');state.panelOpen=!state.panelOpen;}};},
    getByRole(role,options){
      assert.equal(role,'button');assert.equal(options.exact,true);
      const isStop=options.name==='Stop and show report';assert(isStop||options.name==='Start 10-minute capture');
      const exists=()=>isStop?state.running:!state.running;
      const visible=()=>exists()&&state.panelOpen&&state.settingsVisible;
      return {
        count:async()=>Number(exists()&&(options.includeHidden||visible())),
        isVisible:async()=>visible(),
        click:async()=>{
          assert(visible(),'Cannot click hidden capture control');calls.push(isStop?'stop':'start');
          if(isStop){if(stopError)throw stopError;state.running=false;}
          else {if(startError)throw startError;if(enterRunning){state.running=true;state.panelOpen=false;}receipts.push({trusted,text:options.name,at:12});}
        },
        waitFor:async options=>{calls.push('stop-hidden');assert.equal(options.state,'hidden');assert.equal(visible(),false);},
      };
    },
  };
  const settings=async()=>{calls.push('settings');state.settingsVisible=true;};
  return {calls,state,panel,settings,readInput:async()=>({clicks:receipts})};
}

test('pre-start cleanup does not reopen Settings or click a hidden Stop control',async()=>{
  const f=profileFixture();
  assert.deepEqual(await stopPartialProfileCapture({captureStarted:false},f.settings,f.panel),{attempted:false,reason:'capture-never-started'});
  assert.deepEqual(f.calls,[]);
  assert.equal((await stopPartialProfileCapture({captureStarted:false},undefined,undefined)).attempted,false);
});

test('actual Start is recorded despite the deliberately collapsed panel; partial cleanup reopens and stops it',async()=>{
  const f=profileFixture(),report={captureStarted:false,diagnosticCaptureCompleted:false};
  await startProfileCapture(f.panel,f.readInput,report);
  assert.equal(report.captureStarted,true);assert.equal(f.state.panelOpen,false);
  assert.equal(report.captureStart.trustedClick.trusted,true);assert.equal(report.captureStart.trustedClick.at,12);
  assert(report.captureStart.confirmed.monotonicMs>=report.captureStart.clickDelivered.monotonicMs);
  assert(report.captureStart.clickDelivered.monotonicMs>=report.captureStart.requested.monotonicMs);
  f.state.settingsVisible=false;
  assert.deepEqual(await stopPartialProfileCapture(report,f.settings,f.panel),{attempted:true,reason:'partial-capture-stopped'});
  assert.equal(f.state.running,false);assert.deepEqual(f.calls,['start','settings','summary','stop','stop-hidden']);
});

test('failed or ineffective Start is never recorded as a running capture',async()=>{
  for(const options of [{startError:new Error('click failed')},{enterRunning:false}]){
    const f=profileFixture(options),report={captureStarted:false};
    await assert.rejects(startProfileCapture(f.panel,f.readInput,report));assert.equal(report.captureStarted,false);
    await stopPartialProfileCapture(report,f.settings,f.panel);assert.deepEqual(f.calls,['start']);
  }
});

test('missing trusted Start evidence fails diagnosis while cleanup still stops an observed running capture',async()=>{
  const f=profileFixture({trusted:false}),report={captureStarted:false};
  await assert.rejects(startProfileCapture(f.panel,f.readInput,report),/actual trusted click receipt/);
  assert.equal(report.captureStarted,true);assert.equal(report.captureStart.trustedClick,null);
  assert.equal((await stopPartialProfileCapture(report,f.settings,f.panel)).attempted,true);
});

test('completed captures and already stopped partial captures do not receive another Stop',async()=>{
  const complete=profileFixture({running:false});
  assert.equal((await stopPartialProfileCapture({captureStarted:true,diagnosticCaptureCompleted:true},complete.settings,complete.panel)).reason,'capture-completed');
  assert.deepEqual(complete.calls,[]);
  const stopped=profileFixture({running:false,panelOpen:false});
  assert.equal((await stopPartialProfileCapture({captureStarted:true},stopped.settings,stopped.panel)).reason,'capture-already-stopped');
  assert.deepEqual(stopped.calls,['settings','summary']);
});

test('real Stop failures propagate unchanged for the report cleanupErrors collector',async()=>{
  const error=new Error('Native Stop click failed'),f=profileFixture({running:true,stopError:error});
  await assert.rejects(stopPartialProfileCapture({captureStarted:true},f.settings,f.panel),observed=>observed===error);
  assert.equal(f.state.running,true);assert.deepEqual(f.calls,['settings','stop']);
});

test('a started capture with unavailable controls is a cleanup failure, not an apparent success',async()=>{
  const f=profileFixture({running:true});f.settings=async()=>{f.state.settingsVisible=false;};
  await assert.rejects(stopPartialProfileCapture({captureStarted:true},f.settings,f.panel),/neither a visible Stop/);
  await assert.rejects(stopPartialProfileCapture({captureStarted:true},undefined,undefined),/requires its cleanup UI/);
});

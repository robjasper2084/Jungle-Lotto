import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {Soundtrack as Swoop} from '../swoop-source/src/detroit/soundtrack.ts';
const {Soundtrack:Elmwood}=await import(pathToFileURL(resolve(process.env.ELMWOOD_SOURCE||resolve(import.meta.dirname,'../../../../../euc-detroit-riverwalk'),'src/detroit/elmwood-soundtrack.ts')));

function harness(t,saved,deny=false,playError){
  let plays=0;const nodes=new Map();
  const node=()=>({value:'',textContent:'',append(){},setAttribute(){},querySelector(id){if(!nodes.has(id))nodes.set(id,node());return nodes.get(id);}});
  const data=new Map(Object.entries(saved));
  for(const [key,value]of Object.entries({
    document:{hidden:false,createElement:node,addEventListener(){}},BroadcastChannel:undefined,
    Audio:class {src='';paused=true;play(){plays++;this.paused=false;return playError?Promise.reject({name:playError}):Promise.resolve();}pause(){this.paused=true;}},
    localStorage:{getItem(k){if(deny)throw Error('Storage denied');return data.get(k)??null;},setItem(k,v){if(deny)throw Error('Storage denied');data.set(k,v);}}
  })){const descriptor=Object.getOwnPropertyDescriptor(globalThis,key);Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});t.after(()=>{if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];});}
  return {parent:node(),nodes,data,plays:()=>plays};
}
for(const [name,Soundtrack,key]of [['Swoop',Swoop,'swoop-music-v1'],['Elmwood',Elmwood,'elmwood-music-v1']]){
  for(const error of ['AbortError','NotAllowedError'])test(name+' can mute after '+error,async t=>{
    const h=harness(t,{[key]:JSON.stringify({enabled:true})},false,error),music=new Soundtrack(h.parent);
    music.unlock();await Promise.resolve();await Promise.resolve();
    if(error==='AbortError')assert.equal(h.nodes.get('#musicToggle').textContent,'Music on');
    h.nodes.get('#musicToggle').onclick();assert.equal(music.enabled,false);assert.equal(JSON.parse(h.data.get(key)).enabled,false);
  });
  test(name+' saved music off survives start, resume, scene changes and reload',t=>{
    const h=harness(t,{[key]:JSON.stringify({enabled:false})});
    for(let n=0;n<2;n++){const music=new Soundtrack(h.parent);music.unlock();music.update(1,'garden',true,8,0,0);music.update(0,'ride',false,0,0,0);music.unlock();assert.equal(music.enabled,false);}
    assert.equal(h.plays(),0);
  });
  test(name+' saved music on waits for a gesture and can be muted before the first ride',t=>{
    const h=harness(t,{[key]:JSON.stringify({enabled:true})}),music=new Soundtrack(h.parent);
    music.update(1,'ride',true,8,0,0);assert.equal(h.plays(),0);
    h.nodes.get('#musicToggle').onclick();assert.equal(music.enabled,false);assert.equal(h.plays(),0);
    assert.equal(JSON.parse(h.data.get(key)).enabled,false);music.unlock();assert.equal(h.plays(),0);
  });
  for(const denied of [true,false])test(name+(denied?' denied storage':' malformed preference')+' is safe and still allows session mute',t=>{
    const h=harness(t,{[key]:'{broken'},denied),music=new Soundtrack(h.parent);
    music.update(1,'ride',true,8,0,0);assert.equal(h.plays(),0);
    if(!music.enabled)h.nodes.get('#musicToggle').onclick();
    h.nodes.get('#musicToggle').onclick();assert.equal(music.enabled,false);
    const played=h.plays();music.unlock();music.update(1,'ride',true,8,0,0);assert.equal(h.plays(),played);
    if(denied)assert.match(h.nodes.get('#musicPersistence').textContent,/storage is unavailable/);
  });
}

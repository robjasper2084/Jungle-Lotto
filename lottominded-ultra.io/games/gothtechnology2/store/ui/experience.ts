import { config } from '../config';
import { href } from '../utilities/paths';
import { $, $$, saved, save, openDialog, announce } from './dom';
import { chooseQuality, type QualityChoice } from '../three/governor';
import { initHomeCommercial } from './home-commercial';
export function isReduced() { return document.documentElement.dataset.reducedMotion==='true'; }
export function initExperience() {
  const motionQuery=matchMedia('(prefers-reduced-motion: reduce)');
  const motionButton=$<HTMLButtonElement>('#motion-toggle')!, quality=$<HTMLSelectElement>('#quality-select')!;
  const updateMotion=()=>{const reduced=motionQuery.matches||saved('gothtechnology.armory.motion')==='reduced';document.documentElement.dataset.reducedMotion=String(reduced);motionButton.setAttribute('aria-pressed',String(reduced));motionButton.textContent=reduced?'Reduced motion on':'Reduce motion';document.dispatchEvent(new Event('store:preferences'));};
  motionButton.addEventListener('click',()=>{save('gothtechnology.armory.motion',isReduced()?'full':'reduced');updateMotion();if(motionQuery.matches)announce('Your system reduced-motion preference remains active.');});
  motionQuery.addEventListener('change',updateMotion);updateMotion();
  $$('[data-open-settings]').forEach(button=>button.addEventListener('click',()=>openDialog('experience-dialog',button)));
  const pause=$<HTMLButtonElement>('#scene-pause')!;
  const syncPause=()=>{
    const paused=isReduced()||saved('gothtechnology.armory.pause')==='true';
    document.documentElement.dataset.cinemaPaused=String(paused);
    pause.disabled=isReduced();
    pause.setAttribute('aria-pressed',String(paused));
    pause.textContent=paused?'Resume decorative motion':'Pause decorative motion';
    document.dispatchEvent(new Event('store:motion'));
  };
  pause.addEventListener('click',()=>{save('gothtechnology.armory.pause',String(document.documentElement.dataset.cinemaPaused!=='true'));syncPause();});
  document.addEventListener('store:preferences',syncPause);syncPause();
  const selected=saved('gothtechnology.armory.quality');if(['auto','high','balanced','low','fallback'].includes(selected??''))quality.value=selected!;
  quality.addEventListener('change',()=>{save('gothtechnology.armory.quality',quality.value);document.dispatchEvent(new Event('store:preferences'));});
  const offline=()=>{$('#offline-notice')!.hidden=navigator.onLine;};offline();window.addEventListener('online',offline);window.addEventListener('offline',offline);
  const soundPreference='gothtechnology.armory.sound';
  let ambient=$<HTMLAudioElement>('[data-background-audio]'), sound=false;
  const soundButtons=$$<HTMLButtonElement>('#sound-toggle,[data-toggle-sound]');
  const syncSound=(playing:boolean)=>{sound=playing;soundButtons.forEach(button=>{button.setAttribute('aria-pressed',String(playing));button.textContent=playing?'Sound on':'Sound off';});document.documentElement.dataset.sound=playing?'on':'off';document.dispatchEvent(new Event('store:sound'));};
  const stopAudio=(remember=false)=>{ambient?.pause();if(remember)save(soundPreference,'off');syncSound(false);};
  const startAudio=async(announceFailure=false)=>{
    if(!config.features.enableStoreAudio)return false;
    ambient??=new Audio(href('media/lottomind-vault-174hz-background.mp3'));ambient.volume=.13;ambient.loop=true;
    try{await ambient.play();save(soundPreference,'on');syncSound(true);return true;}
    catch{syncSound(false);if(announceFailure)announce('Audio could not start. Check your browser sound settings and try again.');return false;}
  };
  soundButtons.forEach(soundButton=>soundButton.addEventListener('click',async()=>{
    if(!config.features.enableStoreAudio)return;
    if(sound){stopAudio(true);return;}
    await startAudio(true);
  }));
  syncSound(false);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stopAudio();else if(ambient&&saved(soundPreference)!=='off')void startAudio();});
  document.addEventListener('store:game-launch',()=>stopAudio());
  document.addEventListener('store:media-play',()=>stopAudio());
  const video=$<HTMLVideoElement>('#store-video')!, transmission=$<HTMLDialogElement>('#transmission-dialog')!;
  $$('[data-watch-transmission]').forEach(button=>button.addEventListener('click',async()=>{
    if(!config.features.enableCommercialTransmissions||$('#home-commercial'))return;
    stopAudio();video.defaultMuted=false;video.muted=false;video.volume=1;video.src=href('media/charm-transmission-silent.mp4');openDialog('transmission-dialog',button);
    if(!isReduced())try{await video.play();}catch{announce('Press play to start the transmission.');}
  }));
  video.addEventListener('error',()=>announce('Transmission unavailable. Product imagery and the catalog are still available.'));
  transmission.addEventListener('close',()=>{video.pause();video.removeAttribute('src');video.load();});

  initHomeCommercial();
  const host=$('#armory-scene');
  if(host&&config.features.enable3DHero) {
    let dispose:(()=>void)|undefined, generation=0;
    const start=async()=>{
      const request=++generation;dispose?.();dispose=undefined;host.replaceChildren();
      const nav=navigator as Navigator&{deviceMemory?:number;connection?:{saveData?:boolean}};
      // Reduced motion / save data never allocate a WebGL context or download Three.js.
      const modelsMissing=!host.dataset.hoodieModel||!host.dataset.charmModel;
      const fallback=isReduced()||nav.connection?.saveData||quality.value==='fallback'||modelsMissing;
      let webgl=false;
      if(!fallback){try{const canvas=document.createElement('canvas');const context=canvas.getContext('webgl2');webgl=!!context;context?.getExtension('WEBGL_lose_context')?.loseContext();}catch{/* Static artwork stays visible. */}}
      const level=chooseQuality({webgl,reducedMotion:isReduced(),saveData:!!nav.connection?.saveData,memory:nav.deviceMemory,cores:nav.hardwareConcurrency,mobile:matchMedia('(max-width: 760px)').matches,choice:quality.value as QualityChoice});
      const state=$('#scene-status')!;state.textContent=level==='fallback'?'Armory Online — Static Display':'Loading optional atmosphere';host.dataset.quality=level;
      const pause=$<HTMLButtonElement>('#scene-pause');if(pause){pause.hidden=false;pause.disabled=isReduced();}
      if(level==='fallback')return;
      try{const {mountScene}=await import('../three/cathedral');if(request!==generation)return;dispose=mountScene(host,level,update=>{state.textContent=update;});}
      catch{state.textContent='Armory Online — Static Display';host.replaceChildren();host.dataset.quality='fallback';}
    };
    const idle=window.requestIdleCallback??((fn:IdleRequestCallback)=>window.setTimeout(()=>fn({didTimeout:false,timeRemaining:()=>0}),600));
    if (!host.dataset.hoodieModel || !host.dataset.charmModel) void start();
    else idle(()=>void start(),{timeout:1500});document.addEventListener('store:preferences',()=>void start());
    window.addEventListener('pagehide',()=>{generation++;dispose?.();},{once:true});
  }
}

import { config } from '../config';
import { href } from '../utilities/paths';
import { $, $$, saved, save, openDialog, announce } from './dom';
import { chooseQuality, type QualityChoice } from '../three/governor';
export function isReduced() { return document.documentElement.dataset.reducedMotion==='true'; }
export function initExperience() {
  const motionQuery=matchMedia('(prefers-reduced-motion: reduce)');
  const motionButton=$<HTMLButtonElement>('#motion-toggle')!, quality=$<HTMLSelectElement>('#quality-select')!;
  const updateMotion=()=>{const reduced=motionQuery.matches||saved('gothtechnology.armory.motion')==='reduced';document.documentElement.dataset.reducedMotion=String(reduced);motionButton.setAttribute('aria-pressed',String(reduced));motionButton.textContent=reduced?'Reduced motion on':'Reduce motion';document.dispatchEvent(new Event('store:preferences'));};
  motionButton.addEventListener('click',()=>{save('gothtechnology.armory.motion',isReduced()?'full':'reduced');updateMotion();if(motionQuery.matches)announce('Your system reduced-motion preference remains active.');});
  motionQuery.addEventListener('change',updateMotion);updateMotion();
  const selected=saved('gothtechnology.armory.quality');if(['auto','high','balanced','low','fallback'].includes(selected??''))quality.value=selected!;
  quality.addEventListener('change',()=>{save('gothtechnology.armory.quality',quality.value);document.dispatchEvent(new Event('store:preferences'));});
  const offline=()=>{$('#offline-notice')!.hidden=navigator.onLine;};offline();window.addEventListener('online',offline);window.addEventListener('offline',offline);
  let ambient:HTMLAudioElement|null=null, sound=false;
  const soundButton=$<HTMLButtonElement>('#sound-toggle')!;
  const stopAudio=()=>{ambient?.pause();sound=false;soundButton.setAttribute('aria-pressed','false');soundButton.textContent='Sound off';};
  soundButton.addEventListener('click',async()=>{
    if(!config.features.enableStoreAudio)return;
    if(sound){stopAudio();return;}
    ambient??=new Audio(href('assets/audio/lottomind-frequency-112.mp3'));ambient.volume=.13;ambient.loop=true;
    try{await ambient.play();sound=true;soundButton.setAttribute('aria-pressed','true');soundButton.textContent='Sound on';}catch{announce('Audio could not start. Sound remains off.');}
  });
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stopAudio();});
  document.addEventListener('store:game-launch',stopAudio);
  const video=$<HTMLVideoElement>('#store-video')!, transmission=$<HTMLDialogElement>('#transmission-dialog')!;
  $$('[data-watch-transmission]').forEach(button=>button.addEventListener('click',async()=>{
    if(!config.features.enableCommercialTransmissions)return;
    stopAudio();video.muted=true;video.src=href('media/charm-transmission-silent.mp4');openDialog('transmission-dialog',button);
    if(!isReduced())try{await video.play();}catch{announce('Press play to start the transmission.');}
  }));
  video.addEventListener('error',()=>announce('Transmission unavailable. Product imagery and the catalog are still available.'));
  transmission.addEventListener('close',()=>{video.pause();video.removeAttribute('src');video.load();});
  $('#hide-transmissions')?.addEventListener('click',()=>{save('gothtechnology.armory.hideTransmissions','true');transmission.close();announce('Transmission prompts are disabled. You can still request a film with Watch transmission.');});
  const newsletter=$<HTMLFormElement>('#newsletter-form');
  newsletter?.addEventListener('submit',async event=>{
    event.preventDefault();if(!newsletter.reportValidity()||newsletter.dataset.busy==='true')return;
    const note=$('.form-status',newsletter)!, button=$<HTMLButtonElement>('[type=submit]',newsletter)!;
    if(!config.newsletterEndpoint){note.textContent='Signup is not connected. Your email was not saved or sent.';return;}
    try {
      const endpoint=new URL(config.newsletterEndpoint,location.origin);if(endpoint.protocol!=='https:')throw new Error('Newsletter is not configured securely.');
      newsletter.dataset.busy='true';button.disabled=true;note.textContent='Sending your subscription request…';
      const form=new FormData(newsletter);
      const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:String(form.get('email')),consent:true,source:'gothtechnology',version:1}),signal:AbortSignal.timeout(12000),credentials:'omit'});
      if(!response.ok)throw new Error('Signup could not be confirmed. Please try again later.');
      note.textContent='Subscription request received. Check your inbox for any confirmation required by the mailing service.';newsletter.reset();
    } catch(error){note.textContent=error instanceof Error?error.message:'Signup is unavailable.';}
    finally{newsletter.dataset.busy='false';button.disabled=false;}
  });
  const host=$('#armory-scene');
  if(host&&config.features.enable3DHero) {
    let dispose:(()=>void)|undefined, generation=0;
    const start=async()=>{
      const request=++generation;dispose?.();dispose=undefined;host.replaceChildren();
      const nav=navigator as Navigator&{deviceMemory?:number;connection?:{saveData?:boolean}};
      // Reduced motion / save data never allocate a WebGL context or download Three.js.
      const fallback=isReduced()||nav.connection?.saveData||quality.value==='fallback';
      let webgl=false;
      if(!fallback){try{const canvas=document.createElement('canvas');const context=canvas.getContext('webgl2');webgl=!!context;context?.getExtension('WEBGL_lose_context')?.loseContext();}catch{/* Static artwork stays visible. */}}
      const level=chooseQuality({webgl,reducedMotion:isReduced(),saveData:!!nav.connection?.saveData,memory:nav.deviceMemory,cores:nav.hardwareConcurrency,mobile:matchMedia('(max-width: 760px)').matches,choice:quality.value as QualityChoice});
      const state=$('#scene-status')!;state.textContent=level==='fallback'?'Static armory':'Loading atmosphere';host.dataset.quality=level;
      const pause=$<HTMLButtonElement>('#scene-pause');if(pause)pause.hidden=level==='fallback';
      if(level==='fallback')return;
      try{const {mountScene}=await import('../three/scene');if(request!==generation)return;dispose=mountScene(host,level,update=>{state.textContent=update;});}
      catch{state.textContent='Static armory';host.replaceChildren();host.dataset.quality='fallback';}
    };
    const idle=window.requestIdleCallback??((fn:IdleRequestCallback)=>window.setTimeout(()=>fn({didTimeout:false,timeRemaining:()=>0}),600));
    idle(()=>void start(),{timeout:1500});document.addEventListener('store:preferences',()=>void start());
    window.addEventListener('pagehide',()=>{generation++;dispose?.();},{once:true});
  }
}

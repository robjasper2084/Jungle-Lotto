/** Film audio is shared across loading and entrance players after an explicit choice. */
const key='digital-static-film-sound',event='digital-static-film-sound';
let transientSound=false;
export function filmSoundEnabled(){try{return localStorage.getItem(key)==='on';}catch{return transientSound;}}
export function bindFilmSound(video:HTMLVideoElement,button:HTMLButtonElement){
 const sync=()=>{const on=filmSoundEnabled();video.muted=!on;video.defaultMuted=!on;button.textContent=on?'Sound on ✓':'Sound off';button.setAttribute('aria-pressed',String(on));button.setAttribute('aria-label',on?'Mute film sound':'Turn film sound on');};
 button.onclick=()=>{const on=!filmSoundEnabled();transientSound=on;try{localStorage.setItem(key,on?'on':'off');}catch{}sync();window.dispatchEvent(new Event(event));if(on)void video.play().catch(()=>{});};window.addEventListener(event,sync);sync();return ()=>{button.onclick=null;window.removeEventListener(event,sync);};
}

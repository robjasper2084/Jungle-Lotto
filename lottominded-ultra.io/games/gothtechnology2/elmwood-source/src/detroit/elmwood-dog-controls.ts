import {DogBarkAudio} from './elmwood-dog-audio.ts';
import {parseDogCommand,type DogCommand} from './elmwood-companion.ts';
type SpeechSession={lang:string;continuous:boolean;interimResults:boolean;onresult:((event:{results:ArrayLike<ArrayLike<{transcript:string}>>;resultIndex:number})=>void)|null;onerror:((event:{error:string})=>void)|null;onend:(()=>void)|null;start():void;abort():void};
export function dogControls(parent:HTMLElement,order:(command:DogCommand,recipient:string,target:'birds'|'people')=>string,ready:()=>boolean){
  const section=document.createElement('details');section.id='dog-commands';section.innerHTML=`<summary>Dog commands</summary><label for="dog-recipient">Command recipient</label><select id="dog-recipient"><option value="p1">Player 1's dog</option><option value="p2">Player 2's dog</option><option value="both">Both dogs</option></select><div class="dog-command-buttons">${['Sit','Down','Stay','Come','Chase','Bark'].map(c=>`<button type="button" data-command="${c.toLowerCase()}">${c}</button>`).join('')}</div><label for="dog-target">Chase target</label><select id="dog-target"><option value="birds">Nearby geese / ducks on land</option><option value="people">Nearby walkers</option></select><label><input type="checkbox" id="dog-sound" checked> Bark sound on command</label><button type="button" id="dog-voice" aria-pressed="false">Enable voice commands</button><p id="dog-feedback" role="status">Down means lie down. Come resumes following. Your dog sits after you stop for a second.</p><small>Voice is optional and needs microphone permission. Your browser may use an online speech service. Buttons work without a microphone.</small>`;
  parent.querySelector('#session-dog')!.after(section);
  const recipient=section.querySelector<HTMLSelectElement>('#dog-recipient')!,target=section.querySelector<HTMLSelectElement>('#dog-target')!,voice=section.querySelector<HTMLButtonElement>('#dog-voice')!,feedback=section.querySelector<HTMLElement>('#dog-feedback')!;
  const sound=new DogBarkAudio(),soundToggle=section.querySelector<HTMLInputElement>('#dog-sound')!;soundToggle.onchange=()=>{if(!soundToggle.checked)sound.stop();};
  let speech:SpeechSession|undefined,listening=false;
  const Speech=(window as unknown as {SpeechRecognition?:new()=>SpeechSession;webkitSpeechRecognition?:new()=>SpeechSession}).SpeechRecognition??(window as unknown as {webkitSpeechRecognition?:new()=>SpeechSession}).webkitSpeechRecognition;
  if(!Speech){voice.disabled=true;voice.textContent='Voice unavailable · use command buttons';}
  function issue(command:DogCommand,kind=target.value as 'birds'|'people'){
    feedback.textContent=ready()?order(command,recipient.value,kind):'Start or resume your ride and enable a Boerboel companion first.';
    if(command==='bark'&&feedback.textContent.startsWith('Barking')&&soundToggle.checked)void sound.bark().catch(()=>{feedback.textContent+=' · tap Bark to enable sound';});
  }
  section.querySelectorAll<HTMLButtonElement>('[data-command]').forEach(button=>button.onclick=()=>issue(button.dataset.command as DogCommand));
  function stopped(){listening=false;voice.setAttribute('aria-pressed','false');if(Speech)voice.textContent='Enable voice commands';}
  function stop(){sound.stop();if(listening){speech?.abort();stopped();feedback.textContent='Voice stopped. Enable it again when you resume.';}}
  voice.onclick=()=>{
    if(listening){stop();return;}if(!ready()){feedback.textContent='Start or resume your ride before enabling voice.';return;}if(!Speech)return;
    if(soundToggle.checked)void sound.unlock().catch(()=>{});speech=new Speech();speech.lang='en-US';speech.continuous=true;speech.interimResults=false;
    speech.onresult=event=>{for(let i=event.resultIndex;i<event.results.length;i++){const parsed=parseDogCommand(event.results[i][0].transcript);if(parsed)issue(parsed.command,parsed.target??target.value as 'birds'|'people');else feedback.textContent='Say Sit, Down, Stay, Come, Chase, or Bark.';}};
    speech.onerror=event=>{stopped();feedback.textContent=event.error==='not-allowed'?'Microphone permission was not granted. Use the command buttons.':'Voice stopped ('+event.error+'). Buttons are still available.';};
    speech.onend=stopped;
    try{speech.start();listening=true;voice.textContent='Stop listening';voice.setAttribute('aria-pressed','true');feedback.textContent='Listening: Sit, Down, Stay, Come, Chase geese, Chase people, or Bark.';}catch{stopped();feedback.textContent='Voice could not start. Use the command buttons.';}
  };
  return {stop,section};
}

import './dogActions.css';
/** Optional voice input and two movable command pads, saved separately per orientation. */
export function installDogCommandHud(parent:HTMLElement,key:string,order:(command:string)=>string,ready:()=>boolean){
 const names=['sit','down','stay','come','chase','bark'];
 const label=(name:string)=>name==='down'?'Lay down':name[0].toUpperCase()+name.slice(1);
 const section=document.createElement('details');section.innerHTML='<summary>Dog voice & touch commands</summary><p>Choose each dog button action. Edit to drag the buttons, then save. Portrait and landscape save separately.</p>';
 const message=document.createElement('p');message.setAttribute('role','status');
 const tray=document.createElement('section');tray.className='dogCommandTray';tray.hidden=true;tray.setAttribute('aria-label','Live dog actions');
 const summary=document.createElement('button');summary.type='button';summary.className='dogActionToggle';summary.textContent='Dog actions · G';summary.setAttribute('aria-expanded','true');summary.setAttribute('aria-controls','dogLiveActions');
 const feedback=document.createElement('p');feedback.setAttribute('role','status');feedback.setAttribute('aria-live','polite');feedback.textContent='Use while riding · Alt + 1–6';
 const trayButtons=document.createElement('div');trayButtons.id='dogLiveActions';trayButtons.setAttribute('role','group');trayButtons.setAttribute('aria-label','Dog commands');tray.append(summary,trayButtons,feedback);document.body.append(tray);
 let collapsed=matchMedia('(max-width:1024px), (any-pointer:coarse)').matches;trayButtons.hidden=feedback.hidden=collapsed;tray.dataset.collapsed=String(collapsed);summary.setAttribute('aria-expanded',String(!collapsed));
 const toggle=()=>{collapsed=!collapsed;tray.dataset.collapsed=String(collapsed);trayButtons.hidden=feedback.hidden=collapsed;summary.setAttribute('aria-expanded',String(!collapsed));place();};
 summary.onclick=toggle;summary.onpointerdown=e=>{e.preventDefault();e.stopPropagation();};
 const pads=[0,1].map(i=>{const b=document.createElement('button');b.type='button';b.style.cssText='position:fixed;z-index:35;border-radius:50%;background:#15382ddd;color:#fff;border:1px solid #c4b779;touch-action:none;min-width:44px;min-height:44px';b.setAttribute('aria-label','Dog command '+(i+1));document.body.append(b);return b;});
 type Layout={x:number;y:number;size:number;action:string}[];let editing=false,layout:Layout=[],drag:number|undefined;
 const orientation=()=>innerWidth>innerHeight?'landscape':'portrait';
 let currentOrientation=orientation();
 const load=()=>{try{layout=JSON.parse(localStorage.getItem(key+'-'+currentOrientation)??'null')??[];}catch{layout=[];}layout=pads.map((_,i)=>{const p=layout[i];return p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&Number.isFinite(p.size)&&names.includes(p.action)?p:{x:.87,y:.38+i*.10,size:54,action:i?'come':'sit'};});};
 const selects:HTMLSelectElement[]=[],sizes:HTMLInputElement[]=[];
 function place(){pads.forEach((b,i)=>{const p=layout[i],size=Math.max(44,Math.min(100,p.size));b.textContent='Dog '+p.action;b.style.width=b.style.height=size+'px';b.style.left=Math.max(6,Math.min(innerWidth-size-6,p.x*innerWidth-size/2))+'px';b.style.top=Math.max(65,Math.min(innerHeight-size-8,p.y*innerHeight-size/2))+'px';b.hidden=!(editing||(ready()&&collapsed));if(selects[i]){selects[i].value=p.action;sizes[i].value=String(size);}});}
 const save=()=>{try{localStorage.setItem(key+'-'+currentOrientation,JSON.stringify(layout));}catch{message.textContent='Storage unavailable; layout works for this session.';}};
 const issue=(c:string)=>{const text=ready()?order(c):'Start or resume a ride with a dog first.';message.textContent=feedback.textContent=text;for(const b of trayButtons.querySelectorAll<HTMLButtonElement>('button'))b.setAttribute('aria-pressed',String(b.dataset.command===c));};
 names.forEach((name,i)=>{const b=document.createElement('button');b.type='button';b.textContent=label(name);b.setAttribute('aria-label','Dog '+label(name));b.dataset.command=name;b.title='Alt + '+(i+1);b.setAttribute('aria-pressed','false');b.onpointerdown=e=>{e.preventDefault();e.stopPropagation();};b.onclick=e=>{e.stopPropagation();issue(name);};trayButtons.append(b);});
 const keyboard=(e:KeyboardEvent)=>{if(!ready()||e.repeat||document.activeElement?.closest('input,select,textarea,[contenteditable=true]'))return;if(e.code==='KeyG'){e.preventDefault();e.stopImmediatePropagation();toggle();}else if(e.altKey&&/^Digit[1-6]$/.test(e.code)){e.preventDefault();e.stopImmediatePropagation();issue(names[Number(e.code.slice(-1))-1]);}};
 window.addEventListener('keydown',keyboard,true);
 pads.forEach((b,i)=>{const label=document.createElement('label');label.textContent='Dog button '+(i+1)+' ';const select=document.createElement('select');names.forEach(n=>select.add(new Option(n,n)));selects.push(select);select.onchange=()=>{layout[i].action=select.value;save();place();};const size=document.createElement('input');size.type='range';size.min='44';size.max='100';size.setAttribute('aria-label','Dog button '+(i+1)+' size');sizes.push(size);size.oninput=()=>{layout[i].size=Number(size.value);save();place();};label.append(select,size);section.append(label);
 b.onpointerdown=event=>{event.stopPropagation();event.preventDefault();if(editing){drag=i;b.setPointerCapture(event.pointerId);}};
 b.onpointermove=event=>{if(editing&&drag===i){layout[i].x=event.clientX/innerWidth;layout[i].y=event.clientY/innerHeight;place();}};
 b.onpointerup=b.onpointercancel=()=>{drag=undefined;};b.onclick=event=>{event.stopPropagation();if(!editing)issue(layout[i].action);};
 b.onkeydown=event=>{if(!editing)return;const delta:Record<string,[number,number]>={ArrowLeft:[-.01,0],ArrowRight:[.01,0],ArrowUp:[0,-.01],ArrowDown:[0,.01]};if(delta[event.key]){event.preventDefault();layout[i].x+=delta[event.key][0];layout[i].y+=delta[event.key][1];place();}};
 });
 const edit=document.createElement('button');edit.type='button';edit.textContent='Move dog buttons';edit.onclick=()=>{editing=!editing;edit.textContent=editing?'Save dog buttons':'Move dog buttons';if(!editing)save();place();};section.append(edit);
 const commands=document.createElement('div');for(const n of names){const b=document.createElement('button');b.type='button';b.textContent=n;b.onclick=()=>issue(n);commands.append(b);}section.append(commands);
 const voice=document.createElement('button');voice.type='button';voice.textContent='Enable dog voice';voice.setAttribute('aria-pressed','false');
 type Speech={lang:string;continuous:boolean;interimResults:boolean;onresult:(e:{resultIndex:number;results:ArrayLike<ArrayLike<{transcript:string}>>})=>void;onend:()=>void;onerror:()=>void;start:()=>void;abort:()=>void};
 const scope=window as unknown as {SpeechRecognition?:new()=>Speech;webkitSpeechRecognition?:new()=>Speech};const Speech=scope.SpeechRecognition??scope.webkitSpeechRecognition;let speech:Speech|undefined;
 const stop=()=>{const old=speech;speech=undefined;old?.abort();voice.textContent='Enable dog voice';voice.setAttribute('aria-pressed','false');};
 voice.disabled=!Speech;voice.onclick=()=>{if(speech){stop();return;}if(!ready()||!Speech){message.textContent='Start or resume the ride first.';return;}speech=new Speech();speech.lang='en-US';speech.continuous=true;speech.interimResults=false;speech.onresult=e=>{for(let i=e.resultIndex;i<e.results.length;i++){const words=e.results[i][0].transcript.toLowerCase().split(/\W+/),command=words.some(w=>['lay','lie'].includes(w))?'down':names.find(n=>words.includes(n));if(command)issue(command);}};speech.onend=()=>{speech=undefined;voice.textContent='Enable dog voice';voice.setAttribute('aria-pressed','false');};speech.onerror=()=>{message.textContent='Voice unavailable. Use dog buttons.';stop();};try{speech.start();voice.textContent='Stop dog voice';voice.setAttribute('aria-pressed','true');}catch{stop();}};
 section.append(voice,document.createTextNode(' Optional microphone permission. Your browser may use an online speech service.'),message);parent.append(section);load();place();window.addEventListener('resize',()=>{if(editing)save();currentOrientation=orientation();load();place();});document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
 const timer=window.setInterval(()=>{place();tray.hidden=!ready();if(speech&&!ready())stop();},250);
 return {dispose(){clearInterval(timer);window.removeEventListener('keydown',keyboard,true);stop();pads.forEach(b=>b.remove());tray.remove();section.remove();}};
}

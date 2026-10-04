import type {TouchRideInput} from './touchInput.ts';

/** Viewport-local pointer capture; never synthesizes another player's keys. */
export function mountSplitTouch(parent:HTMLElement,input:TouchRideInput,trick:()=>void){
 const root=document.createElement('div');root.className='splitTouch';root.setAttribute('aria-label','Movement controls');
 const stick=document.createElement('button');stick.type='button';stick.className='splitStick';stick.setAttribute('aria-label','Move: push up to ride, down to brake or reverse, sideways to turn');
 const thumb=document.createElement('span'),label=document.createElement('small');label.textContent='MOVE';stick.append(thumb,label);root.append(stick);
 const buttons=document.createElement('div');buttons.className='splitTouchActions';root.append(buttons);parent.append(root);
 const captures=new Map<number,HTMLElement>();let enabled=false;
 const draw=()=>{thumb.style.transform=`translate(${input.steer*27}px,${-input.throttle*27}px)`;};
 const capture=(node:HTMLElement,e:PointerEvent)=>{e.preventDefault();e.stopPropagation();captures.set(e.pointerId,node);node.setPointerCapture(e.pointerId);node.setAttribute('aria-pressed','true');};
 const move=(e:PointerEvent)=>{if(captures.get(e.pointerId)!==stick)return;const r=stick.getBoundingClientRect();input.moveStick(e.pointerId,(e.clientX-r.left-r.width/2)/(r.width*.36),(r.top+r.height/2-e.clientY)/(r.height*.36));draw();};
 stick.onpointerdown=e=>{if(enabled&&input.startStick(e.pointerId)){capture(stick,e);move(e);}};stick.onpointermove=move;
 const finishStick=(e:PointerEvent)=>{if(captures.get(e.pointerId)!==stick)return;captures.delete(e.pointerId);input.endStick(e.pointerId);stick.setAttribute('aria-pressed','false');if(stick.hasPointerCapture(e.pointerId))stick.releasePointerCapture(e.pointerId);draw();};
 stick.onpointerup=stick.onpointercancel=stick.onlostpointercapture=finishStick;
 for(const [action,text]of [['brake','Brake'],['jump','Hold / hop'],['crouch','Crouch']] as const){
  const b=document.createElement('button');b.type='button';b.textContent=text;b.dataset.action=action;b.setAttribute('aria-pressed','false');buttons.append(b);
  b.onpointerdown=e=>{if(enabled&&input.press(action,e.pointerId))capture(b,e);};
  const end=(e:PointerEvent)=>{if(captures.get(e.pointerId)!==b)return;captures.delete(e.pointerId);input.release(action,e.pointerId,e.type!=='pointerup');b.setAttribute('aria-pressed','false');if(b.hasPointerCapture(e.pointerId))b.releasePointerCapture(e.pointerId);};b.onpointerup=b.onpointercancel=b.onlostpointercapture=end;
 }
 const special=document.createElement('button');special.type='button';special.textContent='Trick';special.onclick=()=>{if(enabled)trick();};buttons.append(special);
 const reset=()=>{input.reset();const held=[...captures];captures.clear();for(const[id,node]of held){node.setAttribute('aria-pressed','false');if(node.hasPointerCapture(id))node.releasePointerCapture(id);}draw();};
 return {root,reset,setEnabled(value:boolean){if(enabled&&!value)reset();enabled=value;for(const b of root.querySelectorAll<HTMLButtonElement>('button'))b.disabled=!value;},dispose(){reset();root.remove();}};
}

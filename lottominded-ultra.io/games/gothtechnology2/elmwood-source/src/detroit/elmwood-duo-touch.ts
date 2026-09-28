import type {Action} from './elmwood-session-input.ts';
type Rect={x:number;y:number;width:number;height:number};
type Position={x:number;y:number;size:number;opacity:number;action:Action};
type Layout=Record<string,Position>;
const ACTIONS:Record<Action,string>={forward:'Ride',brake:'Brake',left:'Left',right:'Right',hop:'Hop',crouch:'Crouch',recover:'Recover',camera:'Camera',trick:'Trick',cruise:'Cruise'};
const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));
/** Independent pointer ownership and viewport-local saved layouts for both riders. */
export function makeDuoTouch(canvas:HTMLCanvasElement,rects:()=>Rect[],pause:()=>void){
  let saved:Record<string,Layout>={};try{saved=JSON.parse(localStorage.getItem('elmwood-duo-touch-v1')??'{}')||{};}catch{}
  let editing=false,selected={seat:0,id:'stick'},backup='',orientation='',wasPaused=false;
  const panes=[0,1].map(i=>{const pane=document.createElement('div');pane.className='duo-touch-pane';pane.dataset.seat=String(i);pane.hidden=true;pane.setAttribute('aria-label','Player '+(i+1)+' touch controls');document.body.append(pane);return pane;});
  const editor=document.createElement('section');editor.id='duo-editor';editor.hidden=true;editor.setAttribute('aria-label','Arrange split-screen controls');
  editor.innerHTML='<details open><summary>Arrange controls · collapse to drag</summary><p>Drag a control in either view. Each player keeps a separate layout.</p><div class="fields"><label>Player<select id="duo-edit-seat"><option value="0">Player 1</option><option value="1">Player 2</option></select></label><label>Control<select id="duo-edit-control"></select></label><label>Action<select id="duo-edit-action"></select></label><label>Size<input id="duo-edit-size" type="range" min="44" max="140" step="2"></label><label>Opacity<input id="duo-edit-opacity" type="range" min="35" max="100" step="5"></label></div></details><div class="row"><button id="duo-edit-reset">Reset</button><button id="duo-edit-cancel">Cancel</button><button id="duo-edit-save">Save layout</button></div><output id="duo-edit-message"></output>';
  document.body.append(editor);
  const el=<E extends HTMLElement>(id:string)=>document.getElementById(id) as E;
  const held=new Map<number,{seat:number;action:Action;node:HTMLElement}>(),sticks=new Map<number,{seat:number;x:number;y:number;node:HTMLElement}>(),nodes=new Map<string,HTMLButtonElement>();
  let drag:{seat:number;id:string;pointer:number;dx:number;dy:number}|undefined;
  const orient=()=>innerWidth>innerHeight?'landscape':'portrait';
  const key=(seat:number)=>seat+'-'+orient()+'-'+(rects()[1]?.y?'stacked':'side');
  function defaults(r:Rect):Layout{
    const point=(x:number,y:number,size:number,action:Action)=>({x:x/r.width,y:y/r.height,size,action,opacity:85});
    return {stick:point(Math.min(90,r.width*.22),r.height-94,108,'forward'),brake:point(r.width-142,r.height-46,48,'brake'),crouch:point(r.width-64,r.height-46,48,'crouch'),hop:point(r.width-58,r.height-110,58,'hop'),trick:point(r.width-132,r.height-118,54,'trick'),recover:point(r.width-62,r.height-183,46,'recover'),camera:point(r.width-132,r.height-185,46,'camera')};
  }
  function layout(seat:number){const r=rects()[seat]??rects()[0],d=defaults(r),k=key(seat);if(!saved[k]||typeof saved[k]!=='object')saved[k]=d;
    for(const id in d){const p=saved[k][id]??d[id];saved[k][id]={x:Number.isFinite(p.x)?clamp(p.x,0,1):d[id].x,y:Number.isFinite(p.y)?clamp(p.y,0,1):d[id].y,size:Number.isFinite(p.size)?clamp(p.size,id==='stick'?80:44,id==='stick'?140:100):d[id].size,opacity:Number.isFinite(p.opacity)?clamp(p.opacity,35,100):85,action:ACTIONS[p.action]?p.action:d[id].action};}return saved[k];}
  function bounds(seat:number,id:string){const r=rects()[seat]??rects()[0],p=layout(seat)[id],margin=p.size/2+8;return{x:clamp(p.x*r.width,margin,r.width-margin),y:clamp(p.y*r.height,margin+10,r.height-margin)};}
  const send=(detail:object)=>canvas.dispatchEvent(new CustomEvent('elmwood-player-input',{detail}));
  function release(pointer:number){const h=held.get(pointer);if(h){send({seat:h.seat,action:h.action,down:false,source:'pointer-'+pointer});h.node.setAttribute('aria-pressed','false');held.delete(pointer);}const stick=sticks.get(pointer);if(stick){send({seat:stick.seat,x:0,y:0});stick.node.querySelector('span')!.style.transform='';sticks.delete(pointer);}if(drag?.pointer===pointer)drag=undefined;}
  function clear(){for(const p of [...held.keys(),...sticks.keys()])release(p);drag=undefined;}
  function apply(){for(let seat=0;seat<2;seat++)for(const [id,p]of Object.entries(layout(seat))){const node=nodes.get(seat+'-'+id);if(!node)continue;const b=bounds(seat,id);if(![...sticks.values()].some(s=>s.node===node)){node.style.left=b.x+'px';node.style.top=b.y+'px';}node.style.width=node.style.height=p.size+'px';node.style.opacity=editing?'1':String(p.opacity/100);node.classList.toggle('selected',editing&&selected.seat===seat&&selected.id===id);node.setAttribute('aria-label','Player '+(seat+1)+' '+(editing?'move '+id:id==='stick'?'joystick':ACTIONS[p.action]));if(id!=='stick')node.textContent=ACTIONS[p.action];}}
  function select(seat:number,id:string){selected={seat,id};const p=layout(seat)[id];el<HTMLSelectElement>('duo-edit-seat').value=String(seat);el<HTMLSelectElement>('duo-edit-control').value=id;el<HTMLSelectElement>('duo-edit-action').value=p.action;el<HTMLSelectElement>('duo-edit-action').disabled=id==='stick';el<HTMLInputElement>('duo-edit-size').min=id==='stick'?'80':'44';el<HTMLInputElement>('duo-edit-size').max=id==='stick'?'140':'100';el<HTMLInputElement>('duo-edit-size').value=String(p.size);el<HTMLInputElement>('duo-edit-opacity').value=String(p.opacity);apply();}
  function move(e:PointerEvent){
    if(drag?.pointer===e.pointerId){const r=rects()[drag.seat],p=layout(drag.seat)[drag.id];p.x=(e.clientX-r.x-drag.dx)/r.width;p.y=(e.clientY-r.y-drag.dy)/r.height;const b=bounds(drag.seat,drag.id);p.x=b.x/r.width;p.y=b.y/r.height;apply();return;}
    const s=sticks.get(e.pointerId);if(!s)return;const radius=layout(s.seat).stick.size*.32,dx=e.clientX-s.x,dy=e.clientY-s.y,scale=Math.max(1,Math.hypot(dx,dy)/radius),x=dx/scale,y=dy/scale;s.node.querySelector('span')!.style.transform=`translate(${x}px,${y}px)`;send({seat:s.seat,x:x/radius,y:-y/radius});
  }
  function beginStick(seat:number,e:PointerEvent,target:HTMLElement){
    if([...sticks.values()].some(s=>s.seat===seat)||canvas.dataset.paused==='true')return;
    const r=rects()[seat],node=nodes.get(seat+'-stick')!,floating=el<HTMLSelectElement>('elmwood-stick-mode')?.value!=='fixed',b=bounds(seat,'stick');
    const x=floating?clamp(e.clientX-r.x,58,r.width-58):b.x,y=floating?clamp(e.clientY-r.y,58,r.height-58):b.y;
    node.style.left=x+'px';node.style.top=y+'px';sticks.set(e.pointerId,{seat,x:x+r.x,y:y+r.y,node});target.setPointerCapture(e.pointerId);canvas.focus();move(e);
  }
  for(let seat=0;seat<2;seat++){
    const zone=document.createElement('div');zone.className='duo-stick-zone';panes[seat].append(zone);zone.onpointerdown=e=>{e.preventDefault();beginStick(seat,e,zone);};zone.onpointermove=move;zone.onpointerup=zone.onpointercancel=zone.onlostpointercapture=e=>release(e.pointerId);
    for(const id of Object.keys(defaults(rects()[seat]??rects()[0]))){
      const node=document.createElement('button');node.type='button';node.dataset.control=id;node.setAttribute('aria-pressed','false');if(id==='stick'){node.className='duo-stick';node.innerHTML='<span></span><small>P'+(seat+1)+' MOVE</small>';}nodes.set(seat+'-'+id,node);panes[seat].append(node);
      if(!seat)el<HTMLSelectElement>('duo-edit-control').add(new Option(id==='stick'?'Joystick':id,id));
      node.onpointerdown=e=>{e.preventDefault();e.stopPropagation();node.setPointerCapture(e.pointerId);
        if(editing){select(seat,id);const r=rects()[seat],b=bounds(seat,id);drag={seat,id,pointer:e.pointerId,dx:e.clientX-r.x-b.x,dy:e.clientY-r.y-b.y};return;}
        if(canvas.dataset.paused==='true')return;if(id==='stick'){beginStick(seat,e,node);return;}
        const action=layout(seat)[id].action;held.set(e.pointerId,{seat,action,node});node.setAttribute('aria-pressed','true');send({seat,action,down:true,source:'pointer-'+e.pointerId});canvas.focus();
      };
      node.onpointermove=move;node.onpointerup=node.onpointercancel=node.onlostpointercapture=e=>release(e.pointerId);
      node.onkeydown=e=>{if(!editing||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.code))return;e.preventDefault();e.stopPropagation();select(seat,id);const p=layout(seat)[id],r=rects()[seat],step=e.shiftKey?20:5;p.x+=(e.code==='ArrowRight'?step:e.code==='ArrowLeft'?-step:0)/r.width;p.y+=(e.code==='ArrowDown'?step:e.code==='ArrowUp'?-step:0)/r.height;apply();};
      node.onclick=e=>{if(editing){select(seat,id);return;}if(e.detail===0&&id!=='stick'&&canvas.dataset.paused!=='true'){const action=layout(seat)[id].action;send({seat,action,down:true,source:'accessible'});setTimeout(()=>send({seat,action,down:false,source:'accessible'}),100);}};
    }
  }
  for(const [v,l]of Object.entries(ACTIONS))el<HTMLSelectElement>('duo-edit-action').add(new Option(l,v));
  function close(save:boolean){clear();if(save){try{localStorage.setItem('elmwood-duo-touch-v1',JSON.stringify(saved));}catch{el('session-message').textContent='Storage unavailable. This layout works for the current visit.';}}else saved=JSON.parse(backup);editing=false;editor.hidden=true;document.body.classList.remove('duo-editing');update();el('session-touch-edit').focus();}
  el<HTMLSelectElement>('duo-edit-seat').onchange=e=>select(Number((e.target as HTMLSelectElement).value),selected.id);el<HTMLSelectElement>('duo-edit-control').onchange=e=>select(selected.seat,(e.target as HTMLSelectElement).value);
  el<HTMLSelectElement>('duo-edit-action').onchange=e=>{layout(selected.seat)[selected.id].action=(e.target as HTMLSelectElement).value as Action;apply();};
  for(const [id,prop]of [['duo-edit-size','size'],['duo-edit-opacity','opacity']] as const)el<HTMLInputElement>(id).oninput=e=>{layout(selected.seat)[selected.id][prop]=Number((e.target as HTMLInputElement).value);apply();};
  el<HTMLButtonElement>('duo-edit-save').onclick=()=>close(true);el<HTMLButtonElement>('duo-edit-cancel').onclick=()=>close(false);el<HTMLButtonElement>('duo-edit-reset').onclick=()=>{saved[key(selected.seat)]=defaults(rects()[selected.seat]);select(selected.seat,selected.id);};
  function update(){
    const duo=canvas.dataset.players==='2',active=canvas.dataset.riding==='true',paused=canvas.dataset.paused==='true',mode=el<HTMLSelectElement>('elmwood-touch-mode')?.value??'auto';
    if(orientation!==orient()||paused&&!wasPaused||!active){clear();orientation=orient();}wasPaused=paused;
    const rs=rects();for(let seat=0;seat<2;seat++){
      const force=el<HTMLSelectElement>('session-input-'+seat)?.value==='touch',show=editing||duo&&active&&(force||mode==='on'||mode==='auto'&&(navigator.maxTouchPoints>0||matchMedia('(any-pointer:coarse)').matches||innerWidth<750));
      panes[seat].hidden=!show;const r=rs[seat]??rs[0];Object.assign(panes[seat].style,{left:r.x+'px',top:r.y+'px',width:r.width+'px',height:r.height+'px'});
      const zone=panes[seat].querySelector<HTMLElement>('.duo-stick-zone')!;zone.style.display=!editing&&el<HTMLSelectElement>('elmwood-stick-mode')?.value!=='fixed'?'block':'none';
    }apply();
  }
  canvas.addEventListener('elmwood-clear-input',clear);addEventListener('blur',clear);addEventListener('resize',()=>{clear();update();});addEventListener('keydown',e=>{if(editing&&e.code==='Escape'){e.preventDefault();e.stopImmediatePropagation();close(false);}},{capture:true});
  return {update,edit(){pause();clear();backup=JSON.stringify(saved);editing=true;editor.hidden=false;document.body.classList.remove('controls-open');document.getElementById('elmwood-menu')?.setAttribute('aria-expanded','false');document.body.classList.add('duo-editing');select(0,'stick');update();el('duo-edit-save').focus();}};
}

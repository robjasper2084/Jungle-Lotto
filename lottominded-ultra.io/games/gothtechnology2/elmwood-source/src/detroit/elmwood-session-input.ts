import {NEUTRAL_ACTIONS,type RideActions} from '@digital-static/ridecore';

export type Binding='wasd'|'arrows'|'ijkl'|'numpad'|'touch'|`pad:${number}`;
export type Action='forward'|'brake'|'left'|'right'|'crouch'|'hop'|'recover'|'camera'|'trick'|'cruise';
export type Pad={index:number;id:string;connected:boolean;axes:readonly number[];buttons:readonly {pressed:boolean;value:number}[]};
export const KEYSETS:Record<'wasd'|'arrows'|'ijkl'|'numpad',Record<string,Action>>={
  wasd:{KeyW:'forward',KeyS:'brake',KeyA:'left',KeyD:'right',Space:'hop',ShiftLeft:'crouch',KeyR:'recover',KeyC:'camera',KeyT:'trick',KeyV:'cruise'},
  arrows:{ArrowUp:'forward',ArrowDown:'brake',ArrowLeft:'left',ArrowRight:'right',Enter:'hop',ShiftRight:'crouch',Backspace:'recover',Slash:'camera',Period:'trick',Quote:'cruise'},
  ijkl:{KeyI:'forward',KeyK:'brake',KeyJ:'left',KeyL:'right',KeyU:'hop',KeyO:'crouch',KeyY:'recover',KeyB:'camera',KeyH:'trick',KeyF:'cruise'},
  numpad:{Numpad8:'forward',Numpad5:'brake',Numpad4:'left',Numpad6:'right',Numpad0:'hop',Numpad1:'crouch',Numpad7:'recover',Numpad9:'camera',Numpad3:'trick',NumpadDecimal:'cruise'},
};
const edgeActions=new Set<Action>(['hop','recover','camera','trick','cruise']);
const dead=(n:number)=>Number.isFinite(n)&&Math.abs(n)>.15?Math.sign(n)*(Math.min(1,Math.abs(n))-.15)/.85:0;
export function setupError(bindings:Binding[],pads:readonly (Pad|null)[]){
  const assigned=bindings.filter(b=>b!=='touch');
  if(new Set(assigned).size!==assigned.length)return 'Give each player a different keyboard set or controller.';
  for(const b of assigned)if(b.startsWith('pad:')&&!pads.some(p=>p?.connected&&p.index===Number(b.slice(4))))return 'Connect the selected gamepad and press a button, then start again.';
  return '';
}
class SeatInput {
  sources=new Map<string,Set<Action>>();edges=new Set<Action>();x=0;y=0;lookX=0;lookY=0;cruise=false;padReady=false;padId='';padDown=new Set<Action>();
  clear(){this.sources.clear();this.edges.clear();this.x=this.y=this.lookX=this.lookY=0;this.cruise=false;this.padReady=false;this.padDown.clear();}
  set(source:string,action:Action,down:boolean){
    const before=this.held(action),set=this.sources.get(source)??new Set<Action>();
    down?set.add(action):set.delete(action);this.sources.set(source,set);
    if(down&&!before&&edgeActions.has(action))this.edges.add(action);
  }
  held(action:Action){return [...this.sources.values()].some(s=>s.has(action));}
}
/** Device events stay outside the fixed-step simulation. Edge actions are consumed once. */
export class ElmwoodSessionInput {
  seats=Array.from({length:4},()=>new SeatInput());bindings:Binding[]=['wasd','arrows'];count=1;
  configure(bindings:Binding[]){this.clear();this.bindings=bindings;this.count=bindings.length;for(const s of this.seats)s.padId='';}
  clear(seat?:number){if(seat===undefined)this.seats.forEach(s=>s.clear());else this.seats[seat].clear();}
  key(code:string,down:boolean,repeat=false){let handled=false;for(let i=0;i<this.count;i++){
    const b=this.bindings[i];let action=b==='wasd'||b==='arrows'||b==='ijkl'||b==='numpad'?KEYSETS[b][code]:undefined;
    // Preserve the original single-player arrow-key fallback.
    if(this.count===1&&b==='wasd')action??=KEYSETS.arrows[code];
    if(action){if(!down||!repeat)this.seats[i].set('keyboard',action,down);handled=true;}
  }return handled;}
  touch(seat:number,action:Action,down:boolean,source='touch'){if(seat<this.count)this.seats[seat].set(source,action,down);}
  stick(seat:number,x:number,y:number){if(seat>=this.count)return;this.seats[seat].x=dead(x);this.seats[seat].y=dead(y);}
  poll(pads:readonly (Pad|null)[]){
    for(let i=0;i<this.count;i++){
      const binding=this.bindings[i];if(!binding.startsWith('pad:'))continue;
      const s=this.seats[i],p=pads.find(p=>p?.index===Number(binding.slice(4))&&p.connected);
      if(!p||(s.padId&&s.padId!==p.id)){this.clear();return `Player ${i+1} controller disconnected. Reconnect and resume, or choose another input.`;}
      s.padId=p.id;
      const value=(n:number)=>p.buttons[n]?.value??0,pressed=(n:number)=>!!p.buttons[n]?.pressed;
      const x=dead(p.axes[0]??0),y=dead(-(p.axes[1]??0)),trigger=value(7)-value(6);
      const down=new Set<Action>();for(const [n,a]of [[0,'hop'],[1,'crouch'],[2,'trick'],[3,'camera'],[4,'recover'],[5,'cruise']] as const)if(pressed(n))down.add(a);
      if(!s.padReady){if(!x&&!y&&Math.abs(trigger)<.05&&!down.size&&!pressed(9))s.padReady=true;continue;}
      if(pressed(9)){this.clear();return 'Paused by controller. Release controls, then resume.';}
      s.x=x;s.y=Math.abs(trigger)>.05?trigger:y;s.lookX=dead(p.axes[2]??0);s.lookY=dead(p.axes[3]??0);
      for(const a of new Set([...s.padDown,...down]))s.set('gamepad',a,down.has(a));s.padDown=down;
    }return '';
  }
  consume(i:number,speed:number,trick:number):{actions:RideActions;recover:boolean;camera:boolean}{
    const s=this.seats[i],held=(a:Action)=>s.held(a),edge=(a:Action)=>s.edges.has(a);
    let throttle=held('brake')?-1:held('forward')?1:s.y;
    if(edge('cruise'))s.cruise=!s.cruise;
    if(throttle<-.05||edge('recover'))s.cruise=false;
    if(s.cruise&&Math.abs(throttle)<.05)throttle=Math.max(-.3,Math.min(.65,(5.5-speed)*.24));
    // Recovery cannot carry the old frame's throttle, hop or trick into the new pose.
    const result={actions:edge('recover')?{...NEUTRAL_ACTIONS}:{...NEUTRAL_ACTIONS,throttle,steer:Math.max(-1,Math.min(1,s.x+Number(held('right'))-Number(held('left')))),crouch:held('crouch'),hop:edge('hop'),hopHeld:held('hop'),trick:edge('trick')?trick:0},recover:edge('recover'),camera:edge('camera')};
    s.edges.clear();return result;
  }
}

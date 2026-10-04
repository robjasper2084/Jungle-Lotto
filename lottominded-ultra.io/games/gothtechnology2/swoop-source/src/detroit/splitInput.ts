import {GamepadRideInput,emptyPad,type PadLike} from './gamepadInput.ts';
import {NEUTRAL_ACTIONS,type RideActions} from './controller.ts';
import {NeutralRearm,RIDE_RULES} from './rideRules.ts';
export type SplitBinding='wasd'|'arrows'|'ijkl'|'numpad'|`pad:${number}`;
export const SPLIT_KEYS=[{up:'KeyW',down:'KeyS',left:'KeyA',right:'KeyD',hop:'Space',crouch:'ShiftLeft',recover:'KeyR',camera:'KeyC',trick:'KeyT',sit:'KeyX',cruise:'KeyV'},
 {up:'ArrowUp',down:'ArrowDown',left:'ArrowLeft',right:'ArrowRight',hop:'Enter',crouch:'ShiftRight',recover:'Backspace',camera:'Slash',trick:'Period',sit:'Comma',cruise:'Quote'},
 {up:'KeyI',down:'KeyK',left:'KeyJ',right:'KeyL',hop:'KeyU',crouch:'KeyO',recover:'KeyY',camera:'KeyB',trick:'KeyH',sit:'KeyM',cruise:'KeyF'},
 {up:'Numpad8',down:'Numpad5',left:'Numpad4',right:'Numpad6',hop:'Numpad0',crouch:'Numpad1',recover:'Numpad7',camera:'Numpad9',trick:'Numpad3',sit:'Numpad2',cruise:'NumpadDecimal'}];
export function splitBindingLabel(binding:SplitBinding){return binding==='wasd'?'WASD · Space hop · R recover · C camera':binding==='arrows'?'Arrows · Enter hop · Backspace recover · / camera':binding==='ijkl'?'IJKL · U hop · Y recover · B camera':binding==='numpad'?'Numpad 8456 · 0 hop · 7 recover · 9 camera':`Controller ${Number(binding.slice(4))+1} · A hop · X recover · Y camera`;}
export function splitSetupError(bindings:readonly SplitBinding[],pads:readonly (PadLike|null)[]){
 if(new Set(bindings).size!==bindings.length)return 'Choose a different control set for each player.';
 for(const binding of bindings)if(binding.startsWith('pad:')&&!pads.some(p=>p?.connected&&p.mapping==='standard'&&p.index===Number(binding.slice(4))))return `${splitBindingLabel(binding).split(' · ')[0]} is not connected. Press a button on it, or choose a keyboard layout.`;
 return '';
}
export class SplitRideInput {
 readonly bindings:readonly SplitBinding[];
 private keys=new Set<string>();private gates:NeutralRearm[];
 private readers:GamepadRideInput[];private pads:ReturnType<typeof emptyPad>[];
 private ready:boolean[];private pending:ReturnType<SplitRideInput['empty']>[];private identities:string[];private seated:boolean[];
 readonly cruising:boolean[];private speeds:readonly number[]=[];
 constructor(bindings:readonly SplitBinding[]){if(bindings.length<2||bindings.length>4)throw Error('Split play supports 2–4 players.');this.bindings=bindings;this.gates=bindings.map(()=>new NeutralRearm());this.readers=bindings.map(()=>new GamepadRideInput());this.pads=bindings.map(()=>emptyPad());this.ready=bindings.map(()=>false);this.pending=bindings.map(()=>this.empty());this.identities=bindings.map(()=>'');this.seated=bindings.map(()=>false);this.cruising=bindings.map(()=>false);this.clear();}
 private empty(){return{hop:false,recover:false,camera:false,trick:false,sit:false,cruise:false};}
 private layout(i:number){return SPLIT_KEYS[this.bindings[i]==='arrows'?1:this.bindings[i]==='ijkl'?2:this.bindings[i]==='numpad'?3:0];}
 ownsKey(code:string){return this.bindings.some((b,i)=>!b.startsWith('pad:')&&Object.values(this.layout(i)).includes(code));}
 handleKey(code:string,down:boolean){
  const was=this.keys.has(code);let owned=false;
  this.bindings.forEach((binding,i)=>{if(binding.startsWith('pad:'))return;const k=this.layout(i);if(!Object.values(k).includes(code))return;owned=true;
   if(!down&&was&&code===k.hop)this.pending[i].hop=true;
   if(down&&!was)for(const event of ['recover','camera','trick','sit','cruise'] as const)if(code===k[event])this.pending[i][event]=true;
  });
  if(owned){if(down)this.keys.add(code);else this.keys.delete(code);}return owned;
 }
 clear(index?:number){
  for(const i of index===undefined?this.bindings.map((_,i)=>i):[index]){if(!this.bindings[i].startsWith('pad:'))for(const key of Object.values(this.layout(i)))this.keys.delete(key);this.pending[i]=this.empty();this.gates[i].interrupt();this.ready[i]=false;this.cruising[i]=false;}
 }
 poll(pads:readonly (PadLike|null)[],speeds:readonly number[],dt:number){
  let pause=false,disconnected=false;this.speeds=speeds;
  this.bindings.forEach((binding,i)=>{
   const assigned=binding.startsWith('pad:')?pads.find(p=>p?.index===Number(binding.slice(4))&&p.connected):undefined;
   const id=assigned?assigned.index+':'+assigned.id:'';
   if(binding.startsWith('pad:')&&(!id||this.identities[i]&&id!==this.identities[i]))disconnected=true;
   if(!this.identities[i]&&id)this.identities[i]=id;
   const p=this.pads[i]=this.readers[i].sample(assigned?[assigned]:[],speeds[i]);pause ||= p.pause;
   const k=this.layout(i),active=binding.startsWith('pad:')?Math.abs(p.throttle)+Math.abs(p.steer)>.05||p.hopHeld||p.crouch:Object.values(k).some(c=>this.keys.has(c));
   this.ready[i]=this.gates[i].sample(dt,active);
   if(this.ready[i])for(const event of ['hop','recover','camera','trick','sit'] as const)this.pending[i][event] ||= p[event];
   else this.pending[i]=this.empty();
  });
  return {pause,disconnected};
 }
 events(i:number){const p=this.pending[i],out={recover:p.recover,camera:p.camera,cruise:p.cruise};p.recover=p.camera=p.cruise=false;if(p.sit){this.seated[i]=!this.seated[i];p.sit=false;}return out;}
 toggleCruise(i:number){this.cruising[i]=!this.cruising[i];}
 consume(i:number):RideActions{
  if(!this.ready[i])return {...NEUTRAL_ACTIONS};
  const binding=this.bindings[i],p=this.pads[i],k=this.layout(i),held=(code:string)=>this.keys.has(code);
  const out={...NEUTRAL_ACTIONS,throttle:binding.startsWith('pad:')?p.throttle:Number(held(k.up))-Number(held(k.down)),steer:binding.startsWith('pad:')?p.steer:Number(held(k.right))-Number(held(k.left)),crouch:binding.startsWith('pad:')?p.crouch:held(k.crouch),hopHeld:binding.startsWith('pad:')?p.hopHeld:held(k.hop),hop:this.pending[i].hop,trick:this.pending[i].trick?1:0,seated:this.seated[i]};
  if(out.throttle<0)this.cruising[i]=false;
  if(this.cruising[i]&&Math.abs(out.throttle)<.01)out.throttle=Math.max(-.3,Math.min(.5,(RIDE_RULES.cruiseSpeed-this.speeds[i])*.45));
  this.pending[i].hop=this.pending[i].trick=false;return out;
 }
}

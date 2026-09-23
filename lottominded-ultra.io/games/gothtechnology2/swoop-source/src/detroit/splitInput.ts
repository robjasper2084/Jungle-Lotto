import {GamepadRideInput,emptyPad,type PadLike} from './gamepadInput.ts';
import {NEUTRAL_ACTIONS,type RideActions} from './controller.ts';
import {NeutralRearm,RIDE_RULES} from './rideRules.ts';
export type SplitBinding='wasd'|'arrows'|`pad:${number}`;
export const SPLIT_KEYS=[{up:'KeyW',down:'KeyS',left:'KeyA',right:'KeyD',hop:'Space',crouch:'ShiftLeft',recover:'KeyR',camera:'KeyC',trick:'KeyT',sit:'KeyX',cruise:'KeyV'},
 {up:'ArrowUp',down:'ArrowDown',left:'ArrowLeft',right:'ArrowRight',hop:'Enter',crouch:'ShiftRight',recover:'Backspace',camera:'Slash',trick:'Period',sit:'Comma',cruise:'Quote'}];
export function splitBindingLabel(binding:SplitBinding){return binding==='wasd'?'WASD · Space hop · R recover · C camera':binding==='arrows'?'Arrows · Enter hop · Backspace recover · / camera':`Controller ${Number(binding.slice(4))+1} · A hop · X recover · Y camera`;}
export function splitSetupError(bindings:readonly SplitBinding[],pads:readonly (PadLike|null)[]){
 if(bindings[0]===bindings[1])return 'Choose a different control set for each player.';
 for(const binding of bindings)if(binding.startsWith('pad:')&&!pads.some(p=>p?.connected&&p.mapping==='standard'&&p.index===Number(binding.slice(4))))return `${splitBindingLabel(binding).split(' · ')[0]} is not connected. Press a button on it, or choose a keyboard layout.`;
 return '';
}
export class SplitRideInput {
 readonly bindings:readonly [SplitBinding,SplitBinding];
 private keys=new Set<string>();private gates=[new NeutralRearm(),new NeutralRearm()];
 private readers=[new GamepadRideInput(),new GamepadRideInput()];private pads=[emptyPad(),emptyPad()];
 private ready=[false,false];private pending=[this.empty(),this.empty()];private identities=['',''];private seated=[false,false];
 readonly cruising=[false,false];private speeds:readonly number[]=[0,0];
 constructor(bindings:readonly [SplitBinding,SplitBinding]){this.bindings=bindings;this.clear();}
 private empty(){return{hop:false,recover:false,camera:false,trick:false,sit:false,cruise:false};}
 private layout(i:number){return SPLIT_KEYS[this.bindings[i]==='arrows'?1:0];}
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
  for(const i of index===undefined?[0,1]:[index]){if(!this.bindings[i].startsWith('pad:'))for(const key of Object.values(this.layout(i)))this.keys.delete(key);this.pending[i]=this.empty();this.gates[i].interrupt();this.ready[i]=false;this.cruising[i]=false;}
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

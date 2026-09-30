import * as T from 'three';
import {NEUTRAL_ACTIONS,type RideActions} from '@digital-static/ridecore';
export type VRPacket={actions:RideActions;recover:boolean;pause:boolean};
type XRPad={handedness:string;gamepad?:{axes:readonly number[];buttons:readonly {pressed:boolean;value:number}[]}|null};
const dead=(n=0)=>Math.abs(n)>.18?Math.sign(n)*Math.min(1,(Math.min(1,Math.abs(n))-.18)/.82):0;
export class ElmwoodVRInput {
  private down=new Set<string>();private ready=false;
  reset(){this.down.clear();this.ready=false;}
  read(sources:readonly XRPad[]):VRPacket{
    const left=sources.find(s=>s.handedness==='left')?.gamepad,right=sources.find(s=>s.handedness==='right')?.gamepad;
    const axis=(pad:XRPad['gamepad'],n:number)=>dead(pad?.axes[(pad.axes.length>=4?2:0)+n]??0);
    const held=(pad:XRPad['gamepad'],n:number)=>!!pad?.buttons[n]?.pressed;
    const keys=new Set<string>();if(held(right,4))keys.add('hop');if(held(right,5))keys.add('recover');if(held(left,4))keys.add('pause');
    const brake=left?.buttons[1]?.value??0,throttle=-axis(left,1),steer=axis(left,0);
    if(!this.ready){if(!throttle&&!steer&&brake<.1&&!keys.size)this.ready=true;this.down=keys;return {actions:{...NEUTRAL_ACTIONS},recover:false,pause:false};}
    const edge=(key:string)=>keys.has(key)&&!this.down.has(key);
    const packet={actions:{...NEUTRAL_ACTIONS,throttle:brake>.1?-brake:throttle,steer,hop:edge('hop'),hopHeld:keys.has('hop'),crouch:held(right,1)},recover:edge('recover'),pause:edge('pause')};
    this.down=keys;return packet;
  }
}
type VRRide={startVR():Promise<void>;endVR():void;pauseVR():void;vrInput(packet:VRPacket):void;vrPose():{x:number;y:number;z:number;headingY:number}|undefined};
export function makeElmwoodVR(scene:T.Scene,camera:T.PerspectiveCamera,renderer:T.WebGLRenderer,canvas:HTMLCanvasElement,ride:VRRide){
  const rig=new T.Group();rig.name='Elmwood headset tracking origin';scene.add(rig);
  const input=new ElmwoodVRInput(),buttons:HTMLButtonElement[]=[];let session:XRSession|undefined,starting=false;
  canvas.addEventListener('elmwood-clear-input',e=>{const seat=(e as CustomEvent<{seat?:number}>).detail?.seat;if(seat===undefined||seat===0)input.reset();});
  renderer.xr.enabled=true;renderer.xr.setReferenceSpaceType('local-floor');
  const help=document.createElement('p');help.id='elmwood-vr-status';help.setAttribute('role','status');
  help.textContent='Headset: left stick ride/steer, left grip brake, right A hop, right grip crouch, right B recover, left X pause. Use the headset system menu to exit.';
  (document.getElementById('session-help')??document.querySelector('aside'))?.append(help);
  for(const host of [document.getElementById('elmwood-controls')??document.querySelector('header'),document.querySelector('#elmwood-main-menu .menu-actions')]){
    if(!host)continue;const button=document.createElement('button');button.type='button';button.textContent='Checking VR…';button.disabled=true;button.style.minHeight='44px';button.setAttribute('aria-describedby',help.id);host.append(button);buttons.push(button);
  }
  function label(text:string,disabled=false){for(const b of buttons){b.textContent=text;b.disabled=disabled;}}
  function cleanup(){session=undefined;input.reset();camera.removeFromParent();scene.add(camera);rig.position.set(0,0,0);rig.quaternion.identity();ride.endVR();delete canvas.dataset.vr;document.body.classList.remove('elmwood-vr-active');label('Enter VR');}
  async function start(){
    if(session){await session.end();return;}if(starting)return;starting=true;label('Starting VR…',true);
    try{
      // Request on the button gesture before async loading, preserving browser consent.
      const next=await navigator.xr!.requestSession('immersive-vr',{requiredFeatures:['local-floor']});session=next;
      next.addEventListener('end',cleanup,{once:true});
      await ride.startVR();if(session!==next)return;
      rig.add(camera);camera.position.set(0,0,0);camera.quaternion.identity();input.reset();
      await renderer.xr.setSession(next);renderer.xr.setFoveation(1);
      canvas.dataset.vr='immersive';document.body.classList.add('elmwood-vr-active');label('Exit VR');
      next.addEventListener('visibilitychange',()=>{if(next.visibilityState!=='visible'){input.reset();ride.pauseVR();}});
    }catch(error){if(session)await session.end().catch(()=>{});cleanup();help.textContent='VR could not start: '+(error instanceof Error?error.message:String(error));}
    finally{starting=false;}
  }
  buttons.forEach(b=>b.onclick=()=>void start());
  if(!isSecureContext){label('VR requires HTTPS',true);}
  else if(!navigator.xr){label('VR headset unavailable',true);}
  else void navigator.xr.isSessionSupported('immersive-vr').then(ok=>label(ok?'Enter VR':'VR headset not detected',!ok)).catch(()=>label('VR unavailable in this browser',true));
  return {
    beforeFrame(){if(session&&renderer.xr.isPresenting)ride.vrInput(input.read(Array.from(session.inputSources)));},
    afterFrame(){if(!renderer.xr.isPresenting)return;const p=ride.vrPose();if(!p)return;rig.position.set(p.x,p.y+.25,p.z);rig.rotation.set(0,p.headingY+Math.PI,0);rig.updateMatrixWorld(true);},
  };
}

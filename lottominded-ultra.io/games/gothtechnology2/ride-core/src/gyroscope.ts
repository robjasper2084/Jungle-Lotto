import {Euler,Quaternion,Vector3,MathUtils,PerspectiveCamera} from 'three';
export type GyroMode='off'|'sights'|'always';
export type GyroSettings={mode:GyroMode;sensitivity:number;invertX:boolean;invertY:boolean};
const settingsKey='digital-static-gyroscope-v1',rad=Math.PI/180;
export function readGyroSettings(value:unknown):GyroSettings{
 const s=value as Partial<GyroSettings>|null;
 return{mode:s?.mode==='always'||s?.mode==='sights'?s.mode:'off',sensitivity:MathUtils.clamp(Number(s?.sensitivity)||1,.2,3),invertX:s?.invertX===true,invertY:s?.invertY===true};
}
/** Device orientation is Z-X'-Y''; compensate for portrait/landscape screen axes. */
export function orientationFrame(alpha:number,beta:number,gamma:number,screenAngle:number){
 return new Quaternion().setFromEuler(new Euler(beta*rad,alpha*rad,-gamma*rad,'YXZ'))
  .multiply(new Quaternion().setFromAxisAngle(new Vector3(1,0,0),-Math.PI/2))
  .multiply(new Quaternion().setFromAxisAngle(new Vector3(0,0,1),-screenAngle*rad)).normalize();
}
export function orientationDelta(reference:Quaternion,current:Quaternion){
 const forward=new Vector3(0,0,-1).applyQuaternion(reference.clone().invert().multiply(current));
 return{yaw:Math.atan2(-forward.x,-forward.z),pitch:Math.asin(MathUtils.clamp(forward.y,-1,1))};
}
export class GyroFilter {
 private latest?:Quaternion;private reference?:Quaternion;private yaw=0;private pitch=0;private active=false;
 receive(orientation:Quaternion){this.latest=orientation.clone();}
 calibrate(){this.reference=this.latest?.clone();this.yaw=this.pitch=0;this.active=false;}
 consume(dt:number,active:boolean,sensitivity=1,invertX=false,invertY=false){
  if(!this.latest||!active){this.calibrate();return{yaw:0,pitch:0};}
  if(!this.reference||!this.active){this.reference=this.latest.clone();this.yaw=this.pitch=0;this.active=true;return{yaw:0,pitch:0};}
  const target=orientationDelta(this.reference,this.latest),ease=1-Math.exp(-22*MathUtils.clamp(dt,0,.1));
  const dy=Math.atan2(Math.sin(target.yaw-this.yaw),Math.cos(target.yaw-this.yaw))*ease,dp=(target.pitch-this.pitch)*ease;
  this.yaw+=dy;this.pitch+=dp;
  // Ignore isolated sensor spikes; touching/turning still uses the existing input.
  return{yaw:MathUtils.clamp(dy,-.16,.16)*sensitivity*(invertX?-1:1),pitch:MathUtils.clamp(dp,-.12,.12)*sensitivity*(invertY?-1:1)};
 }
}
export class GyroscopeControl {
 settings:GyroSettings=readGyroSettings(null);readonly filter=new GyroFilter();
 listening=false;status='Off';private lastReading=0;private screenAngle=0;private viewYaw=0;private viewPitch=0;private revision=0;private root?:HTMLElement;
 constructor(){try{this.settings=readGyroSettings(JSON.parse(localStorage.getItem(settingsKey)??'null'));}catch{}
  window.addEventListener('blur',this.reset);document.addEventListener('visibilitychange',this.reset);
  window.addEventListener('orientationchange',this.reset);screen.orientation?.addEventListener('change',this.reset);
 }
 private reset=()=>{this.filter.calibrate();this.viewYaw=this.viewPitch=0;};
 private orientation=()=> (screen.orientation?.angle??Number((window as unknown as {orientation?:number}).orientation))||0;
 private receive=(event:DeviceOrientationEvent)=>{
  if(event.beta===null||event.gamma===null||![event.alpha??0,event.beta,event.gamma].every(Number.isFinite))return;
  const angle=this.orientation();if(angle!==this.screenAngle){this.reset();this.screenAngle=angle;}
  this.filter.receive(orientationFrame(event.alpha??0,event.beta,event.gamma,angle));this.lastReading=performance.now();if(this.status!=='Ready · tilt to look'){this.status='Ready · tilt to look';this.refresh();}
 };
 async enable(){
  const revision=++this.revision;
  const sensor=(window as unknown as {DeviceOrientationEvent?:{requestPermission?:()=>Promise<string>}}).DeviceOrientationEvent;
  if(!window.isSecureContext){this.status='Motion controls need HTTPS. Touch controls remain available.';this.refresh();return false;}
  if(!sensor){this.status='No motion sensor available in this browser. Use touch controls.';this.refresh();return false;}
  try{
   if(sensor.requestPermission&&await sensor.requestPermission()!=='granted'){this.status='Motion permission declined. Use touch controls.';this.refresh();return false;}
   if(revision!==this.revision||this.settings.mode==='off')return false;
   window.removeEventListener('deviceorientation',this.receive);window.addEventListener('deviceorientation',this.receive,{passive:true});
   this.listening=true;this.status='Waiting for the device motion sensor…';this.lastReading=0;this.reset();this.refresh();return true;
  }catch{this.status='Motion permission unavailable. Tap Enable sensors to retry.';this.refresh();return false;}
 }
 disable(){this.revision++;window.removeEventListener('deviceorientation',this.receive);this.listening=false;this.status='Off';this.reset();this.refresh();}
 private save(){try{localStorage.setItem(settingsKey,JSON.stringify(this.settings));}catch{}}
 consume(dt:number,playing:boolean,sights:boolean){
  const active=playing&&!document.hidden&&this.listening&&this.settings.mode!=='off'&&(this.settings.mode==='always'||sights)&&performance.now()-this.lastReading<800;
  return this.filter.consume(dt,active,this.settings.sensitivity,this.settings.invertX,this.settings.invertY);
 }
 applyCamera(camera:PerspectiveCamera,dt:number,playing:boolean,first:boolean){
  if(!playing||!this.listening||this.settings.mode==='off'||this.settings.mode==='sights'&&!first){this.viewYaw=this.viewPitch=0;this.consume(dt,false,first);return;}
  const delta=this.consume(dt,playing,first);this.viewYaw=MathUtils.clamp(this.viewYaw+delta.yaw,-1.7,1.7);this.viewPitch=MathUtils.clamp(this.viewPitch+delta.pitch,-.7,.7);
  camera.rotateY(-this.viewYaw);camera.rotateX(this.viewPitch);
 }
 mount(parent:HTMLElement,combat=false){
  const group=document.createElement('fieldset'),legend=document.createElement('legend');legend.textContent='Gyroscope';group.append(legend);this.root=group;
  const label=document.createElement('label');label.textContent='Motion control ';const mode=document.createElement('select');
  for(const [value,text]of [['off','Off'],['sights',combat?'Sights / first person only':'First person only'],['always','Always · tilt to look']])mode.add(new Option(text,value));
  mode.value=this.settings.mode;label.append(mode);group.append(label);
  const sensitivity=document.createElement('input');sensitivity.type='range';sensitivity.min='.2';sensitivity.max='3';sensitivity.step='.1';sensitivity.value=String(this.settings.sensitivity);sensitivity.setAttribute('aria-label','Gyroscope sensitivity');
  const speed=document.createElement('label');speed.append(document.createTextNode('Sensitivity '),sensitivity);group.append(speed);sensitivity.oninput=()=>{this.settings.sensitivity=Number(sensitivity.value);this.save();};
  for(const axis of ['X','Y'] as const){const label=document.createElement('label'),checkbox=document.createElement('input'),key=axis==='X'?'invertX':'invertY';checkbox.type='checkbox';checkbox.checked=this.settings[key];checkbox.style.width='auto';label.append(checkbox,document.createTextNode(axis==='X'?' Invert horizontal tilt':' Invert vertical tilt'));group.append(label);checkbox.onchange=()=>{this.settings[key]=checkbox.checked;this.save();this.reset();};}
  const enable=document.createElement('button');enable.type='button';enable.dataset.gyroEnable='true';enable.onclick=()=>void this.enable();
  const calibrate=document.createElement('button');calibrate.type='button';calibrate.textContent='Calibrate · hold device comfortably';calibrate.onclick=()=>{this.reset();this.status=this.lastReading?'Calibrated · tilt to look':'Waiting for a sensor reading…';this.refresh();};
  const note=document.createElement('p');note.dataset.gyroStatus='true';note.setAttribute('role','status');
  const copy=document.createElement('p');copy.textContent='Tilt to adjust the view and fine aim. Your movement stick stays separate. On iPad, enable sensors and allow Motion & Orientation access. Settings are shared across the three games.';copy.style.fontSize='12px';
  group.append(enable,calibrate,note,copy);parent.append(group);
  mode.onchange=()=>{this.settings.mode=mode.value as GyroMode;this.save();this.reset();if(this.settings.mode==='off')this.disable();else void this.enable();};this.refresh();return group;
 }
 private refresh(){if(!this.root)return;const note=this.root.querySelector<HTMLElement>('[data-gyro-status]'),button=this.root.querySelector<HTMLButtonElement>('[data-gyro-enable]');if(note)note.textContent=this.status;if(button){button.textContent=this.listening?'Sensors enabled':'Enable sensors';button.disabled=this.settings.mode==='off'||this.listening;}}
 dispose(){this.disable();window.removeEventListener('blur',this.reset);document.removeEventListener('visibilitychange',this.reset);window.removeEventListener('orientationchange',this.reset);screen.orientation?.removeEventListener('change',this.reset);this.root?.remove();}
}


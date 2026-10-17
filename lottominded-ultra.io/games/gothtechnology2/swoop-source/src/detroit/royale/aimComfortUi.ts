import {AIM_PRESETS,readAimSettings,type AimSettings} from './aimComfort.ts';
import './aimComfort.css';
export class AimComfortUi {
 value=readAimSettings(null);
 constructor(parent:HTMLElement){try{this.value=readAimSettings(JSON.parse(localStorage.getItem('royale-aim-comfort-v1')??'null'));}catch{}
  const box=document.createElement('fieldset');box.id='aim-comfort';const legend=document.createElement('legend');legend.textContent='Aim & shoot · comfort';box.append(legend);
  const preset=document.createElement('select');preset.setAttribute('aria-label','Aim speed preset');for(const p of Object.keys(AIM_PRESETS))preset.add(new Option(p[0].toUpperCase()+p.slice(1),p));preset.value=this.value.preset;
  const intro=document.createElement('p');intro.textContent='Steady makes fine aiming easier. These settings work with your existing camera and scope sensitivity.';box.append(intro,preset);
  const sliders=new Map<string,HTMLInputElement>();const refresh=()=>{for(const [key,input]of sliders){input.value=String(this.value[key as keyof AimSettings]);input.dispatchEvent(new Event('input'));}};
  for(const [key,title,min,max,step]of [['x','Horizontal aim',.25,2,.05],['y','Vertical aim',.25,2,.05],['deadzone','Controller dead zone',.02,.35,.01],['assist','Touch / controller aim slowdown',0,.6,.05],['reticleSize','Crosshair size',10,30,1]] as const){const label=document.createElement('label'),input=document.createElement('input'),out=document.createElement('output');label.textContent=title;input.type='range';input.min=String(min);input.max=String(max);input.step=String(step);input.value=String(this.value[key]);input.setAttribute('aria-label',title);input.oninput=()=>{this.value[key]=Number(input.value);out.value=key==='reticleSize'?input.value+' px':Math.round(Number(input.value)*100)+'%';this.save();};input.oninput(new Event('input'));sliders.set(key,input);label.append(input,out);box.append(label);}
  preset.onchange=()=>{this.value.preset=preset.value;Object.assign(this.value,AIM_PRESETS[preset.value as keyof typeof AIM_PRESETS]);refresh();this.save();};
  for(const [key,title]of [['autoReload','Reload automatically when empty'],['simple','Simple touch controls'],['contrast','Brighter opponents'],['outline','Crosshair outline']] as const){const label=document.createElement('label'),input=document.createElement('input');label.className='check';input.type='checkbox';input.checked=this.value[key];input.onchange=()=>{this.value[key]=input.checked;this.save();};label.append(input,title);box.append(label);}
  const label=document.createElement('label'),color=document.createElement('input');label.textContent='Crosshair color';color.type='color';color.value=this.value.reticleColor;color.oninput=()=>{this.value.reticleColor=color.value;this.save();};label.append(color);box.append(label);
  const note=document.createElement('p');note.textContent='Aim slowdown works only near visible opponents, with touch or a controller. It never snaps to a target, aims through walls, or changes damage.';box.append(note);parent.append(box);
 }
 private save(){try{localStorage.setItem('royale-aim-comfort-v1',JSON.stringify(this.value));}catch{}}
}

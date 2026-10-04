import {EBIKES,EUC_MODELS} from './electricVehicles.ts';
import './ridePicker.css';
import {makeHelmetSkinPicker} from './helmetSkin.ts';
type Family='wheel'|'pedal'|'electric';
const family=(id:string):Family=>id==='bicycle'?'pedal':id.startsWith('ebike:')?'electric':'wheel';
const descriptions:Record<string,string>={city:'Easy turns · light wheel',tour:'Smooth suspension · comfortable cruising',trail:'Quick take-off · bumpy trails',speed:'Big wheel · wide, steady turns',talaria:'Light bike · quick turns',ultra:'Strong pull · smooth suspension',sr:'Quick take-off · sporty steering',varg:'Most power · wide, steady turns'};
export function makeRidePicker(select:HTMLSelectElement){
 const root=document.createElement('section');root.className='ride-picker';root.setAttribute('aria-label','Choose your wheels');
 root.innerHTML='<h3>Choose your wheels</h3><p>Tap a kind of ride, then pick your favorite.</p><div class="ride-families" role="group" aria-label="Kinds of ride"></div><div class="ride-models" role="group" aria-label="Ride models"></div><p class="ride-pick-status" role="status"></p>';
 const families=root.querySelector<HTMLElement>('.ride-families')!,models=root.querySelector<HTMLElement>('.ride-models')!,status=root.querySelector<HTMLElement>('.ride-pick-status')!;
 const choices=[{id:'euc',family:'wheel',name:'Classic wheel',feel:'The original ride · tricks and exploring',speed:undefined},...EUC_MODELS.map(p=>({id:'euc:'+p.id,family:'wheel',name:p.name.split(' · ')[0],feel:descriptions[p.id],speed:p.topKph})),{id:'bicycle',family:'pedal',name:'Pedal bike',feel:'Pedal forward · coast · brake',speed:undefined},...EBIKES.map(p=>({id:'ebike:'+p.id,family:'electric',name:p.name.replace(' (2025)','').replace(' MX 1.2 Alpha','').replace('Sting Pro MX5','MX5'),feel:descriptions[p.id],speed:p.topKph}))];
 let shown=family(select.value);
 const familyButtons=new Map<Family,HTMLButtonElement>();
 const modelButtons=new Map<string,HTMLButtonElement>();
 for(const [id,title,symbol] of [['wheel','One wheel','◉'],['pedal','Pedal bike','◉—◉'],['electric','Electric bike','⚡']] as const){const b=document.createElement('button');b.type='button';b.innerHTML=`<span aria-hidden="true">${symbol}</span><strong>${title}</strong>`;b.onclick=()=>{shown=id;render();};families.append(b);familyButtons.set(id,b);}
 for(const choice of choices){if(![...select.options].some(o=>o.value===choice.id))continue;const b=document.createElement('button');b.type='button';b.dataset.family=choice.family;const title=document.createElement('strong'),detail=document.createElement('small'),speed=document.createElement('span');title.textContent=choice.name;detail.textContent=choice.feel;speed.className='ride-speed';speed.textContent=choice.speed===undefined?'Explore & race':Math.round(choice.speed)+' km/h · '+Math.round(choice.speed/1.609344)+' mph';b.append(title,detail,speed);b.onclick=()=>{select.value=choice.id;select.dispatchEvent(new Event('change'));update();};models.append(b);modelButtons.set(choice.id,b);}
 function render(){for(const [id,b]of familyButtons)b.setAttribute('aria-pressed',String(id===shown));for(const [id,b]of modelButtons){b.hidden=b.dataset.family!==shown;b.setAttribute('aria-pressed',String(id===select.value));}const c=choices.find(c=>c.id===select.value);status.textContent='Selected: '+(c?.name??'Classic wheel')+'. '+(family(select.value)==='electric'?'Motor power · exploring and solo races.':'');}
 function update(){shown=family(select.value);render();}
 select.addEventListener('change',update);root.append(makeHelmetSkinPicker());update();return {root,update};
}

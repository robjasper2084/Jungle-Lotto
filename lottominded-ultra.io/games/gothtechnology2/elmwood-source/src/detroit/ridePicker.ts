import {EUC_MODELS} from './electricVehicles.ts';
import './ridePicker.css';
import {makeHelmetSkinPicker} from './helmetSkin.ts';
const descriptions:Record<string,string>={city:'Easy turns · light wheel',tour:'Smooth suspension · comfortable cruising',trail:'Quick take-off · bumpy trails',speed:'Big wheel · wide, steady turns'};
export function makeRidePicker(select:HTMLSelectElement){
 const root=document.createElement('section');root.className='ride-picker';root.setAttribute('aria-label','Choose your wheel');
 root.innerHTML='<h3>Choose your wheel</h3><p>One wheel. Pick the feel you like.</p><div class="ride-models" role="group" aria-label="Electric unicycles"></div><p class="ride-pick-status" role="status"></p>';
 const models=root.querySelector<HTMLElement>('.ride-models')!,status=root.querySelector<HTMLElement>('.ride-pick-status')!;
 const choices=[{id:'euc',name:'Classic wheel',feel:'The original ride · tricks and exploring',speed:undefined},...EUC_MODELS.map(p=>({id:'euc:'+p.id,name:p.name.split(' · ')[0],feel:descriptions[p.id],speed:p.topKph}))];
 const modelButtons=new Map<string,HTMLButtonElement>();
 for(const choice of choices){const b=document.createElement('button');b.type='button';const title=document.createElement('strong'),detail=document.createElement('small'),speed=document.createElement('span');title.textContent=choice.name;detail.textContent=choice.feel;speed.className='ride-speed';speed.textContent=choice.speed===undefined?'Explore & race':Math.round(choice.speed)+' km/h · '+Math.round(choice.speed/1.609344)+' mph';b.append(title,detail,speed);b.onclick=()=>{select.value=choice.id;select.dispatchEvent(new Event('change'));};models.append(b);modelButtons.set(choice.id,b);}
 function update(){for(const [id,b]of modelButtons)b.setAttribute('aria-pressed',String(id===select.value));status.textContent='Selected: '+(choices.find(c=>c.id===select.value)?.name??'Classic wheel');}
 select.addEventListener('change',update);root.append(makeHelmetSkinPicker());update();return {root,update};
}

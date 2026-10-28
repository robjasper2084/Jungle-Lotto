import {WARDROBE_CHOICES} from '../../../ride-core/src/riderWardrobe.ts';
import './wardrobePicker.css';

/** The quick choices use the existing rider control, including its save/spawn handlers. */
export function makeWardrobePicker(source:HTMLSelectElement){
 const root=document.createElement('section');root.className='wardrobe-picker';root.setAttribute('aria-label','Suit and helmet');
 const title=document.createElement('p');title.className='wardrobe-title';title.textContent='Suit & helmet';
 const choices=document.createElement('div');choices.className='wardrobe-choices';
 const status=document.createElement('p');status.className='wardrobe-status';status.setAttribute('role','status');
 const buttons=WARDROBE_CHOICES.map(choice=>{
  const button=document.createElement('button');button.type='button';button.className='wardrobe-choice';button.dataset.suit=choice.id;
  const [name,detail]=choice.label.split(' · '),label=document.createElement('strong'),subtitle=document.createElement('small');
  label.textContent=name;subtitle.textContent=detail;button.append(label,subtitle);
  button.onclick=()=>{source.value=choice.id;source.dispatchEvent(new Event('change',{bubbles:true}));update();};
  choices.append(button);return button;
 });
 function update(){
  for(const button of buttons){button.setAttribute('aria-pressed',String(button.dataset.suit===source.value));button.disabled=source.disabled||![...source.options].some(option=>option.value===button.dataset.suit&&!option.disabled);}
  const text='Selected: '+(source.selectedOptions[0]?.textContent??'Choose a rider');if(status.textContent!==text)status.textContent=text;
 }
 source.addEventListener('change',update);new MutationObserver(update).observe(source,{attributes:true,attributeFilter:['disabled'],childList:true});
 root.append(title,choices,status);update();return {root,update};
}

type Storage={getItem(key:string):string|null;setItem(key:string,value:string):void};
/** A device preference, excluded from room/physics messages. */
export class OnlineViewPreference {
 private value=false;private fields:HTMLSelectElement[]=[];
 constructor(private storage?:Storage){try{this.value=storage?.getItem('swoop-online-split-view')==='on';}catch{}}
 get split(){return this.value;}
 setSplit(value:boolean){this.value=value;try{this.storage?.setItem('swoop-online-split-view',value?'on':'off');}catch{}for(const s of this.fields)s.value=value?'split':'mine';}
 mount(parent:HTMLElement,onChange:()=>void){const field=document.createElement('fieldset');field.className='graphicsSettings touchSettings';const legend=document.createElement('legend');legend.textContent='Online view · this device';const label=document.createElement('label');label.textContent='Camera layout';const select=document.createElement('select');select.setAttribute('aria-label','Online camera layout');select.add(new Option('My rider · faster','mine'));select.add(new Option('Split screen · show all riders','split'));select.value=this.value?'split':'mine';select.onchange=()=>{this.setSplit(select.value==='split');onChange();};this.fields.push(select);label.append(select);const help=document.createElement('p');help.textContent='Each human controls their own rider from their own device. Split screen shows the other riders as extra views.';field.append(legend,label,help);parent.append(field);}
}

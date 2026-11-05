/** A large contextual recovery action; one button per independently controlled seat. */
export function recoveryHud(recover:(seat:number)=>void,focus:()=>void){
 const root=document.createElement('section');root.className='ride-recovery';root.hidden=true;
 root.setAttribute('aria-label','Get back up');root.setAttribute('aria-live','polite');
 const label=document.createElement('strong');label.textContent='You fell. Ready to ride again?';
 const actions=document.createElement('div'),buttons=[0,1].map(seat=>{const b=document.createElement('button');b.type='button';b.textContent='Get back up';b.onclick=()=>{recover(seat);focus();};actions.append(b);return b;});
 root.append(label,actions);document.body.append(root);
 return {update(fallen:readonly boolean[],visible:boolean){root.hidden=!visible||!fallen.some(Boolean);buttons.forEach((b,i)=>{b.hidden=!fallen[i];b.textContent=fallen.length>1?'Get player '+(i+1)+' back up':'Get back up · R';});}};
}

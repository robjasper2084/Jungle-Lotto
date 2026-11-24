import type {FixtureCommand,FixtureAPI} from './gps-frame.ts';

if(!import.meta.env.DEV)throw new Error('The GPS fixture is development-only.');
const frame=document.querySelector<HTMLIFrameElement>('#fixture')!;
const viewport=document.querySelector<HTMLSelectElement>('#viewport')!;
const reduced=document.querySelector<HTMLInputElement>('#reduced')!;
const report=document.querySelector<HTMLOutputElement>('#qa-report')!;
const sizes:Record<string,[number,number]>={desktop:[1280,800],'ipad-portrait':[820,1180],'ipad-landscape':[1180,820],phone:[390,844],short:[844,390]};
const api=()=>((frame.contentWindow as (Window&{gpsUiFixture?:FixtureAPI})|null)?.gpsUiFixture);
viewport.onchange=()=>{const [w,h]=sizes[viewport.value];frame.width=String(w);frame.height=String(h);};
reduced.checked=matchMedia('(prefers-reduced-motion: reduce)').matches;
reduced.onchange=()=>api()?.setReduced(reduced.checked);
for(const button of document.querySelectorAll<HTMLButtonElement>('[data-command]'))button.onclick=()=>{
  api()?.command(button.dataset.command as FixtureCommand);
};
document.querySelector<HTMLButtonElement>('#reset')!.onclick=()=>{frame.src='./gps-frame.html';};
frame.onload=()=>api()?.setReduced(reduced.checked);
const poll=setInterval(()=>{const current=api();if(current){current.setReduced(reduced.checked);report.textContent=current.report();}},200);
window.addEventListener('pagehide',()=>clearInterval(poll),{once:true});

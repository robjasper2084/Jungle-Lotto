import {loadingCinema} from './loadingCinema.ts';
import './style.css';
import './lobby.css';
import {BootLifecycle} from './bootLifecycle.ts';
export const boot=new BootLifecycle();
const cinema=loadingCinema();
const node=(id:string)=>document.getElementById(id)!;
document.getElementById('menu')!.style.setProperty('--lobby-art',`url("${new URL('../../public/art/swoop-rivals.webp',import.meta.url).href}")`);
node('start').before(node('loading'));
let previous='',timer:ReturnType<typeof setInterval>|undefined;
const originalFetch=window.fetch;
// Count bytes as consumers read them. Do not tee/buffer a second asset copy.
window.fetch=async (...args:Parameters<typeof fetch>)=>{
 const response=await originalFetch(...args);
 if(!response.body||!response.ok||boot.stage==='ready'||boot.stage==='error')return response;
 const body=response.body.pipeThrough(new TransformStream<Uint8Array,Uint8Array>({transform(chunk,controller){boot.progress();controller.enqueue(chunk);}}));
 const tracked=new Response(body,{status:response.status,statusText:response.statusText,headers:response.headers});
 Object.defineProperty(tracked,'url',{value:response.url});return tracked;
};
export function renderBoot(){
 document.body.dataset.boot=boot.stage;
 if(boot.stage==='ready'||boot.stage==='error')cinema.finish();else cinema.status(boot.message);
 const loading=node('loading');loading.hidden=boot.stage==='ready'||boot.stage==='error';
 const status=document.getElementById('startupStatus');if(status)status.textContent=boot.message;
 if(previous!==boot.message){loading.textContent=boot.message;node('startReason').textContent=boot.stage==='ready'?'Your ride is ready.':boot.message;previous=boot.message;}
 if(boot.stage==='error'){
  const firstError=node('bootError').hidden;
  node('bootError').hidden=false;node('bootErrorMessage').textContent=boot.message;
  node('bootErrorTitle').textContent=boot.message.startsWith('Graphics were interrupted')?'Your ride was interrupted':'Your ride hasn’t started yet';
  node('bootDiagnostics').textContent=boot.detail;node('start').setAttribute('disabled','');
  node('world').dataset.ready='false';
  for(const child of document.body.children)if(child instanceof HTMLElement&&child!==node('bootError'))child.inert=true;
  if(firstError)node('bootRetry').focus();
 }
 if(boot.stage==='ready'||boot.stage==='error'){clearInterval(timer);window.fetch=originalFetch;}
}
export function failBoot(error:unknown,graphics=false){
 const detail=error instanceof Error?`${error.name}: ${error.message}`:String(error);
 boot.fail(graphics?"Your browser couldn't start the 3D graphics needed for this ride.":'The ride could not finish loading. Please retry.',detail);renderBoot();
}
export function bootStage(stage:'checking'|'loading'|'preparing',message:string){boot.advance(stage,message);renderBoot();}
timer=setInterval(()=>{boot.tick();renderBoot();},1000);
node('bootRetry').onclick=()=>location.reload();
bootStage('checking','Checking 3D graphics…');

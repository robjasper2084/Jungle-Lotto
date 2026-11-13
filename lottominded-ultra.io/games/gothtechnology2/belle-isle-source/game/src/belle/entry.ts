// Paint the lightweight, styled opening before parsing the island's large
// simulation, mesh, WebGL, weather and UI modules. No additional GPU context.
import './style.css';
import './startup.css';

const startRuntime=()=>{
 void import('./main.ts').catch(error=>{
  console.error('Belle Isle game bundle could not load',error);
  const screen=document.getElementById('welcome'),loading=document.getElementById('loading');
  const start=document.getElementById('start') as HTMLButtonElement|null;
  if(screen)screen.dataset.state='error';
  if(loading)loading.textContent='Game download could not finish. Check your connection and retry.';
  if(start){start.disabled=false;start.onclick=()=>location.reload();}
 });
};
if(document.hidden){
 // Hidden tabs can suspend animation frames. Never strand boot behind rAF.
 setTimeout(startRuntime,0);
}else{
 // Two visible paint opportunities let the title/skeleton appear before JS work.
 requestAnimationFrame(()=>requestAnimationFrame(startRuntime));
}

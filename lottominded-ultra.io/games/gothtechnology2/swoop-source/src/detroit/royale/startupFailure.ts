export function failStartup(error:unknown){
 const root=document.getElementById('royale-startup') as HTMLDialogElement;
 root.dataset.error='true';
 const detail=error instanceof Error?error.message:String(error);
 document.getElementById('message')!.textContent=detail;
 document.getElementById('royale-startup-status')!.textContent='Arena could not load';
 document.getElementById('royale-startup-detail')!.textContent=detail||'Please retry loading.';
 document.getElementById('royale-startup-recovery')!.hidden=false;
 document.querySelector('#royale-startup-recovery p')!.textContent='Check your connection and retry. If graphics failed, try low graphics.';
 const lobby=document.getElementById('lobby') as HTMLDialogElement;
 if(lobby.open)lobby.close();
 if(!root.open)root.showModal();
 (document.getElementById('royale-startup-retry') as HTMLButtonElement).focus();
 console.error('Static Royale initialization failed',error);
}

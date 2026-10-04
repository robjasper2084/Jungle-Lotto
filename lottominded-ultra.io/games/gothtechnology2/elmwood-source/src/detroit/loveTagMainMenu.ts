/** Exit Love Tag completely before returning to the host game's main menu. */
export function installLoveTagMainMenu(client:{dialog:HTMLDialogElement;exit():Promise<void>},openMenu:()=>void){
 const button=document.createElement('button');button.type='button';button.textContent='Main menu';button.className='primary';button.dataset.loveTagMainMenu='true';button.style.cssText='min-height:44px;min-width:120px;margin:0 0 12px';
 const status=document.createElement('p');status.setAttribute('role','status');status.hidden=true;
 button.onclick=async()=>{button.disabled=true;try{await client.exit();openMenu();}catch{status.hidden=false;status.textContent='Could not leave the round. Try Main menu again.';}finally{button.disabled=false;}};
 const title=client.dialog.querySelector('h2');if(title){title.after(button,status);}else client.dialog.prepend(button,status);
 return button;
}

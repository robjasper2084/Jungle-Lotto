/** Video downloads survive a page reload; no server or account is required. */
type Film={id:string;game:string;name:string;created:number;blob:Blob};
function database():Promise<IDBDatabase>{return new Promise((resolve,reject)=>{const request=indexedDB.open('digital-static-saved-films',1);request.onupgradeneeded=()=>request.result.createObjectStore('films',{keyPath:'id'});request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}
export async function saveFilm(game:string,name:string,blob:Blob){
 const db=await database();try{await new Promise<void>((resolve,reject)=>{const tx=db.transaction('films','readwrite');tx.objectStore('films').put({id:crypto.randomUUID(),game,name,created:Date.now(),blob} satisfies Film);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}finally{db.close();}
}
export function savedFilms(game:string){
 const section=document.createElement('details'),heading=document.createElement('summary'),list=document.createElement('div'),status=document.createElement('p');heading.textContent='Saved replay downloads';list.className='film-actions';status.setAttribute('role','status');section.append(heading,status,list);
 async function refresh(){
  list.replaceChildren();status.textContent='Loading saved videos…';
  try{const db=await database();const films=await new Promise<Omit<Film,'blob'>[]>((resolve,reject)=>{const items:Omit<Film,'blob'>[]=[];const request=db.transaction('films').objectStore('films').openCursor();request.onsuccess=()=>{const cursor=request.result;if(!cursor){resolve(items);return;}const {blob,...meta}=cursor.value as Film;if(meta.game===game)items.push(meta);cursor.continue();};request.onerror=()=>reject(request.error);});db.close();
   status.textContent=films.length?'Download a video to keep it outside this browser.':'No saved videos yet. Record a ride, open Cinematic replay, then choose Download replay video.';
   for(const film of films.sort((a,b)=>b.created-a.created)){const row=document.createElement('div'),download=document.createElement('button'),remove=document.createElement('button');row.className='film-actions';download.textContent='Download · '+new Date(film.created).toLocaleString();remove.textContent='Delete';remove.setAttribute('aria-label','Delete replay from '+new Date(film.created).toLocaleString());
    download.onclick=async()=>{download.disabled=true;try{const db=await database();const value=await new Promise<Film>((resolve,reject)=>{const r=db.transaction('films').objectStore('films').get(film.id);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});db.close();if(!value)throw Error();const url=URL.createObjectURL(value.blob),a=document.createElement('a');a.href=url;a.download=film.name;a.textContent='Save video';a.className='saved-film-download';row.querySelector('.saved-film-download')?.remove();row.append(a);a.click();status.textContent='Video ready. If the download did not start, select Save video.';setTimeout(()=>{URL.revokeObjectURL(url);a.remove();},300000);}catch{status.textContent='Could not read this replay. Please try again.';}finally{download.disabled=false;}};
    remove.onclick=async()=>{try{const db=await database();await new Promise<void>((resolve,reject)=>{const tx=db.transaction('films','readwrite');tx.objectStore('films').delete(film.id);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});db.close();await refresh();}catch{status.textContent='Could not delete this replay.';}};row.append(download,remove);list.append(row);}
  }catch{status.textContent='Browser storage is unavailable. You can still download a video immediately after rendering.';}
 }
 section.addEventListener('toggle',()=>{if(section.open)void refresh();});return{section,refresh};
}

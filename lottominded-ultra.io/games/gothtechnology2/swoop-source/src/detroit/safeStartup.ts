/** A recovery link must work even when saved graphics options cannot load. */
export function isSafeStartup(search=typeof location==='undefined'?'':location.search){
 return new URLSearchParams(search).get('safe')==='1';
}
export function safeStartupUrl(href:string){const url=new URL(href);url.searchParams.set('safe','1');return url.href;}

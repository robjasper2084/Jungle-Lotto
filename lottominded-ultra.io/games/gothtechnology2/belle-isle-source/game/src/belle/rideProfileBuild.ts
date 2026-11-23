/** Read provenance once, outside the frame loop. */
type BuildSource='same-origin build marker'|'GitHub Pages release manifest';
export type RideProfileBuild={status:'pending'|'unavailable';source:BuildSource;reason?:string}|{status:'available';source:BuildSource;marker:Record<string,string|number>};
const fields=['version','repository','pullRequest','commit','baseCommit','candidate','sourceState','patchSha256','buildId','builtAt','indexSha256','profileQuery'] as const;
const sha1=/^[0-9a-f]{40}$/i,sha256=/^[0-9a-f]{64}$/i;
export function parseRideProfileBuildMarker(value:unknown):Record<string,string|number>|null {
 if(!value||typeof value!=='object'||Array.isArray(value))return null;
 const source=value as Record<string,unknown>,marker:Record<string,string|number>={};
 for(const field of fields){const entry=source[field];if(typeof entry==='string'&&entry.length<=512||typeof entry==='number'&&Number.isFinite(entry))marker[field]=entry;}
 if(typeof marker.version!=='number'||!Number.isInteger(marker.version)||marker.version<1||typeof marker.repository!=='string'||!marker.repository||typeof marker.commit!=='string'||!sha1.test(marker.commit)||typeof marker.buildId!=='string'||!marker.buildId||typeof marker.builtAt!=='string'||!Number.isFinite(Date.parse(marker.builtAt)))return null;
 // A patched candidate is identified by BOTH its base and patch, never by the
 // compatibility commit field alone. Reject incomplete candidate markers.
 if(['baseCommit','candidate','sourceState','patchSha256'].some(field=>source[field]!==undefined)){
  if(marker.sourceState!=='base-plus-verified-patch'||typeof marker.candidate!=='string'||!marker.candidate||marker.baseCommit!==marker.commit||typeof marker.patchSha256!=='string'||!sha256.test(marker.patchSha256))return null;
 }
 return marker;
}
const pagesRoot='https://robjasper2084.github.io/Jungle-Lotto/';
const gamePath='lottominded-ultra.io/games/gothtechnology2/arcade/belle-isle-explorer/';
type BuildLocation={pageUrl:string;moduleUrl:string};

function pagesBuildMarker(value:unknown,moduleUrl:string){
 if(!value||typeof value!=='object'||!moduleUrl.startsWith(pagesRoot+gamePath+'assets/'))return null;
 const manifest=value as {generatedAt?:string;commit?:string;belleGame?:{version?:number;commit?:string;entry?:string;files?:{path?:string;sha256?:string}[]}};
 const release=manifest.belleGame;
 if(!release||release.version!==1||release.commit!==manifest.commit||release.entry!==gamePath+'index.html'||!Array.isArray(release.files))return null;
 // A tab may have loaded an older build while a new Pages deployment was publishing.
 const loadedPath=moduleUrl.slice(pagesRoot.length);
 if(!release.files.some(file=>file?.path===loadedPath&&sha256.test(file.sha256??'')))return null;
 const index=release.files.find(file=>file?.path===release.entry);
 if(!index?.sha256||!sha256.test(index.sha256))return null;
 return parseRideProfileBuildMarker({version:release.version,repository:'robjasper2084/Jungle-Lotto',commit:manifest.commit,buildId:'pages-'+manifest.commit,builtAt:manifest.generatedAt,indexSha256:index.sha256});
}

export function createRideProfileBuildReader(mode:string|null,fetcher:typeof fetch=fetch,
 target:BuildLocation|undefined=typeof location==='undefined'?undefined:{pageUrl:location.href,moduleUrl:import.meta.url}):()=>RideProfileBuild {
 if(mode!=='manual')return ()=>({status:'unavailable',source:'same-origin build marker',reason:'manual comparison not selected'});
 const page=target?.pageUrl.split(/[?#]/,1)[0];
 const hosted=page===pagesRoot+gamePath||page===pagesRoot+gamePath+'index.html';
 const source:BuildSource=hosted?'GitHub Pages release manifest':'same-origin build marker';
 let current:RideProfileBuild={status:'pending',source};
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),5000);
 void (async()=>{
  try{
   const response=await fetcher(hosted?pagesRoot+'pages-artifact-manifest.json':'/__belle_test_build.json',{cache:'no-store',credentials:'same-origin',redirect:'error',signal:controller.signal});
   if(!response.ok)throw new Error('Build marker unavailable');
   const value:unknown=await response.json();
   const marker=hosted?pagesBuildMarker(value,target!.moduleUrl):parseRideProfileBuildMarker(value);
   current=marker?{status:'available',source,marker}:{status:'unavailable',source,reason:'invalid or mismatched build marker'};
  }catch{current={status:'unavailable',source,reason:'build marker could not be read'};}
  finally{clearTimeout(timeout);}
 })();
 return ()=>current;
}

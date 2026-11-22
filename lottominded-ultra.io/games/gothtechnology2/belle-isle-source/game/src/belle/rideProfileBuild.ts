/** Read the local test launcher's provenance once, outside the frame loop.
 * Ordinary hosted builds may not have a marker; never guess their identity.
 */
export type RideProfileBuild={status:'pending'|'unavailable';source:'same-origin build marker';reason?:string}|{status:'available';source:'same-origin build marker';marker:Record<string,string|number>};
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
export function createRideProfileBuildReader(fetcher:typeof fetch=fetch):()=>RideProfileBuild {
 let current:RideProfileBuild={status:'pending',source:'same-origin build marker'};
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),5000);
 void (async()=>{
  try{
   const response=await fetcher('/__belle_test_build.json',{cache:'no-store',credentials:'same-origin',redirect:'error',signal:controller.signal});
   if(!response.ok)throw new Error('Build marker unavailable');
   const marker=parseRideProfileBuildMarker(await response.json());
   current=marker?{status:'available',source:'same-origin build marker',marker}:{status:'unavailable',source:'same-origin build marker',reason:'invalid build marker'};
  }catch{current={status:'unavailable',source:'same-origin build marker',reason:'build marker could not be read'};}
  finally{clearTimeout(timeout);}
 })();
 return ()=>current;
}

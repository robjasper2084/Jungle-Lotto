/** Diagnostic elapsed queries only. No retries, sample filtering or GL finish. */
export type QueryRow={
 id:number;allocated:boolean;begun:boolean;ended:boolean;completed:boolean;resolved:boolean;deleted:boolean;
 status:string;nanoseconds:number|null;observedNanoseconds:number|string|null;disjointChecks:boolean[];error:string|null;
};
type Extension={TIME_ELAPSED_EXT:number;GPU_DISJOINT_EXT:number};
type Clock={now:()=>number;pause:()=>Promise<void>;timeoutMs:number};
const copy=<T>(value:T):T=>JSON.parse(JSON.stringify(value)) as T;
export function createElapsedQueries(gl:WebGL2RenderingContext,clock:Clock={now:()=>performance.now(),pause:()=>new Promise(resolve=>setTimeout(resolve,8)),timeoutMs:60000}){
 let ext:Extension|null=null,reason:string|null=null,disjoint=false;
 const rows:QueryRow[]=[];
 try{ext=gl.getExtension('EXT_disjoint_timer_query_webgl2') as Extension|null;if(!ext)reason='EXT_disjoint_timer_query_webgl2 unavailable';}
 catch(error){reason=String(error);}
 const checkDisjoint=(row?:QueryRow)=>{if(!ext)return false;const value=!!gl.getParameter(ext.GPU_DISJOINT_EXT);if(row)row.disjointChecks.push(value);disjoint||=value;return value;};
 async function measure<T>(render:()=>T,complete:()=>Promise<void>):Promise<{query:QueryRow;value:T}>{
  const row:QueryRow={id:rows.length,allocated:false,begun:false,ended:false,completed:false,resolved:false,deleted:false,
   status:'pending',nanoseconds:null,observedNanoseconds:null,disjointChecks:[],error:null};rows.push(row);
  let query:WebGLQuery|null=null,value:T|undefined,renderError:unknown,renderThrew=false,endError:unknown,endThrew=false;
  try{
   if(!ext)throw Error(reason??'Timer unavailable');
   if(gl.isContextLost())throw Error('Context lost before timer');
   if(checkDisjoint(row)||disjoint)throw Error('Disjoint timer context');
   if(gl.getQuery(ext.TIME_ELAPSED_EXT,gl.CURRENT_QUERY)!==null)throw Error('Another elapsed query is active');
   if(gl.getError()!==gl.NO_ERROR)throw Error('GL error before elapsed query');
   query=gl.createQuery();if(!query)throw Error('Query allocation failed');row.allocated=true;
   gl.beginQuery(ext.TIME_ELAPSED_EXT,query);row.begun=true;
   try{value=render();}catch(error){renderError=error;renderThrew=true;}
   finally{try{gl.endQuery(ext.TIME_ELAPSED_EXT);row.ended=true;}catch(error){endError=error;endThrew=true;}}
   if(renderThrew)throw renderError;
   if(endThrew)throw endError;
   if(gl.getError()!==gl.NO_ERROR)throw Error('GL error during timed render');
   if(gl.getQuery(ext.TIME_ELAPSED_EXT,gl.CURRENT_QUERY)!==null)throw Error('Elapsed query remained active');
   await complete();row.completed=true;
   const deadline=clock.now()+clock.timeoutMs;
   while(true){
    if(gl.isContextLost())throw Error('Context lost while resolving query');
    if(checkDisjoint(row)||disjoint)throw Error('Disjoint timer context');
    if(gl.getQueryParameter(query,gl.QUERY_RESULT_AVAILABLE))break;
    if(clock.now()>=deadline)throw Error('Elapsed query timed out');
    await clock.pause();
   }
   const ns=gl.getQueryParameter(query,gl.QUERY_RESULT) as number;
   row.resolved=true;row.observedNanoseconds=Number.isFinite(ns)?ns:String(ns);
   if(!Number.isSafeInteger(ns)||ns<0)throw Error('Invalid elapsed nanoseconds');
   if(checkDisjoint(row)||disjoint)throw Error('Disjoint timer context');
   if(gl.getError()!==gl.NO_ERROR)throw Error('GL error after elapsed result');
   row.nanoseconds=ns;row.status='valid';
  }catch(error){row.status=disjoint?'disjoint':reason?'unavailable':'failed';row.error=String(error);throw error;}
  finally{if(query){gl.deleteQuery(query);row.deleted=true;}}
  return{query:copy(row),value:value as T};
 }
 function read(){
  if(ext)try{checkDisjoint();}catch(error){reason=String(error);}
  const result=copy(rows);
  if(disjoint)for(const row of result){row.status='disjoint';row.nanoseconds=null;}
  return{available:ext!==null,reason,disjoint,rows:result,attempted:rows.length,
   allocated:rows.filter(r=>r.allocated).length,begun:rows.filter(r=>r.begun).length,
   ended:rows.filter(r=>r.ended).length,completed:rows.filter(r=>r.completed).length,
   resolved:rows.filter(r=>r.resolved).length,deleted:rows.filter(r=>r.deleted).length,
   liveQueries:rows.filter(r=>r.allocated&&!r.deleted).length};
 }
 return{available:ext!==null,measure,read};
}

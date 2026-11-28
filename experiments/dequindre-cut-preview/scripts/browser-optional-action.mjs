/** Only optional picture-cleanup UI uses this boundary. Required startup,
 * source, travel, movement and rendering checks still throw normally. */
export async function attemptOptionalCaptureAction(action,readEvidence){
 const began=Date.now();
 try{await action();return {completed:true,elapsedMs:Date.now()-began};}
 catch(error){
  const result={completed:false,elapsedMs:Date.now()-began,error:String(error?.stack||error)};
  if(readEvidence){
   let timer;
   try{result.obstruction=await Promise.race([readEvidence(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Optional action evidence timed out')),3000);})]);}
   catch(evidenceError){result.evidenceError=String(evidenceError);}
   finally{clearTimeout(timer);}
  }
  return result;
 }
}

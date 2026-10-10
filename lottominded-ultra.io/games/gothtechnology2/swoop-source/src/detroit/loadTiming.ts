/** Lightweight boot diagnostics; captured once, never in the riding frame loop. */
export const loadTimings: {stage:string;ms:number}[]=[];
export async function timeLoad<T>(stage:string,work:()=>Promise<T>):Promise<T>{
  const start=performance.now();
  try{return await work();}finally{loadTimings.push({stage,ms:Math.round(performance.now()-start)});}
}

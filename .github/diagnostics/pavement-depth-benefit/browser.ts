import {gl,fence,fixtureSettings,fixtureIdentity,cameraInputs,ownerInputs,setTimingMode,timingRender,prepareTimingCase} from 'pavement-benefit-fixture';
import {createElapsedQueries} from './timer.ts';
type Mode='baseline'|'candidate';
const warmup:Mode[]=['baseline','candidate','candidate','baseline'];
const balanced:Mode[]=['baseline','candidate','candidate','baseline','candidate','baseline','baseline','candidate'];
const measured:Mode[]=[...balanced,...balanced];
(window as unknown as {__pavementDepthBenefit:()=>Promise<unknown>}).__pavementDepthBenefit=async()=>{
 const identity=await fixtureIdentity(),timer=createElapsedQueries(gl),cases:Record<string,unknown>[]=[],errors:string[]=[],deadline=performance.now()+12*60*1000;
 let gpu:string=identity.gpu,settings:Record<string,unknown>=fixtureSettings(),nextQueryId=0;
 if(timer.available)try{
  for(let index=0;index<6;index++){
   const prepared=await prepareTimingCase(index);gpu=prepared.gpu;settings=fixtureSettings();
   const owners=ownerInputs(),samples:Record<string,unknown>[]=[];
   const record={...prepared,settings,owners,samples};cases.push(record);
   for(const phase of ['warmup','measured'] as const){
    const sequence=phase==='warmup'?warmup:measured;
    for(let order=0;order<sequence.length;order++){
     if(performance.now()>deadline)throw Error('Bounded diagnostic deadline reached; retain incomplete samples');
     const mode=sequence[order];setTimingMode(mode);
     const before=cameraInputs(),beforeOwners=ownerInputs(),queryId=nextQueryId++;
     let cpuMs=0,value:ReturnType<typeof timingRender>|null=null,error:string|null=null;
     try{
      const sampled=await timer.measure(()=>{
       const start=performance.now();try{value=timingRender();return value;}finally{cpuMs=performance.now()-start;}
      },fence);
      if(sampled.query.id!==queryId)throw Error('Query sequence differs from attempted sample');
     }catch(caught){error=String(caught);throw caught;}
     finally{samples.push({phase,order,mode,queryId,cpuMs,error,beforeCamera:before,afterCamera:cameraInputs(),
      beforeOwners,afterOwners:ownerInputs(),...(value??{})});}
    }
   }
  }
 }catch(error){errors.push(String(error));}
 const queries=timer.read();
 return{schema:'pavement-depth-benefit/v1',scope:'Targeted fixture GPU elapsed comparison only; no full-world activation, correctness waiver or original acceptance claim.',
  ...identity,gpu,settings,cases,queries,errors,warmupOrder:warmup,measuredOrder:measured,
  expectedCases:6,expectedWarmupSamples:24,expectedMeasuredSamples:96,performanceConclusion:null};
};

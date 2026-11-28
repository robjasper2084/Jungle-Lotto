export const PREVIEW_BASE='893f769838166e6e35624b7b979ed5cbb8414507';
export const previewState={
  ready:false,travelPending:false,error:null as string|null,stage:'Preparing the isolated preview',
  lastPose:{x:0,z:0,sourceDistrict:false},
  startedAt:typeof performance!=='undefined'?performance.now():0,
  readyAt:0,
  diagnostics:()=>({}) as Record<string,unknown>,
};

export function previewSnapshot(){
  return {
    status:'UNPUBLISHED_DRAFT',productionDeployment:false,base:PREVIEW_BASE,
    ready:previewState.ready,travelPending:previewState.travelPending,error:previewState.error,stage:previewState.stage,
    lastPose:{...previewState.lastPose},
    startupMs:previewState.readyAt?previewState.readyAt-previewState.startedAt:null,
    diagnostics:previewState.ready||previewState.error?previewState.diagnostics():{},
  };
}

declare global {
  interface Window {readonly __dequindrePreview:{snapshot:typeof previewSnapshot};}
}

/** Performance targets for actual hardware recordings. Screenshot CI under
 * SwiftShader is not a device FPS benchmark and can never certify FPS. */
export const ZONE_FRAME_BUDGET={
 desktop:{fps:60,frameP95Ms:1000/60,frameP99Ms:1000/30},
 phone:{fps:30,frameP95Ms:1000/30,frameP99Ms:1000/15},
} as const;
export type ZoneDevice='desktop'|'phone';
export type ZonePerformanceSample={device:ZoneDevice;renderer:'hardware'|'software'|'unknown';
 samples:number;p50Ms:number;p95Ms:number;p99Ms:number;drawCalls?:number;triangles?:number};
export function assessZonePerformance(sample:ZonePerformanceSample){
 const target=ZONE_FRAME_BUDGET[sample.device];
 if(![sample.samples,sample.p50Ms,sample.p95Ms,sample.p99Ms].every(Number.isFinite)||sample.samples<0||
     sample.p50Ms<0||sample.p95Ms<0||sample.p99Ms<0)
  return {status:'unverified' as const,reason:'invalid or missing sample',target};
 if(sample.renderer!=='hardware')return {status:'unverified' as const,reason:'software/unknown renderer; only visual and structural checks apply',target};
 if(sample.samples<240)return {status:'unverified' as const,reason:'fewer than 240 eligible frames',target};
 if(sample.p50Ms>sample.p95Ms||sample.p95Ms>sample.p99Ms)return {status:'unverified' as const,reason:'non-monotonic percentile data',target};
 return sample.p95Ms<=target.frameP95Ms&&sample.p99Ms<=target.frameP99Ms?
  {status:'pass' as const,reason:'p95 and p99 within device budget',target}:
  {status:'fail' as const,reason:'p95 or p99 frame time exceeds budget',target};
}

/** Explicitly local, non-shipping diagnostic reduction.
 * Never selected by screenshots, ordinary riding, hosted Pages, or release tests. */
export type ProbeLocation={hostname:string;search:string};
export const PERF_PROBE_REDUCTIONS={nearTrees:8,treeRadius:48,ground:0,groundRadius:0,farRange:75,reeds:0,branches:0} as const;
export function performanceProbeFromLocation(target:ProbeLocation|undefined):boolean{
 if(!target||!['localhost','127.0.0.1','[::1]'].includes(target.hostname))return false;
 return new URLSearchParams(target.search).get('perfProbe')==='1';
}
export function localPerformanceProbe():boolean{
 return typeof location!=='undefined'&&performanceProbeFromLocation(location);
}

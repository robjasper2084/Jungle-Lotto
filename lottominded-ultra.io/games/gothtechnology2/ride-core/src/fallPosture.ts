import curves from './fall-curves.json' with {type:'json'};
/** Blender-authored posture is retimed to each fall's predicted ground contact. */
export function fallPosture(age:number,contactTime:number){
 const t=age<=contactTime?age*.5/Math.max(.01,contactTime):.5+age-contactTime;
 const f=Math.max(0,Math.min(curves.samples.length-1,t*curves.fps)),a=Math.floor(f),b=Math.min(a+1,curves.samples.length-1);
 const channels=curves.samples[a].map((value,i)=>value+(curves.samples[b][i]-value)*(f-a));
 return {reach:channels[0],absorb:channels[1],curl:channels[2],headTuck:channels[3],stagger:channels[4]};
}

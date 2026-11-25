// Isolated diagnostic only: never merge into the release or use timing for acceptance.
import type {Object3D,Scene} from 'three';
export function installTransformAttribution(scene:Scene,groups:Record<string,Object3D[]>){
 const stride=16,limit=2048;
 const roots=Object.entries(groups).flatMap(([group,objects])=>objects.map(o=>({group,o})));
 if(new Set(roots.map(r=>r.o)).size!==roots.length||roots.some(r=>r.o.parent!==scene))throw Error('Diagnostic requires disjoint direct scene roots');
 const inventory=roots.map(({group,o})=>{let nodes=0,autoLocal=0,autoWorld=0;o.traverse(n=>{nodes++;if(n.matrixAutoUpdate)autoLocal++;if(n.matrixWorldAutoUpdate)autoWorld++;});return {group,id:o.id,name:o.name,nodes,autoLocal,autoWorld};});
 type Row={pass:number;sceneMs:number;rootsMs:number[];rootsCalls:number[]};
 const rows:Row[]=[];let active=false,started=false,finished=false,pass=0,dropped=0,nestedSceneCalls=0;let row:Row|null=null;
 const restorers:(()=>void)[]=[];
 function wrap(o:Object3D,make:(original:Object3D['updateMatrixWorld'])=>Object3D['updateMatrixWorld']){
  const original=o.updateMatrixWorld,own=Object.getOwnPropertyDescriptor(o,'updateMatrixWorld'),wrapper=make(original);
  o.updateMatrixWorld=wrapper;
  restorers.push(()=>{if(o.updateMatrixWorld!==wrapper)throw Error('Diagnostic wrapper ownership changed');if(own)Object.defineProperty(o,'updateMatrixWorld',own);else Reflect.deleteProperty(o,'updateMatrixWorld');});
 }
 roots.forEach(({o},index)=>wrap(o,original=>function(this:Object3D,force?:boolean){
  const current=row;if(!current)return original.call(this,force);
  const begin=performance.now();
  try{return original.call(this,force);}finally{current.rootsMs[index]+=performance.now()-begin;current.rootsCalls[index]++;}
 }));
 wrap(scene,original=>function(this:Object3D,force?:boolean){
  if(!active)return original.call(this,force);
  if(row){nestedSceneCalls++;return original.call(this,force);}
  pass++;if(pass%stride!==0)return original.call(this,force);
  if(rows.length===limit){dropped++;return original.call(this,force);}
  const current:Row={pass,sceneMs:0,rootsMs:new Array(roots.length).fill(0),rootsCalls:new Array(roots.length).fill(0)};
  row=current;const begin=performance.now();
  try{return original.call(this,force);}finally{current.sceneMs=performance.now()-begin;row=null;rows.push(current);}
 });
 return {
  start(){if(started||finished)throw Error('Diagnostic already used');started=true;active=true;},
  finish(){if(!started||finished||row)throw Error('Diagnostic not ready to finish');active=false;finished=true;for(const restore of restorers.reverse())restore();
   return {scope:'Every 16th scene matrix traversal during the trusted input window; inclusive browser wall durations include observer overhead, not GPU time or predicted savings. Unsampled passes execute original transforms.',stride,pass,dropped,nestedSceneCalls,inventory,rows};
  }
 };
}

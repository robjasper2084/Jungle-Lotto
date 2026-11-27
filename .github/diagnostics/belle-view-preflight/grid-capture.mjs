/** Invoke the source-pinned original constructor once; never plan or execute a route. */
import assert from 'node:assert/strict';
export const GRID_LIMIT=200_000,BATCH_LIMIT=10_000;
const finite=value=>typeof value==='number'&&Number.isFinite(value);
export function gridShape(bounds,camera){
 for(const name of ['min','max','center'])assert(Array.isArray(bounds?.[name])&&bounds[name].length===3&&bounds[name].every(finite),'Invalid original exterior bounds');
 assert(bounds.max.every((value,i)=>value>=bounds.min[i]));
 assert(finite(camera?.fov)&&camera.fov>0&&camera.fov<180&&finite(camera.aspect)&&camera.aspect>0,'Invalid original camera field of view');
 const center={x:bounds.center[0],z:bounds.center[2]},radius=Math.hypot(...bounds.max.map((n,i)=>n-bounds.min[i]))/2;
 const halfV=camera.fov*Math.PI/360,halfH=Math.atan(Math.tan(halfV)*camera.aspect);
 const viewDistance=radius/Math.sin(Math.min(halfV,halfH))*1.22,range=viewDistance+60,spacing=2,width=Math.ceil(range*2/spacing)+1,count=width*width;
 assert(finite(viewDistance)&&Number.isSafeInteger(count)&&count>0&&count<=GRID_LIMIT,'Original constructor grid exceeds 200000 points');
 return{center,radius,viewDistance,range,spacing,width,count};
}
export function assertGridPoints(points,shape,offset){
 assert(Array.isArray(points)&&points.length>0&&points.length<=BATCH_LIMIT,'Original constructor batch exceeds 10000 points');
 assert(offset+points.length<=shape.count&&offset+points.length<=GRID_LIMIT,'Original grid overflow');
 for(let j=0;j<points.length;j++){
  const i=offset+j,expected={x:shape.center.x-shape.range+i%shape.width*shape.spacing,z:shape.center.z-shape.range+Math.floor(i/shape.width)*shape.spacing};
  assert.deepEqual(points[j],expected,'Original constructor grid changed order, coordinates, spacing or coverage');
 }
}
export function assertGroundRows(points,rows){
 assert(Array.isArray(rows)&&rows.length===points.length,'Incomplete original terrain receipt');
 for(let i=0;i<rows.length;i++){
  const row=rows[i];assert(row&&row.x===points[i].x&&row.z===points[i].z,'Terrain receipt point/order changed');
  assert(typeof row.height==='number'&&typeof row.walkable==='boolean','Malformed raw ground result');
  assert([0,.7,2.25].includes(row.planningClearance),'Original planning clearance changed');
  assert.equal(row.walkable,row.planningClearance>0,'Ground walkability and original clearance disagree');
  if(!Number.isFinite(row.height))assert.equal(row.walkable,false,'Nonfinite terrain height accepted as walkable');
  const occupancy=row.obstacleOccupancy;assert(occupancy,'Missing original obstacle occupancy');
  assert.deepEqual(occupancy.bodyHeights,[.62,1.1,1.58]);assert.equal(occupancy.narrowRadius,.7);assert.equal(occupancy.wideRadius,2.25);
  for(const key of ['narrowHits','wideHits'])assert(Array.isArray(occupancy[key])&&occupancy[key].length===3&&occupancy[key].every(value=>value===null||finite(value)),'Malformed original obstacle hits');
  if(row.walkable)assert(occupancy.narrowHits.every(value=>value===null),'Original narrow occupancy was bypassed');
  if(row.planningClearance===2.25)assert(occupancy.wideHits.every(value=>value===null),'Original wide occupancy was bypassed');
 }
}
export async function collectConstructorGrid({createExteriorPlanner,bounds,camera,layout,queryGround,record,checkBudget=()=>{},receipt={}}){
 assert.equal(typeof createExteriorPlanner,'function');assert(['desktop','phone'].includes(layout));
 const shape=gridShape(bounds,camera),summary={constructorCalls:0,routeCalls:0,sweepRequests:0,viewRequests:0,totalPoints:0,batches:[],shape,receipt,complete:false};
 let active=true,inQuery=false;
 const ground=async values=>{
  checkBudget();assert(active&&!inQuery,'Repeated or concurrent constructor ground query');inQuery=true;
  const points=structuredClone(values),offset=summary.totalPoints,index=summary.batches.length;
  const raw={index,offset,points,rows:null,error:null,complete:false};
  try{
   assertGridPoints(points,shape,offset);const rows=await queryGround(values);raw.rows=structuredClone(rows);checkBudget();
   assert.deepEqual(values,points,'Ground callback mutated original query points');assertGroundRows(points,rows);
   raw.complete=true;const file=await record(raw);checkBudget();summary.batches.push({...file,index,offset,points:points.length});summary.totalPoints+=points.length;return rows;
  }catch(error){raw.error=String(error?.stack||error);if(!raw.complete)await record(raw).catch(()=>{});throw error;}
  finally{inQuery=false;}
 };
 const querySweeps=()=>{summary.sweepRequests++;throw Error('View preflight forbids route/body-sweep queries');};
 const queryViewBounds=()=>{summary.viewRequests++;throw Error('View preflight records viewObstructions once separately; constructor cannot query it');};
 try{
  checkBudget();summary.constructorCalls++;
  const planner=await createExteriorPlanner({bounds,camera,layout,queryGround:ground,querySweeps,queryViewBounds,receipt});
  checkBudget();assert.equal(summary.totalPoints,shape.count,'Constructor returned an incomplete original grid');
  assert.deepEqual(planner.center,shape.center);assert.equal(planner.viewDistance,shape.viewDistance);
  // Do not read planner.route: even its property access is unnecessary here.
  assert.equal(receipt.spacing,2);assert.equal(receipt.maximumSearchAttempts,64);assert.deepEqual(receipt.plans,[]);
  assert.deepEqual(receipt.rejectedSweeps,[]);assert.deepEqual(receipt.rejectedProspectivePaths,[]);
  assert.equal(summary.sweepRequests,0);assert.equal(summary.viewRequests,0);summary.complete=true;return summary;
 }finally{active=false;}
}

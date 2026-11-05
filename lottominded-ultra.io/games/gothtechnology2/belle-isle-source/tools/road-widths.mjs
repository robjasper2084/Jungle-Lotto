/** Gameplay clearance for the wide fan-guard envelope. These are authored allowances,
 * not a claim that mapped streets have been surveyed to these widths. */
export function comfortableRoadWidth(road){
 const source=road.sourceWidth??road.width;
 if(road.foot||road.bridge||road.highway==='corridor'||!Number.isFinite(source)||source<=0)return source;
 const cycle=road.cycleTrack?3.4:0,motor=source-cycle;
 const target=road.highway==='service'?7.2:/_link$/.test(road.highway||'')?6.8:
  Math.max(8.4,Math.min(18,(road.lanes||2)*3.6));
 return Math.round((Math.max(motor,target)+cycle)*100)/100;
}
export function applyRoadWidths(map){
 const changed=[];
 for(const road of map.roads){
  const before=road.sourceWidth??road.width,after=comfortableRoadWidth(road);
  if(after<=before+.001)continue;
  road.sourceWidth=before;road.width=after;
  road.widthEvidence='Authored cruising clearance; mapped centerline retained; source width '+before+' m';
  changed.push({id:road.id,name:road.name,highway:road.highway,before,after});
 }
 return changed;
}

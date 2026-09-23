// Shared phase for the corrected baked leg clip and the separate mechanical bicycle.
export function bindCyclist(bike,mixer,clip){
  const start=Math.min(...clip.tracks.map(t=>t.times[0]));
  return {bike,mixer,start,duration:clip.duration-start,phase:0,wheelAngle:0};
}
export function advanceCyclist(binding,distance){
  const turn=distance/.34;
  binding.wheelAngle+=turn;binding.phase=(binding.phase+turn/2.5)%(Math.PI*2);
  binding.mixer.setTime(binding.start+binding.phase/(Math.PI*2)*binding.duration);
  const crank=binding.bike.getObjectByName('Bicycle_Crank_Pivot');if(crank)crank.rotation.x=binding.phase;
  for(const name of ['Bicycle_Pedal_L_Pivot','Bicycle_Pedal_R_Pivot']){const p=binding.bike.getObjectByName(name);if(p)p.rotation.x=-binding.phase;}
  for(const name of ['Bicycle_Front_Wheel_Pivot','Bicycle_Rear_Wheel_Pivot']){const w=binding.bike.getObjectByName(name);if(w)w.rotation.x=binding.wheelAngle;}
}

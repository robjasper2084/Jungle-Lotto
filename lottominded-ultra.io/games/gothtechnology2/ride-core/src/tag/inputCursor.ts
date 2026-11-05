/** Resume from a server acknowledgement, including a refreshed/rejoined browser. */
export function resumeTagInput(ack:number,lastShotId?:number){
  if(!Number.isSafeInteger(ack)||ack<0)throw Error('Invalid input acknowledgement');
  // Older heart-rush-1 servers omit lastShotId. The shipped client could allocate
  // two shot IDs per input when a gamepad and touch fire were both active.
  return {seq:ack,shot:Number.isSafeInteger(lastShotId)&&lastShotId!>=0?lastShotId!:ack*2};
}

type PreviewReadiness={ready:boolean;travelPending:boolean;error:string|null};
type NativeTravelControls={
  start:{disabled:boolean}|null;
  welcome:{hidden:boolean;dataset:{state?:string}}|null;
  rideHud:{hidden:boolean}|null;
  destination:{disabled:boolean}|null;
};

export function canPreviewTravel(state:PreviewReadiness,native:NativeTravelControls){
  const {start,welcome,rideHud,destination}=native;
  if(!state.ready||state.travelPending||state.error||!start||!welcome||!destination||destination.disabled)return false;
  // Native error() enables Start as a reload button, not as a ready ride.
  if(welcome.dataset.state==='error')return false;
  // Native leave() keeps Start disabled after revealing the riding HUD.
  const riding=welcome.hidden&&!!rideHud&&!rideHud.hidden;
  const readyToStart=!welcome.hidden&&welcome.dataset.state==='ready'&&!start.disabled;
  return riding||readyToStart;
}

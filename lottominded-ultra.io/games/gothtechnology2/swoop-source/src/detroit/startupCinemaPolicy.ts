export function cinemaPlaybackPolicy(state:{featureOpen:boolean;hidden:boolean;reduced:boolean}):'feature'|'none'{
 return state.featureOpen&&!state.hidden&&!state.reduced?'feature':'none';
}

/** Physics stays in metres/second; rider-facing speed is miles/hour. */
export const MPH_PER_MPS=2.2369362920544;
export const speedMph=(metresPerSecond:number)=>Math.round(Math.abs(metresPerSecond)*MPH_PER_MPS);
export const mphToMps=(mph:number)=>mph/MPH_PER_MPS;
// Ducati's standard Panigale V4 R reference: 318.4 km/h, approximately 198 mph.
export const HOVER_TOP_SPEED=318.4/3.6;

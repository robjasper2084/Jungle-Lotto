/** Reduce competing WebGL work ONLY while a genuine ready island remains
 * behind the open ride chooser on a detected software renderer. No fake
 * frames, input, GPU completion, loading state, or pause during active riding. */
export function pauseSoftwareStartupScene(
 software:boolean,firstFrameReady:boolean,activeRide:boolean,pickerOpen:boolean,vrActive:boolean
):boolean{
 return software&&firstFrameReady&&!activeRide&&pickerOpen&&!vrActive;
}

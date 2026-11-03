import {CAMERA_DRAW} from './cameraDrawData.ts';
export const CAMERA_DRAW_TICKS=Math.round(CAMERA_DRAW.duration*60);
export function cameraDrawPose(ready:number){
 const rows=CAMERA_DRAW.samples,f=Math.max(0,Math.min(1,ready))*(rows.length-1),i=Math.floor(f),j=Math.min(i+1,rows.length-1);
 const v=rows[i].map((n,k)=>n+(rows[j][k]-n)*(f-i));
 return {grip:v[0],lift:v[1],swing:v[2],support:v[3],twist:v[4],settle:v[5]};
}

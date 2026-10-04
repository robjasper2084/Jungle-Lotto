const directions=['N','NE','E','SE','S','SW','W','NW'];
/** Map headings are clockwise radians from geographic north, not world +Z. */
export function compassReading(radians:number){
 const degrees=((Number.isFinite(radians)?radians:0)*180/Math.PI%360+360)%360;
 return {degrees,bearing:Math.round(degrees)%360,direction:directions[Math.round(degrees/45)%8]};
}
export function compassTicks(radians:number){
 const {degrees}=compassReading(radians),centre=Math.floor(degrees/15)*15;
 return Array.from({length:11},(_,i)=>{
  const raw=centre+(i-5)*15,angle=(raw%360+360)%360;
  return {position:50+(raw-degrees)/120*100,label:angle%45===0?directions[angle/45]:'',major:angle%45===0};
 }).filter(t=>t.position>=0&&t.position<=100);
}
/** Preserve equal x/y metres per pixel when the map is rectangular. */
export function miniMapView(p:{x:number;y:number},range:number,aspect:number){
 const w=range*aspect,h=range;
 return {x:p.x-w/2,y:p.y-h/2,w,h};
}

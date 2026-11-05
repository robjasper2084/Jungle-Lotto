/** Atwater entrance centerline from the authored OSM Detroit map (source metres).
 * Shared by the browser and authoritative server; no dependence on renderer state. */
const entrance=[[-81.87,-1222.79],[-75.96,-1223.39],[-69.88,-1224.13],[-44.88,-1225.65],[-38.55,-1227.84],[-26.93,-1230.82],[-10.49,-1233.57],[8.57,-1233.85],[23.84,-1232.32],[26.41,-1231.9],[28.42,-1231.79],[30.86,-1232.32],[32.38,-1233.02],[34.22,-1234.29],[37.22,-1236.39],[40.36,-1238.44],[42,-1239.07],[43.82,-1239.48],[47.33,-1239.88],[50.78,-1239.92],[54.61,-1239.28],[57.87,-1238.63],[61.79,-1238.16],[67.1,-1238.17],[75.81,-1238.26]];
export function dequindreEntrance(distance=12){
 let remaining=Math.max(0,distance);
 for(let i=1;i<entrance.length;i++){
  const a=entrance[i-1],b=entrance[i],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);
  if(remaining<=length||i===entrance.length-1){const t=Math.min(1,remaining/length);return{x:a[0]+dx*t,z:a[1]+dz*t,heading:Math.atan2(dx,dz)};}remaining-=length;
 }throw Error('Missing Cut entrance centerline');
}

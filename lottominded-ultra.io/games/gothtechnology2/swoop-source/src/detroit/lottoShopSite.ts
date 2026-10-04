/** Authored shop conversion of mapped OSM 379485650 beside Mack Avenue. */
export const LOTTO_SHOP={osmId:'379485650',x:2557.1175,z:-1477.135,width:13.4,depth:18.8,floor:3.048,heading:-Math.PI/2-Math.atan2(1.71,18.51)} as const;
const a=Math.sin(Math.atan2(1.71,18.51)),b=Math.cos(Math.atan2(1.71,18.51));
export function lottoMap(u:number,v:number){return{x:LOTTO_SHOP.x+a*u+b*v,z:LOTTO_SHOP.z+b*u-a*v};}
export function lottoCoordinates(x:number,z:number){const dx=x-LOTTO_SHOP.x,dz=z-LOTTO_SHOP.z;return{u:a*dx+b*dz,v:b*dx-a*dz};}
/** The second street entrance uses the west aisle beside the service counter. */
export const LOTTO_STREET_ENTRY={u:-4.35,v:-9.35,width:2.6,height:3.04} as const;
export const LOTTO_WALLS=[
 ...[-6.7,6.7].map(u=>({u,v:0,width:.18,height:9.9,depth:18.8,y:4.95})),
 // Spliced rear wall and lintel leave the actual portal open, including physics.
 {u:-6.175,v:-9.35,width:1.05,height:3.9,depth:.18,y:1.95},
 {u:1.825,v:-9.35,width:9.75,height:3.9,depth:.18,y:1.95},
 {u:LOTTO_STREET_ENTRY.u,v:-9.35,width:2.6,height:.86,depth:.18,y:3.47},
 ...[-4.05,4.05].map(u=>({u,v:9.45,width:5.2,height:3.1,depth:.10,y:1.55})),
 {u:0,v:0,width:13.4,height:6,depth:18.8,y:7},
];
export function lottoToolsAvailable(u:number,v:number){return Math.abs(u)<=6.8&&v>=-15&&v<=13.5&&(v>=-9.35||Math.abs(u-LOTTO_STREET_ENTRY.u)<=1.7);}
/** Keep the retail slab and step-free front apron above the bank mesh. */
export function lottoGrade(x:number,z:number,terrain:number){const p=lottoCoordinates(x,z),distance=Math.max(Math.abs(p.u)-8.2,-16.5-p.v,p.v-16.5,0),t=Math.max(0,1-distance/7);return terrain+(LOTTO_SHOP.floor-terrain)*t*t*(3-2*t);}
export const LOTTO_APP_URL='https://robjasper2084.github.io/Jungle-Lotto/lotto%20mind%20refined/';
export const LOTTO_OFFICIAL_URL='https://www.michiganlottery.com/games';
export function practiceNumbers(random:()=>number=Math.random){const values=Array.from({length:47},(_,i)=>i+1);for(let i=0;i<6;i++){const j=i+Math.min(46-i,Math.max(0,Math.floor(random()*(47-i))));[values[i],values[j]]=[values[j],values[i]];}return values.slice(0,6).sort((a,b)=>a-b);}
export function validPracticePick(values:number[]){return values.length===6&&new Set(values).size===6&&values.every(n=>Number.isInteger(n)&&n>=1&&n<=47);}
export const LOTTO_FIXTURES=[{u:1.9,v:-6.4,width:8.1,depth:1.45,height:1.18},...[-4.5].flatMap(u=>[3.5,.6,-2.3].map(v=>({u,v,width:.88,depth:.70,height:1.86}))),{u:4.5,v:3.3,width:.88,depth:.70,height:1.86},... [1.5,3.7].map(u=>({u,v:.2,width:1.35,depth:.75,height:.97})),{u:4.1,v:8.2,width:3.9,depth:1.1,height:.5}];

import {locationAt} from './detroit-locations.js';
export const WIDTH = 2880;
export const STRIDE = 520;
export const HEIGHT = 3700;
export const floorY = i => 440 + i * STRIDE;
export const DEPTHS = [
  {name:'CITY STREET',short:'Street',color:'#75c8bd',note:'Find the subway access ladder →',lore:'A maintenance hatch beneath an empty city. The last train left years ago. Something below still keeps time.'},
  {name:'SUBWAY',short:'Subway',color:'#85cbd1',note:'← Recover seal 03. Watch the train signals.',lore:'The platforms are silent until the signals turn red. Get above the tracks when the ghost train comes.'},
  {name:'ABANDONED STATION',short:'Station',color:'#e3b475',note:'Cross the broken concourse →',lore:'The station was sealed overnight. Its floor remembers every footstep. Keep moving across the cracked tiles.'},
  {name:'MAINTENANCE TUNNELS',short:'Tunnels',color:'#d59868',note:'← Ride the cart. Recover seal 13.',lore:'The service carts still run. Use one to cross the tunnels, then jump free before the end of the line.'},
  {name:'NUMBER VAULT',short:'Vault',color:'#dfc378',note:'Follow the rolling coins into the vault →',lore:'The old machines minted numbers, not money. Their enormous coins still roll through the galleries.'},
  {name:'ANCIENT CHAMBER',short:'Chamber',color:'#b4cfa0',note:'← Recover seal 31. Break the false wall.',lore:'03. 13. 31. The city built its lottery over a much older machine. The three seals open its heart.'},
  {name:'THE WARDEN',short:'Warden',color:'#f0b971',note:'Use all three seals at the gate. Defeat the Warden.',lore:'The Number Warden guards the original draw. Break its golden core and bring the light back to the surface.'}
];
export const checkpoint = i => ({x:i%2 ? 2670 : 190,y:floorY(i)});
export function makeWorld(){
  const w={platforms:[],ladders:[],ropes:[],hazards:[],coins:[],seals:[],enemies:[],walls:[],signs:[],carts:[],rolling:[],treasures:[]};
  let id=0;
  const platform=(x,y,width,kind='stone',extra={})=>w.platforms.push({id:id++,x,y,w:width,h:24,kind,...extra});
  for(let i=0;i<7;i++){
    const y=floorY(i), exit=i%2 ? 130 : 2740;
    // Access shafts are only 96px wide, so every floor can also be crossed on foot.
    const gaps=[];
    if(i<6)gaps.push([exit-48,exit+48]);
    if(i===0)gaps.push([1120,1450]);
    if(i===2)gaps.push([1180,1516]);
    if(i===3)gaps.push([1020,1270]);
    if(i===5)gaps.push([930,1200]);
    gaps.sort((a,b)=>a[0]-b[0]);let cursor=0;
    for(const [a,b]of gaps){platform(cursor,y,a-cursor);cursor=b;}
    platform(cursor,y,WIDTH-cursor);
    if(i<6)w.ladders.push({x:exit,y1:y-90,y2:y+STRIDE+5,depth:i});
    const perches=[500,1820,2350];
    for(const x of perches)platform(x,y-135,210,'ledge');
    w.ladders.push({x:570,y1:y-175,y2:y+2,depth:i,short:true});
    w.ladders.push({x:2420,y1:y-175,y2:y+2,depth:i,short:true});
    for(let k=0;k<20;k++){const x=330+k*117;if(gaps.some(([a,b])=>x>a-25&&x<b+25))continue;w.coins.push({id:id++,x,y:y-33,taken:false});}
    for(const x of [535,600,675,1850,1920,2390])w.coins.push({id:id++,x,y:y-169,taken:false});
    w.signs.push({x:exit-110,y:y-90,text:i<6?'↓ '+DEPTHS[i+1].name:'THE ORIGINAL DRAW',small:true});
    const place=locationAt(i);
    w.signs.push({x:310,y:y-235,text:place.name.toUpperCase(),large:true});
    w.signs.push({x:310,y:y-200,text:place.street.toUpperCase(),small:true});
    if(i===0)w.signs.push({x:1380,y:y-190,text:'CONGRESS ST →',large:true},{x:2240,y:y-235,text:'GRISWOLD ST',large:true});
    if(i>0&&i<6){w.enemies.push({id:id++,type:'guard',x:850,y,hp:3,min:760,max:1020,vx:48,shot:2,depth:i});w.enemies.push({id:id++,type:'drone',x:2080,y:y-185,baseY:y-185,hp:2,min:1950,max:2240,vx:-45,shot:3,depth:i});}
  }
  platform(1205,floorY(0)-35,135,'moving',{baseX:1205,baseY:floorY(0)-35,axis:'x',range:125,speed:1.1});
  w.ropes.push({x:1290,y:floorY(0)-315,length:220,phase:0});
  for(let k=0;k<6;k++)platform(1180+k*56,floorY(2),56,'crumble',{timer:-1,fallen:0});
  platform(1740,floorY(2),120,'elevator',{baseX:1740,baseY:floorY(2)-85,axis:'y',range:100,speed:.7});
  w.hazards.push({x:1120,y:floorY(0)+45,w:330,h:40,type:'spikes'});
  w.hazards.push({x:1180,y:floorY(2)+70,w:336,h:40,type:'spikes'});
  w.hazards.push({x:1020,y:floorY(3)+40,w:250,h:45,type:'fire'});
  w.hazards.push({x:1500,y:floorY(4)-8,w:130,h:20,type:'spikes'});
  w.hazards.push({x:930,y:floorY(5)+45,w:270,h:40,type:'fire'});
  w.ropes.push({x:1065,y:floorY(5)-315,length:232,phase:1});
  platform(1035,floorY(5)-30,110,'moving',{baseX:1035,baseY:floorY(5)-30,axis:'x',range:100,speed:.8});
  w.carts.push({x:2510,y:floorY(3)-8,w:115,vx:-260,ridden:false,min:300,max:2570});
  w.rolling.push({x:2100,y:floorY(4)-39,r:39,speed:-155,min:1050,max:2560});
  w.rolling.push({x:2470,y:floorY(4)-39,r:39,speed:-155,min:1050,max:2560});
  w.seals=[{number:'03',depth:1,x:420,y:floorY(1)-40,taken:false},{number:'13',depth:3,x:1700,y:floorY(3)-40,taken:false},{number:'31',depth:5,x:700,y:floorY(5)-40,taken:false}];
  w.walls=[{id:'false-wall',x:2500,y:floorY(5)-190,w:40,h:190,hp:4,secret:true}];
  w.treasures=[{x:2600,y:floorY(5)-35,taken:false,wall:'false-wall'},{x:1880,y:floorY(2)-170,taken:false}];
  w.signs.push({x:310,y:floorY(0)-94,text:'SUBWAY ACCESS →'});
  w.signs.push({x:840,y:floorY(0)-194,text:'W / S · CLIMB     E · GRAB ROPE',small:true});
  w.signs.push({x:1700,y:floorY(1)-260,text:'03 / EASTBOUND',large:true});
  w.signs.push({x:920,y:floorY(2)-125,text:'UNSTABLE FLOOR',small:true});
  w.signs.push({x:2320,y:floorY(3)-120,text:'E · BOARD CART',small:true});
  w.signs.push({x:2170,y:floorY(5)-120,text:'HOLLOW STONE. TRY YOUR BLASTER.',small:true});
  w.gate={x:1000,y:floorY(6)-250,w:70,h:250,open:false};
  w.boss={x:2170,y:floorY(6),hp:65,maxHp:65,active:false,phase:0,shot:1.8,pulse:4,flash:0};
  w.exit={x:2640,y:floorY(6)-70};
  return w;
}

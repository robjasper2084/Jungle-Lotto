import {CONFIG,ENEMIES,TIERS} from './config.js';import {SEGMENTS,TUTORIAL} from './segment-library.js';
export function random(s){s.seed^=s.seed<<13;s.seed^=s.seed>>>17;s.seed^=s.seed<<5;return(s.seed>>>0)/4294967296;}
export function director(){return {nextX:1200,index:0,recent:[],nextKey:350,nextBoss:1000,vaultStage:-1,lastHitSegment:-9};}
export function addSegment(s,definition,x=s.director.nextX){const d=s.director,instance={id:definition.id,start:x,end:x+definition.length,pool:definition.pool,index:d.index++,damaged:false};s.segments.push(instance);d.nextX=instance.end;d.recent.push(definition.id);d.recent=d.recent.slice(-3);
 for(const entity of definition.entities){const e={...entity,x:x+entity.x,id:s.nextId++,segment:instance.index};if(e.category==='obstacle')s.obstacles.push({...e,hit:false,passed:false});else if(e.category==='enemy'){const meta=ENEMIES[e.type];s.enemies.push({...e,...meta,maxHp:meta.hp,cooldown:meta.fire||99,age:0,deadAt:-1,boss:e.type==='hunter',warning:0});}else{s.pickups.push({...e,digit:e.type==='chip'?Math.floor(random(s)*10):undefined,taken:false});}}
 const hazard=definition.entities.find(e=>e.category==='obstacle');for(let i=0;i<8;i++){const arc=hazard&&['gap','barrier','spikes','crumble','platform'].includes(hazard.type),slide=hazard&&['beam','laser'].includes(hazard.type);s.coins.push({id:s.nextId++,x:x+450+i*55,y:slide?23:arc?75+Math.sin(i/7*Math.PI)*75:38,taken:false});}
 for(let i=0;i<8;i++)s.coins.push({id:s.nextId++,x:x+1150+i*60,y:34,taken:false});return instance;
}
export function extend(s){const d=s.director;while(d.nextX<s.distance+CONFIG.viewAhead){const meters=d.nextX/10,tier=TIERS.filter(t=>meters>=t.distance).at(-1);let selected;
 if(s.tutorial&&d.index<TUTORIAL.length)selected=SEGMENTS.find(q=>q.id===TUTORIAL[d.index]);
 else if(d.vaultStage>=0){selected=SEGMENTS.filter(q=>q.pool==='vault')[d.vaultStage++];if(d.vaultStage>=3)d.vaultStage=-1;}
 else if(s.keys>=3&&!s.vaultAttempted){s.vaultAttempted=true;d.vaultStage=1;selected=SEGMENTS.find(q=>q.pool==='vault');s.notice='VAULT SIGNAL DETECTED';}
 else if(meters>=d.nextBoss){selected=SEGMENTS.filter(q=>q.pool==='boss')[d.index%2];d.nextBoss+=1500;}
 else if(s.player.hp<=2||d.index%5===4){const pool=SEGMENTS.filter(q=>q.pool==='reward');selected=pool[Math.floor(random(s)*pool.length)];}
 else{const pool=SEGMENTS.filter(q=>['easy','medium','hard'].includes(q.pool)&&q.minDifficulty<=tier.difficulty&&!d.recent.includes(q.id));selected=pool[Math.floor(random(s)*pool.length)];}
 const instance=addSegment(s,selected);if(meters>=d.nextKey&&selected.pool!=='vault'&&selected.pool!=='boss'){s.pickups.push({id:s.nextId++,category:'pickup',type:'key',x:instance.start+1700,y:34,segment:instance.index,taken:false});d.nextKey+=CONFIG.keyInterval;}
 if(d.index%3===0)s.pickups.push({id:s.nextId++,category:'pickup',type:'chip',digit:Math.floor(random(s)*10),x:instance.start+1550,y:34,segment:instance.index,taken:false});
 }}
export function recycle(s){const behind=s.distance-450;s.segments=s.segments.filter(x=>x.end>behind);s.obstacles=s.obstacles.filter(x=>x.x+(x.w||0)>behind);s.coins=s.coins.filter(x=>x.x>behind);s.pickups=s.pickups.filter(x=>x.x>behind);s.enemies=s.enemies.filter(e=>e.x>behind&&(e.hp>0||s.time-e.deadAt<1));}

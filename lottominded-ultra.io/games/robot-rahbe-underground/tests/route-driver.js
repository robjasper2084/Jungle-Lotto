import {floorY} from '../src/world.js';
export function routeAction(s){
  const p=s.player,d=s.depth;const a={sprint:true,shoot:true};
  const floor=floorY(d),exit=d%2?130:2740,sign=d%2?-1:1;
  if(p.climbing&&p.y<floor-12){a.down=true;return a;}
  let target=exit;
  const seal=s.world.seals.find(x=>x.depth===d&&!x.taken);
  if(seal)target=seal.x;
  if(d===6){target=s.world.gate.open?(s.world.boss.hp>0?1630:2640):900;if(!s.world.gate.open&&Math.abs(p.x-target)<30)a.interactPressed=true;}
  const delta=target-p.x;
  if(Math.abs(delta)>10){a.right=delta>0;a.left=delta<0;}
  else if(d<6&&target===exit)a.down=true;
  const opponents=s.world.enemies.filter(e=>e.hp>0&&e.depth===d&&Math.abs(e.x-p.x)<780);
  if(d===6&&s.world.boss.active&&s.world.boss.hp>0)opponents.push({...s.world.boss,type:'boss'});
  const enemy=opponents.sort((a,b)=>Math.abs(a.x-p.x)-Math.abs(b.x-p.x))[0];
  if(enemy)a.aim={x:enemy.x-p.x,y:(enemy.y-(enemy.type==='drone'?0:enemy.type==='boss'?78:30))-(p.y-32)};
  const gaps={0:[[1120,1450]],2:[[1180,1516]],3:[[1020,1270]],5:[[930,1200]]}[d]||[];
  const direction=Math.sign(delta)||sign;
  if(p.grounded&&gaps.some(([lo,hi])=>direction>0?p.x>lo-90&&p.x<lo-18:p.x<hi+90&&p.x>hi+18))a.jumpPressed=true;
  if(d===4&&p.grounded&&((p.x>1410&&p.x<1490)||s.world.rolling.some(r=>Math.abs(r.x-p.x)<150)))a.jumpPressed=true;
  if(p.grounded&&s.shots.some(b=>b.enemy&&Math.abs(b.x-p.x)<170&&Math.abs(b.y-(p.y-30))<70&&b.vx*(p.x-b.x)>0))a.jumpPressed=true;
  if(d===6&&p.grounded&&s.world.boss.active&&s.time%1.9<.025)a.jumpPressed=true;
  return a;
}

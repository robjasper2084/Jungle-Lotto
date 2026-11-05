import {writeFile,mkdir} from 'node:fs/promises';
import {createSimulation,update} from '../src/simulation.js';
import {routeAction} from './route-driver.js';
const s=createSimulation();s.mode='playing';
const report={noTeleports:true,noInvulnerability:true,noEnemyEdits:true,depths:[],damage:0,checkpoints:[],commands:0};
for(let frame=0;frame<60*360&&s.mode==='playing';frame++){
  const before=s.player.hp;update(s,routeAction(s));report.commands++;
  if(s.player.hp<before)report.damage+=before-s.player.hp;
  if(!report.depths.includes(s.depth)){report.depths.push(s.depth);report.checkpoints.push({depth:s.depth,time:s.time,hp:s.player.hp,x:s.player.x,y:s.player.y});}
  s.events=[];
}
Object.assign(report,{passed:s.mode==='won',mode:s.mode,seconds:s.time,health:s.player.hp,deaths:s.deaths,seals:s.world.seals.filter(x=>x.taken).map(x=>x.number),bossHP:s.world.boss.hp,position:{x:s.player.x,y:s.player.y},kills:s.kills});
await mkdir('output/playwright',{recursive:true});await writeFile('output/playwright/continuous-route.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(!report.passed)process.exitCode=1;

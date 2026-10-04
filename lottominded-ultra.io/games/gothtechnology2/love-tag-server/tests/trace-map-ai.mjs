import {readFile} from 'node:fs/promises';
import {TagMatch,TagTerrain,neutralCommand} from '@digital-static/ridecore/tag';
const f=JSON.parse(await readFile(new URL('../fixtures/'+(process.argv[2]??'elmwood-explorer')+'.json',import.meta.url),'utf8'));
const terrain=await TagTerrain.create(f),match=new TagMatch(f,terrain,'classic');
match.addActor('human','Review rider');for(let i=1;i<4;i++)match.addActor('bot-'+i,'Bot '+i,true);match.start('actual-'+(process.argv[2]??'elmwood-explorer')+'-classic');
const history=[];let seq=0;
for(let n=0;n<11200&&match.phase!=='results';n++){
 match.command('human',{...neutralCommand(match.round,++seq,match.tick),throttle:n<450?.65:0,steer:n>230&&n<330?.15:0});match.step();
 const a=match.actors[Number(process.argv[3]??2)],p=a.controller.poseValue,nearest=terrain.nearest(p);
 if(n%6===0){history.push({tick:n,time:match.time,pose:{x:p.x,y:p.y,z:p.z,speed:p.speed,yaw:p.headingY},input:{throttle:a.input.throttle,steer:a.input.steer,burst:a.input.burst},lane:nearest,goal:a.goal,route:a.route.slice(0,4)});if(history.length>8)history.shift();}
 if(!terrain.legal(p)){console.log(JSON.stringify({firstIllegal:history},null,2));break;}
}
terrain.dispose();

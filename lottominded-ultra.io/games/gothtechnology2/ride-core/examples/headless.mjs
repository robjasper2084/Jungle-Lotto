import {RideCore,MASCOT_PROFILE,RIDECORE} from '../dist/index.js';
const terrain={
  sampleGround(x,z,out){Object.assign(out,{height:0,normal:{x:0,y:1,z:0},surface:'pavement',offCourse:false});return out;},
  raycast(){return null;},raycastObstacle(){return null;}
};
const ride=new RideCore(terrain,{profile:MASCOT_PROFILE,spawn:{position:{x:0,y:0,z:0},headingY:0}});
let score=0;
for(let frame=0;frame<360;frame++)for(const event of ride.advance(1/60,{trick:frame===0?5:0}).events)if(event.type==='trick'){console.log(event.message);score+=event.points;}
console.log(JSON.stringify({...ride.snapshot(),library:RIDECORE,score},null,2));
if(score!==240||ride.current.stopFoot!==0)throw new Error('Standalone integration failed');

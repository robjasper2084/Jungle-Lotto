import test from 'node:test';
import assert from 'node:assert/strict';
import {JarvsAvionics,type JarvsInput} from './jarvsAvionics.ts';

const flight=(now=10000,extra:Partial<JarvsInput>={}):JarvsInput=>({
 now,x:0,y:12,z:0,heading:0,speed:9,clearance:4,
 flying:true,landed:false,collision:false,hazard:false,
 mode:'drone',blocked:false,racing:false,...extra,
});

test('JARVS is an optional read-only advisor until the rider enables assist',()=>{
 const a=new JarvsAvionics({floor:(_x,z)=>z>=10?5:0});
 const s=a.update(flight());
 assert.equal(s.signalLock,true);assert.equal(s.status,'CAUTION');
 assert.equal(s.suggestedLift,0);assert.equal(a.assistLift(0,'drone',false),0);
 assert.match(s.advice,/terrain/i);
});

test('optional assist may increase altitude only for unattended Drone flight outside races',()=>{
 const a=new JarvsAvionics({floor:(_x,z)=>z>=10?5:0});
 a.assistEnabled=true;
 const s=a.update(flight());
 assert(s.suggestedLift>0&&s.suggestedLift<=.38);
 assert.equal(a.assistLift(0,'drone',false),s.suggestedLift);
 assert.equal(a.assistLift(-1,'drone',false),-1);
 assert.equal(a.assistLift(1,'drone',false),1);
 assert.equal(a.assistLift(0,'classic',false),0);
 assert.equal(a.assistLift(0,'drone',true),0);
 a.update(flight(11000,{racing:true}));
 assert.equal(a.assistLift(0,'drone',false),0);
});

test('nearby obstacles and collisions emit bounded prioritized speech without false path claims',()=>{
 let hit:number|null=4;
 const a=new JarvsAvionics({floor:()=>0,obstacle:()=>hit});
 const first=a.update(flight(10000));
 assert.equal(first.status,'CAUTION');assert.equal(first.radarMeters,4);
 assert.equal(first.announcement?.priority,'warning');
 assert.match(first.announcement!.text,/Obstacle ahead/);
 assert.equal(a.update(flight(10001)).announcement,undefined,'do not replay alerts between scans');
 const second=a.update(flight(10500));
 assert.equal(second.announcement,undefined,'do not spam the same hazard');
 hit=null;
 assert.equal(a.update(flight(17000)).status,'SCANNING');
 assert.match(a.update(flight(17200)).advice,/clear/i);
 const impact=a.update(flight(19000,{collision:true}));
 assert.equal(impact.status,'CRITICAL');assert.equal(impact.announcement?.priority,'critical');
 assert(!impact.announcement?.text.includes('Obstacle avoided'));
});

test('route memory is bounded to 64 current-session cells and sampling to four times a second',()=>{
 let floors=0,casts=0;
 const a=new JarvsAvionics({floor:()=>{floors++;return 0;},obstacle:()=>{casts++;return null;}});
 a.update(flight());
 assert.equal(floors,2);assert.equal(casts,1);
 a.update(flight(10100));
 assert.equal(floors,2,'extra frame must not resample terrain');
 for(let i=1;i<220;i++)a.update(flight(10000+i*300,{x:i*50,z:0}));
 assert.equal(a.snapshot.memoryCells,64);
 assert(floors<=440&&casts<=220,'all sensors are sampled at the bounded rate');
 a.reset();assert.equal(a.snapshot.memoryCells,0);assert.equal(a.snapshot.status,'STANDBY');
});

test('race, focus loss, invalid data, and sensor exceptions fail to safe standby/advisory',()=>{
 const a=new JarvsAvionics({floor:()=>{throw Error('missing terrain');}});
 assert.equal(a.update(flight()).status,'CAUTION');
 assert.equal(a.update(flight(10300,{racing:true})).status,'STANDBY');
 assert.equal(a.update(flight(10600,{blocked:true})).signalLock,false);
 assert.equal(a.update(flight(10900,{y:NaN})).status,'STANDBY');
 assert.equal(a.update(flight(11200,{flying:false,landed:true})).status,'STANDBY');
});

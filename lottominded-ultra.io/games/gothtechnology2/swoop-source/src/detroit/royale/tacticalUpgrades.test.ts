import test from 'node:test';import assert from 'node:assert/strict';
import {presetTouchLayout,type Rect} from './touchLayout.ts';
import {environmentalCue} from './audioCues.ts';
import {reloadReadout} from './combatReadout.ts';
import {FpsMotion,reloadPose} from './fpsMotion.ts';
import {initialCombat} from '../../../../ride-core/src/royale/rules.ts';
const overlap=(a:Rect,b:Rect)=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;
for(const [width,height]of [[320,568],[390,844],[568,320],[844,390],[1024,768]])for(const preset of ['two','three','four'] as const)test(`${preset} finger controls fit ${width}x${height}`,()=>{
 const l=presetTouchLayout(width,height,60,preset),buttons=Object.values(l.buttons);for(const b of buttons){assert(b.width>=44);assert(b.x>=0&&b.y>=64&&b.x+b.width<=width&&b.y+b.height<=height);assert(!overlap(b,l.move));}
 for(let i=0;i<buttons.length;i++)for(let j=i+1;j<buttons.length;j++)assert(!overlap(buttons[i],buttons[j]));
});
test('walls muffle cues, front/back differ, and elevation is preserved',()=>{
 const from={x:0,y:4,z:8},to={x:0,y:1,z:0};const open=environmentalCue(from,to,0),wall=environmentalCue(from,to,0,{raycastObstacle:()=>2} as any);
 assert.equal(open.elevation,3);assert(wall.occluded&&wall.gain<open.gain*.5&&wall.filter<open.filter);assert(environmentalCue(from,to,Math.PI).gain<open.gain);
});
test('reload meter tracks actual commit and each weapon has distinct reduced-motion-safe feedback',()=>{
 const c={...initialCombat(),reloadStart:10,reloadCommit:70,reloadEnd:100};assert.equal(reloadReadout(c,40)?.stage,'Loading magazine');assert.equal(reloadReadout(c,80)?.stage,'Readying weapon');assert.equal(reloadReadout(initialCombat(),40),null);
 const reload=reloadPose(initialCombat(),0),kicks=['static','heart','bass'].map(w=>new FpsMotion().update(1/60,w,true,0,false,false,false,reload).kick);assert(kicks[0]<kicks[1]&&kicks[1]<kicks[2]);assert.equal(new FpsMotion().update(1/60,'bass',true,0,false,false,true,reload).kick,0);
});

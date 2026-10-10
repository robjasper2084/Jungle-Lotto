import {test} from 'node:test';
import assert from 'node:assert/strict';
import {touchLayout,type Rect} from './royale/touchLayout.ts';
const overlaps=(a:Rect,b:Rect)=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;
for(const [width,height] of [[320,568],[360,640],[390,844],[568,320],[667,375],[844,390],[768,1024],[1024,768]])for(const size of [48,60,86])test(`touch targets fit ${width}x${height}, preference ${size}`,()=>{
 const hudBottom=height>580?250:188,layout=touchLayout(width,height,size,hudBottom),buttons=Object.values(layout.buttons);
 for(const button of buttons){assert.ok(button.width>=44);assert.ok(button.x>=0&&button.y>=64&&button.x+button.width<=width&&button.y+button.height<=height);assert.ok(!overlaps(button,layout.move),'joystick exclusion');}
 for(let i=0;i<buttons.length;i++)for(let j=i+1;j<buttons.length;j++)assert.ok(!overlaps(buttons[i],buttons[j]),'separate actions');
 assert.ok(!overlaps(layout.buttons.scope,{x:10,y:68,width:220,height:hudBottom-68}),'scope clear of HUD');
});
test('landscape safe areas remain clear',()=>{const l=touchLayout(844,390,86,188,{left:44,right:44,top:0,bottom:21});for(const r of Object.values(l.buttons))assert.ok(r.x>=44&&r.x+r.width<=800&&r.y+r.height<=369);});

import test from 'node:test';
import assert from 'node:assert/strict';
import {syncRaceRadioDock,closesRideMenu} from './rideRadioDock.ts';

// Model tests cover reparenting only. Browser evidence must additionally prove
// native taps, actual CSS hit regions and the real game; these are not WebGL tests.
function fixture(){
 const classes=new Set<string>(['belle-hud-control']);let moves=0;
 const body={append(node:unknown){moves++;root.parentElement=body;assert.equal(node,root);}};
 const menu={isConnected:true,append(node:unknown){moves++;root.parentElement=menu;assert.equal(node,root);}};
 const root={parentElement:body as unknown,ownerDocument:{body},classList:{toggle(name:string,value:boolean){value?classes.add(name):classes.delete(name);}},savedProfile:{u:.8,v:.2},audioToken:{}};
 const sync=(racing:boolean,libraryOpen=false,host:typeof menu|null=menu)=>syncRaceRadioDock(root as unknown as HTMLElement,host as unknown as HTMLElement|null,racing,libraryOpen);
 return {root,body,menu,classes,sync,moves:()=>moves};
}
test('exploration keeps the original radio at home',()=>{const f=fixture();assert.equal(f.sync(false),false);assert.equal(f.root.parentElement,f.body);assert.equal(f.moves(),0);});
test('racing moves the existing radio into the Tools host',()=>{const f=fixture();assert.equal(f.sync(true),true);assert.equal(f.root.parentElement,f.menu);assert(f.classes.has('race-menu-radio'));assert.equal(f.moves(),1);});
test('steady racing updates do not repeatedly move the DOM',()=>{const f=fixture();for(let i=0;i<120;i++)assert(f.sync(true));assert.equal(f.moves(),1);});
test('leaving a race restores the original control and saved position',()=>{const f=fixture(),profile=f.root.savedProfile,audio=f.root.audioToken;f.sync(true);f.sync(false);assert.equal(f.root.parentElement,f.body);assert.equal(f.moves(),2);assert.equal(f.root.savedProfile,profile);assert.equal(f.root.audioToken,audio);assert(f.classes.has('belle-hud-control'));assert(!f.classes.has('race-menu-radio'));});
test('explicit cockpit library access remains outside the closed drawer',()=>{const f=fixture();f.sync(true);assert.equal(f.sync(true,true),false);assert.equal(f.root.parentElement,f.body);assert(!f.classes.has('race-menu-radio'));});
test('closing the cockpit library returns race controls to Tools',()=>{const f=fixture();f.sync(true);f.sync(true,true);f.sync(true,false);assert.equal(f.root.parentElement,f.menu);assert.equal(f.moves(),3);});
test('missing Tools host retains usable original radio',()=>{const f=fixture();assert.equal(f.sync(true,false,null),false);assert.equal(f.root.parentElement,f.body);});
test('detached Tools host cannot swallow the radio',()=>{const f=fixture();f.sync(true);f.menu.isConnected=false;assert.equal(f.sync(true),false);assert.equal(f.root.parentElement,f.body);});
test('reconnected Tools host is used on the next state update',()=>{const f=fixture();f.menu.isConnected=false;f.sync(true);f.menu.isConnected=true;assert(f.sync(true));assert.equal(f.root.parentElement,f.menu);});
function target(button:boolean,radio:boolean){return {closest:(selector:string)=>selector==='button'?button?{}:null:selector==='#ride-radio'?radio?{}:null:null} as unknown as Element;}
test('regular Tools navigation still closes the dialog',()=>{assert.equal(closesRideMenu(target(true,false)),true);});
test('radio transport and nested icons keep Tools open',()=>{assert.equal(closesRideMenu(target(true,true)),false);});
test('radio disclosure and non-button content do not close Tools',()=>{assert.equal(closesRideMenu(target(false,true)),false);assert.equal(closesRideMenu(target(false,false)),false);});

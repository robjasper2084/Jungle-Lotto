import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {flightHudBackdropFactor} from './flightHudBackdrop.ts';
test('fast flight lowers only decorative panel backing by at most forty percent',()=>{
 for(const speed of [-1,0,20,NaN,Infinity])assert.equal(flightHudBackdropFactor(speed,true,false),1);
 assert.equal(flightHudBackdropFactor(45,true,false),.6);
 assert.equal(flightHudBackdropFactor(100,true,false),.6);
 let previous=1;for(let speed=20;speed<=45;speed+=.5){const next=flightHudBackdropFactor(speed,true,false);assert(next<=previous&&next>=.6&&next<=1);previous=next;}
 assert.equal(flightHudBackdropFactor(50,false,false),1);
 assert.equal(flightHudBackdropFactor(50,true,true),1);
});
test('background-only fast HUD retains control and critical-warning styles',()=>{
 const main=readFileSync(new URL('./main.ts',import.meta.url),'utf8');
 const css=readFileSync(new URL('./visualPolish.css',import.meta.url),'utf8');
 assert(main.includes('flightHudBackdropFactor(pose.speed,!!hover?.riding,paused||overlay||!!coop?.active)'));
 assert(css.includes('#jarvs-avionics:not([data-status=CRITICAL])'));
 assert(css.includes('background-color:rgb(7 24 31 / var(--belle-flight-hud-alpha,.87))'));
 assert(!css.includes('opacity:var(--belle-flight-hud-alpha'));
});

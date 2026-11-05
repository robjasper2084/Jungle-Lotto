from pathlib import Path
root=Path(__file__).resolve().parents[3]
p=root/'swoop-source/src/detroit/royale/main.ts'
s=p.read_text(encoding='utf-8')
def replace(a,b):
 global s
 assert a in s,a[:100]
 s=s.replace(a,b)
replace("import {Hero,solve}","import {Hero}")
replace("const el=<K", "import {CombatRig} from './combatRig.ts';\nimport {AimGesture,deadZone,readBindings,type AimPreset} from './combatControls.ts';\nimport {WHEELS,wheelProfile} from '../../../../ride-core/src/royale/wheelProfiles.ts';\nimport {FIRE_MODES} from '../../../../ride-core/src/royale/combatProfiles.ts';\nconst el=<K")
replace("skin.value='DS_Man_01';", "skin.value='DS_Man_01';\nconst wheel=el<HTMLSelectElement>('wheel');for(const w of WHEELS)wheel.add(new Option(w.name+' · '+Math.round(w.topKph)+' km/h',w.id));\nconst aimGesture=new AimGesture();let bindings=readBindings(null),lookYaw=0,lookPitch=0,firstPerson=false;\ntry{bindings=readBindings(JSON.parse(localStorage.getItem('royale-combat-bindings')??'null'));const preset=localStorage.getItem('royale-aim-preset');if(['classic','hold','toggle'].includes(preset??''))aimGesture.preset=preset as AimPreset;}catch{}\nel<HTMLSelectElement>('aim-preset').value=aimGesture.preset;el<HTMLSelectElement>('aim-preset').onchange=e=>{aimGesture.reset();aimGesture.preset=(e.target as HTMLSelectElement).value as AimPreset;try{localStorage.setItem('royale-aim-preset',aimGesture.preset);}catch{}};\nfor(const key of Object.keys(bindings) as (keyof typeof bindings)[]){const label=document.createElement('label');label.textContent=key;const input=document.createElement('button');input.textContent=bindings[key];input.onclick=()=>{input.textContent='Press a key…';input.onkeydown=e=>{e.preventDefault();e.stopPropagation();bindings=readBindings({...bindings,[key]:e.code});try{localStorage.setItem('royale-combat-bindings',JSON.stringify(bindings));}catch{}location.reload();};};label.append(input);el('bindings').append(label);}")
replace("weapon:T.Group;shield:T.Mesh", "weapon:T.Group;shield:T.Mesh;rig:CombatRig;wheelId:string")
replace("function release(){keys.clear();", "function release(){aimGesture.reset();lookYaw=lookPitch=0;keys.clear();")
replace("await loadEngineForPage();if(engineRequested()&&!engineReady())", "await loadEngineForPage(true);if(!engineReady())")
replace(" equipmentLibrary=await", " await Promise.all(WHEELS.filter(w=>w.id!=='euc').map(async w=>assetMap.set(w.asset,await loader.loadAsync('/exports/electric/'+w.asset+'.glb'))));\n equipmentLibrary=await")
replace("session.offline(skin.value);", "session.offline(skin.value,wheel.value);")
replace("name,skin.value,fill,spectate);", "name,skin.value,fill,spectate,wheel.value);")
start=s.index("window.addEventListener('keydown'")
end=s.index("const orientation=",start)
s=s[:start]+'''window.addEventListener('keydown',e=>{if((e.target as HTMLElement)?.matches('input,select,textarea,button')||dialog.open)return;
 if([...Object.values(bindings),'ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Digit1','Digit2','Escape'].includes(e.code))e.preventDefault();
 if(e.code==='Escape'||e.code===bindings.loadout){showMenu();return;}
 if(!keys.has(e.code)){for(const [key,action] of [['hop','hop'],['utility','utility'],['repair','repair'],['recover','recover'],['reload','reload'],['pickup','swap'],['cycleMode','cycleMode']] as const)if(e.code===bindings[key])tap.add(action);if(e.code===bindings.camera)firstPerson=!firstPerson;}
 keys.add(e.code);if(e.code==='Digit1')slot=0;if(e.code==='Digit2')slot=1;
});
window.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',release);window.addEventListener('gamepaddisconnected',release);
document.addEventListener('visibilitychange',()=>{release();last=performance.now();acc=0;});
canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('wheel',e=>{if(dialog.open)return;e.preventDefault();slot=1-slot;},{passive:false});
canvas.addEventListener('pointerdown',e=>{if(dialog.open)return;canvas.focus();canvas.setPointerCapture(e.pointerId);aimPointer=e.pointerId;aimX=e.clientX;aimY=e.clientY;if(e.pointerType==='mouse'){if(e.button===0)held.add('fire');if(e.button===2)aimGesture.down(performance.now());}});
canvas.addEventListener('pointermove',e=>{if(dialog.open||e.pointerType!=='mouse'&&aimPointer!==e.pointerId)return;
 const dx=e.pointerType==='mouse'?e.movementX:e.clientX-aimX,dy=e.pointerType==='mouse'?e.movementY:e.clientY-aimY;
 if(keys.has(bindings.freeLook)){lookYaw=T.MathUtils.clamp(lookYaw+dx*.004,-1.8,1.8);lookPitch=T.MathUtils.clamp(lookPitch-dy*.003,-.8,.8);}
 else{aimYaw=T.MathUtils.clamp(aimYaw+dx*.004,-1.25,1.25);aimPitch=T.MathUtils.clamp(aimPitch-dy*.003,-.65,.65);}
 aimX=e.clientX;aimY=e.clientY;
});
canvas.addEventListener('pointerup',e=>{if(e.button===2)aimGesture.up(performance.now());if(e.button===0)held.delete('fire');aimPointer=undefined;});
canvas.addEventListener('pointercancel',release);
canvas.addEventListener('lostpointercapture',()=>{held.delete('fire');aimPointer=undefined;});
''' +s[end:]
replace("function buttonAction(action:string){", "function buttonAction(action:string){if(action==='aim'){aimGesture.down(0);aimGesture.up(1);return;}")
replace("c.steer=T.MathUtils", "c.steer=T.MathUtils")
start=s.index('function command():Command')
end=s.index('function view(',start)
s=s[:start]+'''function command():Command{const c=neutral(session.state?.round??'');const pad=navigator.getGamepads?.()[0];const axis=(n:number)=>deadZone(pad?.axes[n]??0);
 c.throttle=T.MathUtils.clamp(throttle+Number(keys.has(bindings.forward)||keys.has('ArrowUp'))-Number(keys.has(bindings.brake)||keys.has('ArrowDown'))-axis(1),-1,1);
 c.steer=T.MathUtils.clamp(steer+Number(keys.has(bindings.right)||keys.has('ArrowRight'))-Number(keys.has(bindings.left)||keys.has('ArrowLeft'))+axis(0),-1,1);
 aimYaw=T.MathUtils.clamp(aimYaw+axis(2)*.024,-1.25,1.25);aimPitch=T.MathUtils.clamp(aimPitch-axis(3)*.018,-.65,.65);c.aimYaw=aimYaw;c.aimPitch=aimPitch;
 c.fire=held.has('fire')||!!pad?.buttons[7]?.pressed;c.aimMode=pad?.buttons[6]?.pressed?2:aimGesture.get(performance.now());
 c.reload=tap.has('reload')||!!pad?.buttons[2]?.pressed;c.cycleMode=tap.has('cycleMode');c.lean=Number(keys.has(bindings.leanRight))-Number(keys.has(bindings.leanLeft));c.crouch=keys.has(bindings.crouch);
 c.hop=tap.has('hop')||!!pad?.buttons[0]?.pressed;c.hopHeld=held.has('hop')||keys.has(bindings.hop)||!!pad?.buttons[0]?.pressed;c.burst=held.has('burst')||keys.has(bindings.burst)||!!pad?.buttons[4]?.pressed;
 c.utility=tap.has('utility')||!!pad?.buttons[5]?.pressed;c.repair=tap.has('repair')||!!pad?.buttons[3]?.pressed;c.recover=tap.has('recover');c.swap=tap.has('swap');c.slot=slot;tap.clear();return c;
}
''' +s[end:]
replace("function view(id:string,choice:string){", "function view(id:string,choice:string,wheelId:string){")
replace("a.view.riderId===riderChoice(choice)", "a.view.riderId===riderChoice(choice)&&a.wheelId===wheelId")
replace("const hero=new Hero(assetMap,terrain,riderChoice(choice))", "const models=new Map(assetMap);models.set('DS_EUC_01',assetMap.get(wheelProfile(wheelId).asset)!);const hero=new Hero(models,terrain,riderChoice(choice))")
replace("a={view:hero,equipment,weapon,shield};", "a={view:hero,equipment,weapon,shield,rig:new CombatRig(hero,equipment),wheelId};")
replace("view(actor.id,actor.skin)", "view(actor.id,actor.skin,actor.wheelId)")
start=s.index('  if(a.weapon.visible&&a.view.chest)')
end=s.index('  a.shield.position',start)
s=s[:start]+'''  if(a.weapon.visible)a.rig.apply(pose,yaw,pitch,actor.combat,s.tick);
  if(actor.id===session.me)canvas.dataset.rig=JSON.stringify({rider:actor.skin,wheel:actor.wheelId,rightError:a.rig.errorR,leftError:a.rig.errorL,supportLocked:a.rig.supportLocked});
''' +s[end:]
start=s.index(' const self=s.actors.find(')
end=s.index(' if(now-hudAt',start)
s=s[:start]+''' const self=s.actors.find(a=>a.id===session.me);if(self){const p=session.room&&session.prediction?session.prediction.controller.poseValue:self.pose,mode=aimGesture.get(now),ads=mode===2;
 if(!keys.has(bindings.freeLook)){lookYaw*=Math.exp(-delta*10);lookPitch*=Math.exp(-delta*10);}
 const heading=p.headingY+aimYaw+lookYaw+self.combat.kickYaw,pitch=aimPitch+lookPitch+self.combat.kickPitch;
 const scale=self.skin.startsWith('DS_Mascot_')?.48:1,socket=weaponSocket(p,self.skin,aimYaw,aimPitch,self.combat.aimBlend,self.combat.lean);
 const at=new T.Vector3(socket.grip.x,socket.grip.y+.10*scale,socket.grip.z),forward=new T.Vector3(Math.sin(heading)*Math.cos(pitch),Math.sin(pitch),Math.cos(heading)*Math.cos(pitch));
 const desired=ads||firstPerson?at.clone().addScaledVector(forward,-.06*scale):at.clone().addScaledVector(forward,mode===1?-2.4:-5.5).add(new T.Vector3(Math.cos(heading)*.4,.65,-Math.sin(heading)*.4));
 const ray=desired.clone().sub(at),length=ray.length(),hit=terrain.raycast(at,ray.normalize(),length);if(hit!==null)desired.copy(at).addScaledVector(ray,Math.max(.03,hit-.25));desired.y=Math.max(desired.y,terrain.ground(desired.x,desired.z,p.y).height+.25);
 scenery.update(p,now/1000);camera.position.copy(desired);camera.lookAt(desired.clone().addScaledVector(forward,100));const fov=ads?43:62;if(camera.fov!==fov){camera.fov=fov;camera.updateProjectionMatrix();}
 const mine=actors.get(self.id);if(mine)mine.view.rider.visible=!(ads||firstPerson); // view-only head/body occlusion, authoritative rig continues evaluating
 }
''' +s[end:]
replace("WEAPONS[w].name+' · '+me!.ammo[w]+' shots · '+me!.repairs+' repairs'", "WEAPONS[w].name+' · '+me!.combat.magazine[w]+' / '+(me!.ammo[w]-me!.combat.magazine[w])+' · '+FIRE_MODES[me!.combat.fireMode]+(me!.combat.reloadStart>=0?' · Reloading…':'')")
replace("  el('field').textContent=", "  el('speed').textContent=self?Math.round(Math.abs(self.pose.speed)*3.6)+' / '+Math.round(wheelProfile(self.wheelId).topKph)+' km/h · '+wheelProfile(self.wheelId).name+' · game estimate':'';\n  el('field').textContent=")
replace("'WASD ride · drag to aim · F fire · Space hop'", "'WASD ride · mouse aim · click fire · right click ADS · R reload · K recover'")
replace("(e.target as HTMLInputElement).value+'px');};", "(e.target as HTMLInputElement).value+'px');try{localStorage.setItem('royale-touch-size',(e.target as HTMLInputElement).value);}catch{}};\ntry{const size=Number(localStorage.getItem('royale-touch-size'));if(size>=48&&size<=86){el<HTMLInputElement>('button-size').value=String(size);el('touch').style.setProperty('--touch-size',size+'px');}}catch{}")
p.write_text(s,encoding='utf-8')
p=root/'swoop-source/royale.html';s=p.read_text(encoding='utf-8')
replace('<span id="field"></span>', '<span id="field"></span><span id="speed"></span>')
replace('<select id="skin"></select></label>','<select id="skin"></select></label><label>Wheel<select id="wheel"></select></label><p class="note">Wheel choice changes handling and speed. Existing inspired models use estimated game handling. Locked for the match.</p>')
start=s.index('<p>W/S:');end=s.index('<label>Quality',start)
s=s[:start]+'''<p>W/S ride / brake · A/D steer · mouse aim · left click fire · right click tap ADS, hold shoulder aim · R reload · K recover · Q/E lean · Alt free look · C tuck · B fire mode · 1/2 or mouse wheel select · F pick up · G shield · H repair · V camera · Tab/Escape menu.</p><p>Gamepad: left stick rides, right stick aims, RT fire, LT ADS, X reload, A hop, LB burst, RB shield, Y repair. Touch controls can be moved and resized.</p><label>Aim preset<select id="aim-preset"><option value="classic">Classic · tap ADS / hold shoulder</option><option value="hold">Hold to ADS</option><option value="toggle">Toggle ADS</option></select></label><details><summary>Remap keyboard controls</summary><div id="bindings"></div></details>''' +s[end:]
replace('<button data-action="swap">Pick up</button>', '<button data-action="swap">Pick up</button><button data-action="reload">Reload</button><button data-action="aim">ADS</button><button data-action="cycleMode">Mode</button>')
p.write_text(s,encoding='utf-8')

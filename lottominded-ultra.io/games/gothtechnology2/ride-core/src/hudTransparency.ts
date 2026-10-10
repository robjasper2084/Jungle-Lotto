/** Background alpha preserves readable labels and full hit targets. Preferences
 * apply to all three game entries without fading the rendered world underneath. */
export function mountHudTransparency(parent:HTMLElement){
 let panel=.52,buttons=.42;try{const s=JSON.parse(localStorage.getItem('digital-static-hud-alpha')??'null');if(s){panel=Number(s.panel);buttons=Number(s.buttons);}}catch{}
 const field=document.createElement('fieldset'),legend=document.createElement('legend');legend.textContent='See through game overlays';field.append(legend);
 const apply=()=>{panel=Math.max(.20,Math.min(.85,Number.isFinite(panel)?panel:.52));buttons=Math.max(.18,Math.min(.85,Number.isFinite(buttons)?buttons:.42));document.documentElement.style.setProperty('--hud-alpha',String(panel));document.documentElement.style.setProperty('--control-alpha',String(buttons));try{localStorage.setItem('digital-static-hud-alpha',JSON.stringify({panel,buttons}));}catch{}};
 for(const kind of ['panel','buttons'] as const){const label=document.createElement('label'),range=document.createElement('input');label.textContent=kind==='panel'?'Panel opacity':'Control opacity';range.type='range';range.min=kind==='panel'?'20':'18';range.max='85';range.step='1';range.value=String(Math.round((kind==='panel'?panel:buttons)*100));range.setAttribute('aria-label',label.textContent);range.oninput=()=>{if(kind==='panel')panel=Number(range.value)/100;else buttons=Number(range.value)/100;apply();};label.append(range);field.append(label);}
 parent.append(field);apply();const css=document.createElement('style');css.textContent=`
 :is(#hud,#hint,#connection-status,.ridingOptions,.dog-command-hud,.dogActions,.dogCommandTray,.jazz-visit,.food-vendor-panel,.food-vendor-media,.communityRide,.community-panel,.racePanel,.session,.studioPanel,.voice-chat,.rideVoice,.on-foot-controls) {background:rgb(9 31 34 / var(--hud-alpha,.52))!important;backdrop-filter:none!important;text-shadow:0 1px 3px #0008}
 :is(#touch button,header button,header a,.on-foot-controls button,.touch button,.dog-command-hud button,.dogActions button,.dogCommandTray button,.dog-touch-action,#optionsToggle) {background:rgb(12 43 43 / var(--control-alpha,.42))!important;color:#fff;text-shadow:0 1px 3px #000a}
 :is(#touch button,.dog-command-hud button,.dogActions button)[aria-pressed=true]{background:rgb(108 175 127 / var(--control-alpha,.42))!important;border-color:#e2d28a;box-shadow:0 0 0 2px #e2d28a90;color:white}
 dialog {background:rgb(11 26 37 / .78)!important}dialog::backdrop{background:#04101826!important}
 .optic-circle{box-shadow:0 0 0 100vmax #02070c88,inset 0 0 18px #07182055!important}
 `;document.head.append(css);return field;
}



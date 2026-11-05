import {createTouchDeck} from './touch-deck.js?v=2.0.2';
export const controls = [
  {id:'move',label:'MOVE / CLIMB',stick:true,role:'move',x:18,landscapeX:12,y:78,size:112},
  {id:'aim',label:'AIM',stick:true,role:'aim',x:81,landscapeX:88,y:78,size:100},
  {id:'fire-right',label:'Right fire',action:'shoot',x:81,landscapeX:90,y:30,landscapeY:28,size:66},
  {id:'fire-left',label:'Left fire',action:'shoot',x:18,landscapeX:13,y:28,landscapeY:24,size:48},
  {id:'jump',label:'Jump',action:'jump',x:61,landscapeX:73,y:54,landscapeY:51,size:54},
  {id:'crouch',label:'Crouch',action:'crouch',x:61,landscapeX:73,y:83,landscapeY:83,size:48},
  {id:'use',label:'Use / grab',action:'interact',x:44,landscapeX:62,y:29,landscapeY:29,size:48},
  {id:'sprint',label:'Sprint',action:'sprint',x:38,landscapeX:26,y:56,landscapeY:55,size:48}
];
export function createMobileControls(input,{pause,edit}){
  const host=document.getElementById('touch');host.replaceChildren();
  const deck=createTouchDeck({host,storageKey:'rahbe-underground-touch-v1',title:'RAHBE mobile controls',style:'battle',controls,
    actions:[{id:'shoot',label:'Fire weapon',short:'FIRE',icon:'Crosshair'},{id:'jump',label:'Jump / release rope',short:'JUMP',icon:'ArrowUp'},
      {id:'crouch',label:'Crouch',short:'CROUCH',icon:'ArrowDown'},{id:'interact',label:'Use / grab / insert seals',short:'USE',icon:'Hand'},
      {id:'sprint',label:'Sprint',short:'SPRINT',icon:'Footprints'}],
    presets:[{id:'thumbs',label:'2 fingers',controls},{id:'claw3',label:'3 fingers',controls:controls.map(c=>c.id==='fire-left'?{...c,landscapeX:23,landscapeY:10}:c)},
      {id:'claw4',label:'4 fingers',controls:controls.map(c=>c.id==='fire-left'?{...c,landscapeX:23,landscapeY:10}:c.id==='jump'?{...c,landscapeX:76,landscapeY:10}:c)}],
    onPress:action=>input.pressTouch(action),onRelease:action=>input.releaseTouch(action),onVector:(role,vector,held)=>input.setVector(role,vector,held),onEdit:edit,onMenu:pause
  });input.deck=deck;return deck;
}

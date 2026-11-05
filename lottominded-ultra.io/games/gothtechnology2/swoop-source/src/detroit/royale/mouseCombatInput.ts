import type {AimGesture} from './combatControls.ts';

/** Only explicit mouse button edges own combat state; movement never samples it. */
export class MouseCombatInput {
 private buttons=0;
 constructor(private readonly aim:AimGesture){}
 get canFire(){return !!(this.buttons&1);}
 handle(event:Pick<MouseEvent,'type'|'button'>,now:number){
  if(event.type!=='mousedown'&&event.type!=='mouseup'||event.button!==0&&event.button!==2)return {firePressed:false,fireReleased:false};
  const bit=event.button===0?1:2,next=event.type==='mousedown'?this.buttons|bit:this.buttons&~bit;
  const pressed=next&~this.buttons,released=this.buttons&~next;
  this.buttons=next;
  if(pressed&2)this.aim.down(now);
  if(released&2)this.aim.up(now);
  return {firePressed:!!(pressed&1),fireReleased:!!(released&1)};
 }
 reset(){this.buttons=0;this.aim.reset();}
}

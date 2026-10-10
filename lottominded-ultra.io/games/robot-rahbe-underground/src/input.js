const BINDINGS={ArrowLeft:'left',KeyA:'left',ArrowRight:'right',KeyD:'right',ArrowUp:'up',KeyW:'up',ArrowDown:'down',KeyS:'down',Space:'jump',KeyK:'jump',KeyJ:'shoot',KeyX:'shoot',KeyE:'interact',KeyF:'interact',ShiftLeft:'sprint',ShiftRight:'sprint',KeyC:'crouch'};
export class Input{
  constructor({pause,map,start,active}){
    this.held=new Set();this.touch=new Set();this.previous={};this.edges={};this.wasPad=false;this.padPause=false;this.enabled=true;this.move={x:0,y:0};this.aim=null;
    window.addEventListener('keydown',e=>{if(e.target.closest('dialog')||e.target.tagName==='BUTTON'&&['Enter','Space'].includes(e.code))return;
      if(e.code==='Escape'||e.code==='KeyP'){if(!e.repeat)pause();return;}if(e.code==='KeyM'){if(!e.repeat)map();return;}if(e.code==='Enter'&&!e.repeat){start();return;}
      if(BINDINGS[e.code]&&active()){e.preventDefault();if(!this.held.has(e.code))this.edge(BINDINGS[e.code],true);this.held.add(e.code);}
    });
    window.addEventListener('keyup',e=>{if(this.held.has(e.code))this.edge(BINDINGS[e.code],false);this.held.delete(e.code);});
    window.addEventListener('blur',()=>{this.clear();if(active())pause(true);});document.addEventListener('visibilitychange',()=>{if(document.hidden){this.clear();if(active())pause(true);}});this.onPause=pause;
  }
  edge(action,pressed){if(action==='jump')this.edges[pressed?'jumpPressed':'jumpReleased']=true;if(action==='interact'&&pressed)this.edges.interactPressed=true;}
  pressTouch(action){if(!this.enabled)return;if(!this.touch.has(action))this.edge(action,true);this.touch.add(action);}
  releaseTouch(action){if(this.touch.has(action))this.edge(action,false);this.touch.delete(action);}
  setVector(role,vector,held){if(role==='move')this.move=held?vector:{x:0,y:0};else this.aim=held&&Math.hypot(vector.x,vector.y)>.2?vector:null;}
  clear(){this.deck?.clear();this.held.clear();this.touch.clear();this.move={x:0,y:0};this.aim=null;this.previous={};this.edges={};}
  read(){
    const a={};const pad=[...(navigator.getGamepads?.()||[])].find(x=>x&&x.connected);
    if(!this.enabled){const pause=!!pad?.buttons[9]?.pressed;if(pause&&!this.padPause)this.onPause();this.padPause=pause;return a;}
    for(const key of this.held)a[BINDINGS[key]]=true;for(const action of this.touch)a[action]=true;if(Math.abs(this.move.x)>.12)a.moveX=this.move.x;a.up||=this.move.y<-.35;a.down||=this.move.y>.35;if(this.aim)a.aim=this.aim;
    if(pad){const pressed=i=>!!pad.buttons[i]?.pressed;const x=pad.axes[0]||0;if(Math.abs(x)>.22)a.moveX=x;a.left||=pressed(14);a.right||=pressed(15);a.up||=pad.axes[1]<-.3||pressed(12);a.down||=pad.axes[1]>.3||pressed(13);
      const ax=pad.axes[2]||0,ay=pad.axes[3]||0;if(Math.hypot(ax,ay)>.25)a.aim={x:ax,y:ay};a.jump||=pressed(0);a.shoot||=pressed(2)||pressed(7);a.interact||=pressed(3);a.crouch||=pressed(1);a.sprint||=pressed(10);if(pressed(9)&&!this.padPause)this.onPause();this.padPause=pressed(9);
    }else if(this.wasPad){this.onPause(true);this.clear();this.padPause=false;}
    this.wasPad=!!pad;a.jumpPressed=!!this.edges.jumpPressed||!!a.jump&&!this.previous.jump;a.jumpReleased=!!this.edges.jumpReleased||!a.jump&&!!this.previous.jump;a.interactPressed=!!this.edges.interactPressed||!!a.interact&&!this.previous.interact;this.edges={};this.previous={...a};return a;
  }
}

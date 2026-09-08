// Keep each existing runtime in its own document. Removing the frame releases its
// audio, graphics, timers, input listeners and game state without rewriting it.
export class GameAdapter {
 constructor(game,host,{onProgress=()=>{},onReady=()=>{},onError=()=>{}}={}){this.game=game;this.host=host;this.onProgress=onProgress;this.onReady=onReady;this.onError=onError;this.destroyed=false;}
 launch(settings,{debug=false}={}){
  const frame=this.frame=document.createElement('iframe');frame.title=this.game.id==='static-wars'?this.game.title:`ROBOT RAHBE: ${this.game.title}`;frame.allow='fullscreen; gamepad';
  const url=new URL(this.game.path,location.href);url.searchParams.set('arcade','1');if(debug)url.searchParams.set('debug','1');frame.src=url;this.host.replaceChildren(frame);
  this.timeout=setTimeout(()=>this.fail('The game did not finish loading. Check the local server and retry.'),45000);
  this.timer=setInterval(()=>{if(this.destroyed)return;try{const api=frame.contentWindow?.RahbeArcadeGame;if(!api){this.onProgress(null);return;}if(!api.ready){this.onProgress(api.progress??null);return;}if(!this.api){this.api=api;api.applySettings(settings);clearTimeout(this.timeout);this.onReady();}this.onProgress(1,this.getStats());}catch(error){this.fail(error.message);}},400);
 }
 // Copy the receipt into the hub realm so results cannot retain a removed game document.
 getStats(){const snapshot=this.api?.getStats();return snapshot?structuredClone(snapshot):null;}
 getRewards(){return this.getStats();}
 pause(){this.api?.pause();}
 resume(){this.api?.resume();this.frame?.contentWindow?.focus();}
 applySettings(settings){this.api?.applySettings(settings);}
 focus(){this.frame?.contentWindow?.focus();}
 fail(message){if(this.destroyed)return;this.destroy();this.onError(message);}
 destroy(){this.destroyed=true;clearInterval(this.timer);clearTimeout(this.timeout);try{this.api?.save?.();this.api?.pause();this.api?.destroy?.();}catch{}this.api=null;this.frame?.remove();this.frame=null;}
}

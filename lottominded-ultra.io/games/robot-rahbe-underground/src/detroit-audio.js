// Original generative score: no samples, copyrighted recordings, or autoplay.
export class DetroitAudio{
 constructor(){this.step=0;this.next=0;}
 async enable(){this.ctx??=new(window.AudioContext||window.webkitAudioContext)();await this.ctx.resume();this.next=this.ctx.currentTime;}
 note(hz,time,length=.12,gain=.03,type='triangle'){
  if(!this.ctx)return;const osc=this.ctx.createOscillator(),amp=this.ctx.createGain();osc.type=type;osc.frequency.setValueAtTime(hz,time);amp.gain.setValueAtTime(.0001,time);amp.gain.exponentialRampToValueAtTime(gain,time+.008);amp.gain.exponentialRampToValueAtTime(.0001,time+length);osc.connect(amp);amp.connect(this.ctx.destination);osc.start(time);osc.stop(time+length+.02);
 }
 tick(s,enabled,volume=.65){
  if(!this.ctx)return;const now=this.ctx.currentTime;if(!enabled||s.mode!=='playing'){this.next=now;return;}
  if(this.next<now-.3)this.next=now;
  while(this.next<now+.12){const beat=this.step%16,t=this.next,g=volume*.5;
   if(beat%4===0){this.note(55,t,.16,.11*g,'sine');this.note(110,t,.05,.025*g,'triangle');}
   if(beat%2===1)this.note(4100+(beat%3)*500,t,.025,.012*g,'square');
   const bass=[55,55,65.406,55,73.416,65.406,49,55][Math.floor(beat/2)];if(beat%2===0)this.note(bass,t,.13,.055*g,'sawtooth');
   if(s.depth>1&&beat%4===2)this.note(bass*4,t,.11,.025*g,'triangle');
   if(s.depth>3&&beat%2===0)this.note(bass*8,t,.06,.017*g,'sine');
   this.step++;this.next+=60/124/4;
  }
 }
 effect(kind,volume=.65){if(!this.ctx)return;const t=this.ctx.currentTime;const hz={shoot:210,impact:95,jump:330,coin:880,seal:660,hurt:65,shield:550,enemy:130,treasure:1046,cache:784,checkpoint:440,'boss-down':220}[kind];if(hz){this.note(hz,t,kind==='shoot'?.07:.16,(kind==='shoot'?.03:.06)*volume,kind==='hurt'?'sawtooth':kind==='shoot'?'square':'triangle');if(['seal','treasure','cache','boss-down'].includes(kind)){this.note(hz*1.25,t+.1,.2,.04*volume);this.note(hz*1.5,t+.2,.25,.03*volume);}}}
}

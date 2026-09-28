/** Short voiced/noise bursts, created only after a command or explicit voice opt-in. */
export class DogBarkAudio{
  private context?:AudioContext;private sources:AudioBufferSourceNode[]=[];
  async unlock(){this.context??=new AudioContext();if(this.context.state==='suspended')await this.context.resume();}
  async bark(){
    await this.unlock();const ctx=this.context!;this.stop();
    const buffer=ctx.createBuffer(1,Math.floor(ctx.sampleRate*.23),ctx.sampleRate),samples=buffer.getChannelData(0);let phase=0,seed=2183,low=0;
    for(let i=0;i<samples.length;i++){const t=i/ctx.sampleRate;seed=(seed*1664525+1013904223)>>>0;const noise=seed/4294967296*2-1;low+=.35*(noise-low);phase+=Math.PI*2*(175-65*t/.23)/ctx.sampleRate;const voice=Math.sin(phase)+.5*Math.sin(phase*2)+.25*Math.sin(phase*3);samples[i]=(voice*.28+low*.65)*Math.min(1,t/.012)*Math.exp(-t*18);}
    for(const offset of [0,.40,.86]){const source=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain();source.buffer=buffer;filter.type='bandpass';filter.frequency.value=780;filter.Q.value=.55;gain.gain.value=.36;source.connect(filter).connect(gain).connect(ctx.destination);source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();};source.start(ctx.currentTime+offset);this.sources.push(source);}
  }
  stop(){for(const source of this.sources){try{source.stop();}catch{}}this.sources=[];}
}

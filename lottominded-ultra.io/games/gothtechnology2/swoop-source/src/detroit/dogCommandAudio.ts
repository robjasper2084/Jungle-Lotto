/** Real large-dog recording (v23, CC0), triggered only by a player command. */
export class DogBarkAudio{
  private context?:AudioContext;private sources:AudioBufferSourceNode[]=[];private loading?:Promise<AudioBuffer>;private generation=0;
  async unlock(){this.context??=new AudioContext();if(this.context.state==='suspended')await this.context.resume();}
  async bark(){
    this.stop();const generation=this.generation;await this.unlock();const ctx=this.context!;
    this.loading??=fetch('/audio/nature/big-dog-bark.mp3').then(r=>{if(!r.ok)throw Error('Dog recording unavailable');return r.arrayBuffer();}).then(b=>ctx.decodeAudioData(b)).catch(e=>{this.loading=undefined;throw e;});
    const buffer=await this.loading;if(generation!==this.generation)return;
    for(const offset of [0,.46,.96]){const source=ctx.createBufferSource(),gain=ctx.createGain();source.buffer=buffer;source.playbackRate.value=offset===.46?.97:1;gain.gain.value=.64;source.connect(gain).connect(ctx.destination);source.onended=()=>{source.disconnect();gain.disconnect();this.sources=this.sources.filter(s=>s!==source);};source.start(ctx.currentTime+offset);this.sources.push(source);}
  }
  stop(){this.generation++;for(const source of this.sources){try{source.stop();}catch{}}this.sources=[];}
}

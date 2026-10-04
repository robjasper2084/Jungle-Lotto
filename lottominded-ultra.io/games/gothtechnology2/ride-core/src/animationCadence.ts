/** Reduce distant skeleton work without changing simulation or world movement. */
export class AnimationCadence {
  private elapsed=new Map<number,number>();
  reset(){this.elapsed.clear();}
  due(id:number,dt:number,distance:number){
    const previous=this.elapsed.get(id);
    if(previous===undefined){this.elapsed.set(id,0);return true;}
    if(dt<=0||!Number.isFinite(dt))return false;
    const interval=distance<25?0:distance<55?1/20:1/10;
    const elapsed=previous+Math.min(dt,.1);
    if(elapsed+1e-9>=interval){this.elapsed.set(id,interval?Math.max(0,elapsed-interval*Math.floor((elapsed+1e-9)/interval)):0);return true;}
    this.elapsed.set(id,elapsed);return false;
  }
}


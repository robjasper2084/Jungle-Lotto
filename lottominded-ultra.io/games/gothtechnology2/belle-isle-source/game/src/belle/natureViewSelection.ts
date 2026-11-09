/** Detail belongs to the view being rendered, not a different rider/ground
 * anchor. Retain the original near-count/radius/hysteresis in the selector.
 * Before the first camera is known, normal world preparation still primes the
 * original player-centered instances. Afterwards it must not rebuild them back
 * to the player immediately before every camera draw (especially in co-op).
 */
export class NatureViewSelection {
  private seenView=false;
  private readonly select:(x:number,z:number)=>void;
  constructor(select:(x:number,z:number)=>void){this.select=select;}
  prepare(x:number,z:number){
    if(!this.seenView&&Number.isFinite(x)&&Number.isFinite(z))this.select(x,z);
  }
  render(x:number,z:number){
    if(!Number.isFinite(x)||!Number.isFinite(z))return;
    this.seenView=true;this.select(x,z);
  }
}

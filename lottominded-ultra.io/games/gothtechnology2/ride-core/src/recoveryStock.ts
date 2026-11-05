/** Competitive retries are spent only after a recovery is accepted. */
export class RecoveryStock {
 used=0;
 get remaining(){return Math.max(0,3-this.used);}
 reset(){this.used=0;}
 consume(){if(!this.remaining)return false;this.used++;return true;}
}

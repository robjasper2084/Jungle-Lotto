import {clamp} from './rideDynamics.ts';
import {createGroundSample,type TerrainSampler} from './terrain.ts';
import type {RidePose} from './controller.ts';

/** Independent, fixed-step rider cues. Metres/seconds; no audio or render state. */
export class RideFeedback {
 private warningPhase=0;private warningWasOn=false;
 update(dt:number,p:RidePose,terrain:TerrainSampler,grounded:boolean,crashed:boolean,wheelScale=1){
  p.warningLevel=crashed||!grounded?0:clamp((Math.abs(p.speed)-17)/4.5,0,1);
  const on=p.warningLevel>0;
  if(on){
   if(!this.warningWasOn)this.warningPhase=0;
   const interval=1-.84*p.warningLevel;
   p.beepPulse=this.warningPhase<.085?1:0;
   this.warningPhase=(this.warningPhase+dt)%interval;
  }else{p.beepPulse=0;this.warningPhase=0;}
  this.warningWasOn=on;
  const contact=pedalContact(p,terrain,grounded&&!crashed,wheelScale);
  p.scrape=contact.intensity;p.scrapeSide=contact.side;
  p.scrapeX=contact.x;p.scrapeY=contact.y;p.scrapeZ=contact.z;p.scrapeHard=contact.hard?1:0;
 }
}

/** Four lower outer corners measured from DS_EUC_01_LOD1.glb. Same bank,
 * fore/aft pitch and rounded tyre support used by the render adapter. */
export function pedalContact(p:RidePose,terrain:TerrainSampler,enabled=true,wheelScale=1){
 let result={intensity:0,depth:0,side:0,x:p.x,y:p.y,z:p.z,hard:false};
 if(!enabled||Math.abs(p.speed)<.5)return result;
 const roll=p.rollAngle,g=p.groundRoll*.25,c=Math.cos(roll),s=Math.sin(roll),cx=Math.cos(p.wheelPitch),sx=Math.sin(p.wheelPitch),cg=Math.cos(g),sg=Math.sin(g);
 const rotate=(x:number,y:number,z:number)=>{const a=x*c+y*s,b=-x*s+y*c,by=b*cx-z*sx,bz=b*sx+z*cx;return{x:a*cg-by*sg,y:a*sg+by*cg,z:bz};};
 const axis=rotate(1,0,0),axle=rotate(0,.255,0),lift=wheelScale*(.185*Math.sqrt(Math.max(0,1-axis.y*axis.y))+.07-axle.y);
 const sample=createGroundSample();
 for(const side of [-1,1])for(const fore of [-.125,.125]){
  const corner=rotate(side*.273854*wheelScale,(.272604+p.suspensionOffset)*wheelScale,fore*wheelScale),x=p.x+corner.x*Math.cos(p.headingY)+corner.z*Math.sin(p.headingY),z=p.z-corner.x*Math.sin(p.headingY)+corner.z*Math.cos(p.headingY),y=p.y+corner.y+lift;
  terrain.sampleGround(x,z,sample,p.y);const depth=sample.height+.006-y;
  if(depth<=0||sample.offCourse)continue;
  const intensity=clamp(depth/.045,0,1)*clamp(Math.abs(p.speed)/3,0,1);
  if(intensity>result.intensity)result={intensity,depth,side,x,y:sample.height+.018,z,hard:['pavement','brick','metal'].includes(sample.surface)};
 }
 return result;
}


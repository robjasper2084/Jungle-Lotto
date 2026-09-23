import {pointOnCut,CUT_METRES} from './geography.ts';
import {toLocal} from './geo-profile.ts';
import {heightAt} from './world.ts';
/** Set back into the opposite vacant lots, with the door facing the Cut. */
export function destinationLayout(store=false){
 const p=pointOnCut(CUT_METRES),along=-38,offset=-32,scale=store?1:1.35;
 const forward={x:Math.sin(p.heading),z:Math.cos(p.heading)},right={x:-Math.cos(p.heading),z:Math.sin(p.heading)};
 let x=p.x+forward.x*along+right.x*offset,z=p.z+forward.z*along+right.z*offset,heading=Math.atan2(-right.x,right.z);
 if(store){
  // Opposite the gallery across the mapped Mack Avenue centreline.
  const gallery={x,z},street={x:2539.0019332725283,z:-1428.6489210254251};
  x=2*street.x-gallery.x;z=2*street.z-gallery.z;
  heading=Math.atan2(x-gallery.x,gallery.z-z);
 }
 const heights:number[]=[];for(const a of [-9*scale,9*scale])for(const b of [-10.5*scale,6*scale])heights.push(heightAt(x+Math.cos(heading)*a-Math.sin(heading)*b,z+Math.sin(heading)*a+Math.cos(heading)*b));
 const y=Math.max(...heights)+.015;
 return {scale,map:{x,y,z},local:toLocal(x,y,z),heading,foundationDepth:y-Math.min(...heights)+.15};
}

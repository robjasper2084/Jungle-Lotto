import {toLocal} from './geo-profile.ts';
import {heightAt} from './world.ts';
/** Set back into the opposite vacant lots, with the door facing the Cut. */
export function destinationLayout(store=false){
 // Fictional destinations on opposite sides of mapped Mack Avenue. Their
 // entrances share the same street station and face each other squarely.
 const scale=store?1:1.35,x=2539.0019332725283+(store?32:-32),z=-1428.6489210254251,heading=store?Math.PI/2:-Math.PI/2;
 const heights:number[]=[];for(const a of [-9*scale,9*scale])for(const b of [-10.5*scale,6*scale])heights.push(heightAt(x+Math.cos(heading)*a-Math.sin(heading)*b,z+Math.sin(heading)*a+Math.cos(heading)*b));
 const y=Math.max(...heights)+.015;
 return {scale,map:{x,y,z},local:toLocal(x,y,z),heading,foundationDepth:y-Math.min(...heights)+.15};
}

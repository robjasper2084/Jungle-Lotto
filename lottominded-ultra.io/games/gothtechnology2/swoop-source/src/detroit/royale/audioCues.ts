/** Camera-relative right/left bearing. No sound reveals actors absent from a snapshot. */
export function spatialCue(dx:number,dz:number,heading:number){const distance=Math.hypot(dx,dz);return {gain:distance>100?0:1/(1+distance/16),pan:Math.max(-.85,Math.min(.85,(dx*Math.cos(heading)-dz*Math.sin(heading))/Math.max(4,distance)))};}
export {wheelCue} from '../../../../ride-core/src/rideSoundCues.ts';

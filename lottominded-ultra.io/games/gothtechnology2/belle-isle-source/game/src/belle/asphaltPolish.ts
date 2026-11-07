/** Low-frequency, world-anchored repairs. No textures, geometry or collision changes.
 * All overlapping road fragments sample the same coordinates to avoid join flicker.
 * Detail fades when a repair is smaller than a pixel; this is not simulated wetness.
 */
export const ASPHALT_PATCH_DETAIL = `
 vec2 repairGrid=asphaltXZ/vec2(14.,19.);
 vec2 repairCell=floor(repairGrid),repairUv=fract(repairGrid);
 float repairSeed=fract(sin(dot(repairCell,vec2(127.1,311.7)))*43758.5453);
 vec2 repairCentre=vec2(.40+.15*fract(repairSeed*7.1),.42+.16*fract(repairSeed*11.3));
 vec2 repairHalf=vec2(.12+.13*fract(repairSeed*17.7),.09+.19*fract(repairSeed*23.1));
 vec2 repairEdge=repairHalf-abs(repairUv-repairCentre);
 vec2 repairAa=max(fwidth(repairGrid),vec2(.001));
 float repairShape=smoothstep(0.,repairAa.x*1.5,repairEdge.x)*smoothstep(0.,repairAa.y*1.5,repairEdge.y);
 float repairResolved=1.-smoothstep(.035,.12,max(repairAa.x,repairAa.y));
 float repairAmount=step(.77,repairSeed)*repairShape*repairResolved;
 diffuseColor.rgb*=1.-repairAmount*(.045+.055*repairSeed);
`;

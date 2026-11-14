/** Presentation-only decisions. Never writes physics, race records or sky state. */
export type HudPreset = 'exploration' | 'racing' | 'cinematic';
export function hudPreset(value: unknown): HudPreset {
  return value === 'racing' || value === 'cinematic' ? value : 'exploration';
}
export function cockpitScale(compact: boolean, width: number): number {
  return compact ? (Number.isFinite(width) && width < 600 ? .90 : .82) : 1;
}
export function clearanceWarning(height: number, speed: number, landed: boolean): boolean {
  return !landed && Number.isFinite(height) && Number.isFinite(speed)
    && height >= 0 && height < 1.4 && Math.abs(speed) > 10;
}
export const BELLE_SUNSET = Object.freeze({hour: 17.55, cycle: true, dayMinutes: 60, clouds: 'wispy' as const});
/** Derivative-filtered original lawn detail; no texture, mesh, shadow or collision work. */
export const LAWN_DETAIL = `
 float belleLawnFootprint=length(fwidth(terrainXZ));
 float belleLawnResolved=1.-smoothstep(.08,.48,belleLawnFootprint);
 float belleLawnGrain=fract(sin(dot(floor(terrainXZ*8.),vec2(31.17,73.91)))*43758.5453);
 float belleLawnPatch=.5+.5*sin(terrainXZ.x*.39+sin(terrainXZ.y*.24)*1.7);
 diffuseColor.rgb*=mix(vec3(.94,.97,.90),vec3(1.04,1.02,.96),belleLawnPatch);
 diffuseColor.rgb*=mix(1.,.94+.12*belleLawnGrain,belleLawnResolved);
`;

/**
 * Greater Detroit Simulation: portable photographic world standard.
 * No renderer, DOM, GL context or remote I/O. All effects are opt-in and gated.
 * All horizontal world directions use E/N/up before converting to local frames.
 */
export type District = 'belle-isle' | 'swoop-detroit' | 'elmwood';
export type GraphicsTier = 'mobile' | 'balanced' | 'cinematic';
export type Weather = 'clear' | 'cloudy' | 'rain' | 'mist';
export type Vec3 = Readonly<{ x: number; y: number; z: number }>;
export const DETROIT_REFERENCE = Object.freeze({ latitude: 42.3450366, date: '2026-09-15' });
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const finite = (n: number) => Number.isFinite(n);
const rad = Math.PI / 180;

export function validSolarDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const ms = Date.parse(date + 'T12:00:00Z');
  return Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 10) === date;
}
/** Approximate solar-hour direction, not local clock time or measured irradiance. */
export function geographicSun(date: string, solarHour: number, latitude = DETROIT_REFERENCE.latitude): Readonly<{east:number;north:number;up:number}> {
  if (!validSolarDate(date) || !finite(solarHour) || solarHour < 0 || solarHour > 24 || !finite(latitude) || Math.abs(latitude) > 90) {
    throw new RangeError('Invalid solar date, time, or latitude');
  }
  const ms = Date.parse(date + 'T12:00:00Z');
  const day = (ms - Date.UTC(new Date(ms).getUTCFullYear(), 0, 0)) / 86400000;
  const lat = latitude * rad;
  const dec = (23.44 * rad) * Math.sin(2 * Math.PI * (284 + day) / 365);
  const hourAngle = (solarHour - 12) * Math.PI / 12;
  const east = -Math.cos(dec) * Math.sin(hourAngle);
  const north = Math.cos(lat) * Math.sin(dec) - Math.sin(lat) * Math.cos(dec) * Math.cos(hourAngle);
  const up = Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(hourAngle);
  return {east, north, up};
}
/** The Swoop coordinate basis is rotated relative to east/north; it is not Belle Isle's axis layout. */
export function districtSun(district:District, date:string, solarHour:number):Vec3 {
  const v = geographicSun(date, solarHour);
  switch(district) {
    case 'belle-isle':
    case 'elmwood': return {x:v.east,y:v.up,z:-v.north};
    case 'swoop-detroit':return {x:-.5*v.east+Math.sqrt(3)/2*v.north,y:v.up,z:-Math.sqrt(3)/2*v.east-.5*v.north};
    default:throw new RangeError('Unknown Detroit district');
  }
}
/** Reference for color and exposure comparisons; existing weather systems remain authoritative until integrated. */
export function photographicLight(date:string,solarHour:number,weather:Weather='clear') {
  const sun=geographicSun(date,solarHour),day=clamp((sun.up+.06)/.65,0,1);
  const amount=weather==='clear'?1:weather==='cloudy'?.43:weather==='rain'?.20:.32;
  const amber=clamp((.30-sun.up)/.35,0,1)*day;
  return Object.freeze({daylight:day, sunIntensity:2.15*day*amount, ambientIntensity:(.23+.43*day)*(weather==='rain'?.75:1),
    exposure:.70+.22*day, sunWarmth:amber, fogDensity:weather==='mist'?.004:weather==='rain'?.0013:weather==='cloudy'?.00065:.00032});
}

export type PbrSourceKind = 'scan' | 'photo-derived' | 'procedural';
export type MapRole = 'baseColor' | 'normal' | 'roughness' | 'metalness' | 'occlusion';
export interface SurfaceAsset {
  district:District; name:string; sourceKind:PbrSourceKind; source:string; license:string;
  /** Source-image SHA-256 supplied by asset owner; syntax is checked, bytes are NOT hashed here. */
  sourceSha256:string; dielectric:boolean;
  maps:Partial<Record<MapRole,string>>;
}
const SHA256=/^[0-9a-f]{64}$/i;
export function auditSurfaceAsset(asset:SurfaceAsset):readonly string[] {
  const errors:string[]=[];
  if (!['belle-isle','swoop-detroit','elmwood'].includes(asset.district)) errors.push('Unknown district');
  if (!asset.name.trim()) errors.push('Missing material name');
  if (!['scan','photo-derived','procedural'].includes(asset.sourceKind)) errors.push('Unknown source kind');
  if (!asset.source.trim() || !asset.license.trim()) errors.push('Missing asset provenance or license');
  if (!SHA256.test(asset.sourceSha256)) errors.push('Missing well-formed source SHA-256');
  for (const slot of ['baseColor','normal','roughness'] as const) if (!asset.maps[slot]) errors.push('Missing '+slot+' map');
  if (asset.dielectric && asset.maps.metalness) errors.push('Dielectric surface should not use a metallic map');
  return Object.freeze(errors);
}
/** The caller owns the THREE textures and must not recolor existing shared atlases. */
export function expectedTextureColorSpace(role:MapRole):'srgb'|'linear' {
  return role==='baseColor'?'srgb':'linear';
}

export type DeviceContext=Readonly<{
  view:'desktop'|'mobile'|'xr';tier:GraphicsTier;views:number;
  /** Real pass installed and independently tested. */
  planarPassAvailable:boolean;ssrPassAvailable:boolean;volumePassAvailable:boolean;
  visibleRiver:boolean;riverDistanceM:number;measuredFrameMs?:number;
}>;
/** Policy only; this does not install a reflect/pass/volume in the game. */
export function cinematicEffects(device:DeviceContext) {
  if (!['desktop','mobile','xr'].includes(device.view)||!['mobile','balanced','cinematic'].includes(device.tier)||!Number.isInteger(device.views)||device.views<1||!finite(device.riverDistanceM)||device.riverDistanceM<0||device.measuredFrameMs!==undefined&&(!finite(device.measuredFrameMs)||device.measuredFrameMs<0)) throw new RangeError('Invalid graphics context');
  const cinematic=device.view==='desktop'&&device.tier==='cinematic'&&device.views===1;
  const frameOk=device.measuredFrameMs!==undefined&&device.measuredFrameMs>0&&device.measuredFrameMs<15;
  const planar=cinematic&&frameOk&&device.planarPassAvailable&&device.visibleRiver&&device.riverDistanceM<=220;
  return Object.freeze({
    planar,ssr:cinematic&&frameOk&&device.ssrPassAvailable,localVolumetrics:cinematic&&frameOk&&device.volumePassAvailable,
    planarResolution:planar?1024:0,planarRefreshHz:planar?12:0,
    targetFPS:device.view==='xr'?72:device.view==='mobile'?30:60,
    // No supported WebGL hardware RT/tessellation stages in these games.
    hardwareRayTracing:false,hardwareTessellation:false,
  });
}
export function lodTransition(distance:number,near:number,far:number) {
  if (![distance,near,far].every(finite)||near<0||far<=near)throw new RangeError('Invalid LOD distances');
  const t=clamp((distance-near)/(far-near),0,1);
  const farWeight=t*t*(3-2*t);
  return Object.freeze({nearWeight:1-farWeight,farWeight});
}
/** Pure telemetry utility. Does not claim to measure GPU time. */
export class FrameSampleWindow {
  private values:number[]=[];
  constructor(private readonly capacity=300){if(!Number.isInteger(capacity)||capacity<5||capacity>6000)throw new RangeError('Invalid telemetry size');}
  sample(frameMs:number){if(!finite(frameMs)||frameMs<=0)return;this.values.push(frameMs);if(this.values.length>this.capacity)this.values.shift();}
  get report(){const a=[...this.values].sort((x,y)=>x-y),avg=this.values.reduce((s,n)=>s+n,0)/Math.max(1,this.values.length);
    return Object.freeze({samples:a.length,meanFrameMs:avg,p95FrameMs:a.length?a[Math.min(a.length-1,Math.ceil(a.length*.95)-1)]:0,estimatedFPS:avg?1000/avg:0});}
}

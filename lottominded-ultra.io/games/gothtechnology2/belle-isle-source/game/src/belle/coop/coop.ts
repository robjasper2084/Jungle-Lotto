/** Two-player exploration foundation. Does not start networking or mutate solo saves.
 * Catalog pinned to PR138 source a7b8a5f; all paths are repository paths, NOT fetch URLs.
 * Runtime must resolve/copy approved assets at build time and validate each cloned rig.
 */
export const SOURCE_REVISION = 'a7b8a5f7eeefd093e8a81524736530e7c0f317f9';
export const SOURCE_ROOT = 'lottominded-ultra.io/games/gothtechnology2/';
export const RIDERS = [
  { id: 'DS_Man_01', label: 'Original suited man', blob: 'cdf539c8dcca5df9f32d312351f5fd87b4d095f3' },
  { id: 'DS_Hoodie_Woman_01', label: 'Detroit hoodie woman', blob: '977d93a4a4d5472a6ef3f3571ceaf86b3c0642af' },
  { id: 'DS_Mascot_Suit_01', label: 'Pinstripe mascot', blob: 'c276aca6fc2091c615eef5f9c94f5227b4866e58' },
  { id: 'DS_Mascot_Hoodie_01', label: 'Detroit hoodie mascot', blob: '6185c79842c7d0e170353442c3b08265a64583f9' },
  { id: 'DS_Armored_Rider_01', label: 'Night Sentinel', blob: '619941aed91149fcd7ebfd9446a7fd98a826300d' },
] as const;
export const VEHICLES = [
  { id: 'euc', label: 'Classic electric unicycle', adapter: 'RideCore', profile: null },
  { id: 'euc:city', label: 'City 16', adapter: 'RideCore', profile: 'city' },
  { id: 'euc:tour', label: 'Touring 18', adapter: 'RideCore', profile: 'tour' },
  { id: 'euc:trail', label: 'Trail 16', adapter: 'RideCore', profile: 'trail' },
  { id: 'euc:speed', label: 'Speed 22', adapter: 'RideCore', profile: 'speed' },
] as const;
// Existing HoverRide creates global singleton DOM/input/audio. It must be split into
// per-player adapters before two simultaneous hoverbikes can safely be offered.
export const DEFERRED_VEHICLES = ['hoverbike', 'bicycle', 'ebike:talaria', 'ebike:ultra', 'ebike:sr', 'ebike:varg'] as const;
export type RiderId = typeof RIDERS[number]['id'];
export type VehicleId = typeof VEHICLES[number]['id'];
export type Seat = 0 | 1;
export type Binding = 'wasd' | 'arrows' | 'pad:0' | 'pad:1' | 'pad:2' | 'pad:3';
export type Mode = 'local' | 'online';
export type Selection = { riderId: RiderId; vehicleId: VehicleId; binding: Binding };
export type Pair = [Selection, Selection];
export const BINDINGS: readonly Binding[] = ['wasd', 'arrows', 'pad:0', 'pad:1', 'pad:2', 'pad:3'];
const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const seatIndex = (seat: number): Seat => { if (seat !== 0 && seat !== 1) throw new Error('Exactly two player slots are supported.'); return seat; };
export function parseSelection(value: unknown): Selection | undefined {
  if (!isRecord(value)) return;
  const rider = RIDERS.find(r => r.id === value.riderId), vehicle = VEHICLES.find(v => v.id === value.vehicleId);
  if (!rider || !vehicle || !BINDINGS.includes(value.binding as Binding)) return;
  return { riderId: rider.id, vehicleId: vehicle.id, binding: value.binding as Binding };
}
export function defaultPair(): Pair {
  return [{riderId:'DS_Armored_Rider_01',vehicleId:'euc',binding:'wasd'}, {riderId:'DS_Hoodie_Woman_01',vehicleId:'euc:tour',binding:'arrows'}];
}
export type PlayerManifest = Readonly<{
  version: 1; seat: Seat; entityId: 'coop-p1' | 'coop-p2'; riderId: RiderId; vehicleId: VehicleId; binding: Binding;
  rider: Readonly<{ sourcePath: string; blob: string }>;
  controller: 'RideCore'; physicsProfile: string | null;
  profileSource: string; revision: string; requiresRigValidation: true;
}>;
/** IDs, not arbitrary URLs, cross the lobby/transport boundary. Never share a skeleton instance. */
export function assignPlayer(seat: Seat, value: unknown): PlayerManifest {
  seatIndex(seat); const choice = parseSelection(value);
  if (!choice) throw new Error('Unsupported rider, vehicle or input selection.');
  const rider = RIDERS.find(r => r.id === choice.riderId)!, vehicle = VEHICLES.find(v => v.id === choice.vehicleId)!;
  return Object.freeze({version:1, seat, entityId:seat === 0 ? 'coop-p1' : 'coop-p2', ...choice,
    rider:Object.freeze({sourcePath:SOURCE_ROOT+'swoop-source/public/exports/rigged-heroes/'+rider.id+'.glb', blob:rider.blob}),
    controller:'RideCore', physicsProfile:vehicle.profile,
    profileSource:SOURCE_ROOT+'swoop-source/src/detroit/electricVehicles.ts', revision:SOURCE_REVISION, requiresRigValidation:true});
}
export interface PreferenceStore { getItem(key: string): string | null; setItem(key: string, value: string): void }
export const PREF_KEY = 'belle-coop-loadout-v1';
export function loadPair(store?: PreferenceStore): Pair {
  const fallback = defaultPair();
  try {
    const value: unknown = JSON.parse(store?.getItem(PREF_KEY) ?? 'null');
    if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.players) || value.players.length !== 2) return fallback;
    const a = parseSelection(value.players[0]), b = parseSelection(value.players[1]);
    return [a ?? fallback[0], b ?? fallback[1]];
  } catch { return fallback; }
}
/** Preferences only: never save readiness, room credentials, remote IDs, poses or progress. */
export function savePair(store: PreferenceStore | undefined, pair: Pair): boolean {
  try {
    const players = pair.map(parseSelection); if (players.length !== 2 || players.some(p => !p) || !store) return false;
    store.setItem(PREF_KEY, JSON.stringify({version:1, players})); return true;
  } catch { return false; }
}
export type Pad = { index: number; id: string; connected: boolean; mapping: string; axes: readonly number[]; buttons: readonly {pressed: boolean; value: number}[] };
export function setupErrors(pair: Pair, mode: Mode, pads: readonly (Pad | null)[], transportAvailable = false): string[] {
  const errors: string[] = [];
  if (!Array.isArray(pair) || pair.length !== 2 || pair.some(p => !parseSelection(p))) return ['Two valid player selections are required.'];
  if (mode !== 'local' && mode !== 'online') return ['Unsupported session mode.'];
  if (mode === 'online') {
    // Remote choices/readiness need authenticated membership and a versioned room handshake.
    if (!transportAvailable) errors.push('Online co-op transport is not connected; local split-screen is not online multiplayer.');
    return errors;
  }
  if (pair[0].binding === pair[1].binding) errors.push('Each player needs a different keyboard layout or controller.');
  for (const [i, p] of pair.entries()) if (p.binding.startsWith('pad:')) {
    const index = Number(p.binding.slice(4)), pad = pads.find(p => p?.index === index);
    if (!pad?.connected || pad.mapping !== 'standard') errors.push(`Player ${i+1}: connect a standard-mapped controller in slot ${index+1}.`);
  }
  return errors;
}
export class CoopLobbyState {
  private pair: Pair; private revision = 0; private ready: [boolean, boolean] = [false, false];
  constructor(pair: Pair = defaultPair()) {
    const a = parseSelection(pair[0]), b = parseSelection(pair[1]);
    if (pair.length !== 2 || !a || !b) throw new Error('Invalid two-player loadout.'); this.pair = [a,b];
  }
  snapshot() { return {revision:this.revision, players:this.pair.map(p=>({...p})) as Pair, ready:[...this.ready] as [boolean,boolean]}; }
  select(seat: Seat, value: unknown) {
    const next = parseSelection(value); if (!next) throw new Error('Invalid player selection.');
    this.pair[seatIndex(seat)] = next; this.revision++; this.ready = [false,false];
  }
  setReady(seat: Seat, value: boolean, revision: number) {
    seatIndex(seat); if (revision !== this.revision || typeof value !== 'boolean') return false;
    this.ready[seat] = value; return true;
  }
  invalidate() { this.ready = [false,false]; this.revision++; }
  manifests() {
    if (!this.ready.every(Boolean)) throw new Error('Both players must confirm the current loadout.');
    return [assignPlayer(0,this.pair[0]),assignPlayer(1,this.pair[1])] as const;
  }
}
export type InputFrame = { throttle:number; steer:number; hop:boolean; recover:boolean; interact:boolean; brake:boolean };
const zero = (): InputFrame => ({throttle:0,steer:0,hop:false,recover:false,interact:false,brake:false});
const MAP = {wasd:['KeyW','KeyS','KeyA','KeyD','Space','KeyR','KeyF','ShiftLeft'],arrows:['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Enter','Slash','Period','ShiftRight']} as const;
const analog = (value: number) => !Number.isFinite(value) || Math.abs(value) <= .14 ? 0 : Math.sign(value)*Math.min(1,(Math.abs(value)-.14)/.86);
/** Per-player controls. A lost pad NEVER migrates the other pad into its seat. */
export class CoopInput {
  private armed = false; private padIdentity: string | undefined; private previous = zero();
  readonly binding: Binding;
  constructor(binding: Binding) { if (!BINDINGS.includes(binding)) throw new Error('Unknown binding.'); this.binding=binding; }
  reset() { this.armed=false; this.previous=zero(); this.padIdentity=undefined; }
  read(keys: ReadonlySet<string>, pads: readonly (Pad|null)[], blocked = false): InputFrame {
    if (blocked) { this.reset(); return zero(); }
    let raw = zero();
    if (this.binding === 'wasd' || this.binding === 'arrows') {
      const m = MAP[this.binding]; raw={throttle:Number(keys.has(m[0]))-Number(keys.has(m[1])),steer:Number(keys.has(m[3]))-Number(keys.has(m[2])),hop:keys.has(m[4]),recover:keys.has(m[5]),interact:keys.has(m[6]),brake:keys.has(m[7])};
    } else {
      const pad = pads.find(p=>p?.index===Number(this.binding.slice(4)));
      if (!pad?.connected || pad.mapping !== 'standard' || pad.axes.length < 2 || !Number.isFinite(pad.axes[0]) || !Number.isFinite(pad.axes[1])) { this.reset(); return zero(); }
      if (this.padIdentity !== pad.id) { this.reset(); this.padIdentity=pad.id; }
      const press=(i:number)=>pad.buttons[i]?.pressed===true;
      raw={throttle:(-analog(pad.axes[1])||0),steer:analog(pad.axes[0]),hop:press(0),recover:press(2),interact:press(3),brake:press(1)};
    }
    const neutral = (this.binding==='wasd'||this.binding==='arrows')
      ? MAP[this.binding].every(code=>!keys.has(code))
      : Object.values(raw).every(v=>v===0 || v===false);
    if (!this.armed) { if (neutral) this.armed=true; return zero(); }
    const result={...raw,hop:raw.hop&&!this.previous.hop,recover:raw.recover&&!this.previous.recover,interact:raw.interact&&!this.previous.interact};
    this.previous=raw; return result;
  }
}
export type Spawn = {x:number;y:number;z:number;heading:number};
export type Ground = (x:number,z:number)=>{height:number;land:boolean;blocked:boolean};
/** Bounded footprint probes. Throws rather than spawning over water or in a wall. */
export function findPairSpawns(anchor: Spawn, ground: Ground, radii: readonly [number,number] = [.75,.75]): [Spawn,Spawn] {
  if (![anchor.x,anchor.y,anchor.z,anchor.heading].every(Number.isFinite) || radii.length!==2 || radii.some(r=>!Number.isFinite(r)||r<=0||r>5)) throw new Error('Invalid spawn request.');
  const found: Spawn[]=[];
  for (let seat=0;seat<2;seat++) {
    const radius=radii[seat]; let picked: Spawn|undefined;
    for(let ring=0;ring<8&&!picked;ring++) for(let direction=0;direction<16&&!picked;direction++) {
      const angle=anchor.heading+direction*Math.PI/8, distance=ring===0?0:2+ring*2;
      const x=anchor.x+Math.sin(angle)*distance,z=anchor.z+Math.cos(angle)*distance;
      if(found.some((p,i)=>Math.hypot(x-p.x,z-p.z)<radius+radii[i]+.8))continue;
      const center=ground(x,z); if(!center.land||center.blocked||!Number.isFinite(center.height))continue;
      let safe=true;
      for(let i=0;i<8;i++){const a=i*Math.PI/4,p=ground(x+Math.sin(a)*radius,z+Math.cos(a)*radius);if(!p.land||p.blocked||!Number.isFinite(p.height)||Math.abs(p.height-center.height)>.45){safe=false;break;}}
      if(safe)picked={x,y:center.height,z,heading:anchor.heading};
    }
    if(!picked)throw new Error(`No safe non-overlapping spawn for Player ${seat+1}.`);
    found.push(picked);
  }
  return found as [Spawn,Spawn];
}
export type Rect = {x:number;y:number;width:number;height:number};
/** Pixel-perfect CSS view rectangles; renderer adapter converts top-left y to GL y. */
export function coopViewports(width:number,height:number): [Rect,Rect] {
  if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<2||height<2)throw new Error('Invalid viewport size.');
  if(width>=height){const w=Math.floor(width/2);return[{x:0,y:0,width:w,height},{x:w,y:0,width:width-w,height}];}
  const h=Math.floor(height/2);return[{x:0,y:0,width,height:h},{x:0,y:h,width,height:height-h}];
}
export function glViewport(rect:Rect,totalHeight:number): Rect { return {...rect,y:totalHeight-rect.y-rect.height}; }
export type PreparedActor = { /** Unique per-player controller/view identity. */ identity: object; validate:()=>boolean; dispose:()=>void };
/** Prepare OFF-SCENE; caller alone commits the pair into the shared scene.
 * Both actors must validate. Timeout/cancel/failure disposes all completed and late actors.
 * Never adds an animation loop, plays sound, or exposes half of a successful spawn.
 */
export async function preparePair(manifests: readonly [PlayerManifest,PlayerManifest],
  load:(manifest:PlayerManifest,signal:AbortSignal)=>Promise<PreparedActor>, signal:AbortSignal,
  timeoutMs=20000): Promise<readonly [PreparedActor,PreparedActor]> {
  if(!Number.isFinite(timeoutMs)||timeoutMs<1||timeoutMs>60000)throw new Error('Invalid prepare timeout.');
  if(manifests.length!==2||manifests[0].seat!==0||manifests[1].seat!==1)throw new Error('Invalid player manifest pair.');
  const ctl=new AbortController(), loaded:PreparedActor[]=[], disposed=new Set<PreparedActor>();
  const dispose=(actor:PreparedActor)=>{if(!disposed.has(actor)){disposed.add(actor);try{actor.dispose();}catch{/* Continue cleaning other actors. */}}};
  const cancel=()=>ctl.abort(signal.reason??new Error('Co-op preparation cancelled.'));
  signal.addEventListener('abort',cancel,{once:true}); if(signal.aborted)cancel();
  const timer=setTimeout(()=>ctl.abort(new Error('Co-op assets exceeded the preparation deadline.')),timeoutMs);
  let rejectAbort:(reason:unknown)=>void=()=>{};
  const aborted=new Promise<never>((_,reject)=>{rejectAbort=reject;});
  void aborted.catch(()=>{}); // Pre-aborted callers must not leave an unobserved rejection.
  const abort=()=>rejectAbort(ctl.signal.reason??new Error('Co-op preparation cancelled.'));
  ctl.signal.addEventListener('abort',abort,{once:true});if(ctl.signal.aborted)abort();
  try {
    if(ctl.signal.aborted)throw ctl.signal.reason;
    const canonical=[assignPlayer(0,manifests[0]),assignPlayer(1,manifests[1])] as const;
    const pair=await Promise.race([Promise.all(canonical.map(async manifest=>{
      const actor=await load(manifest,ctl.signal);
      if(ctl.signal.aborted){dispose(actor);throw ctl.signal.reason;}
      loaded.push(actor);if(!actor.validate())throw new Error(`Player ${manifest.seat+1} rig or mount validation failed.`);
      return actor;
    })),aborted]);
    if(pair[0]===pair[1]||pair[0].identity===pair[1].identity)throw new Error('Players cannot share a mutable actor or skeleton.');
    return pair as [PreparedActor,PreparedActor];
  } catch(error) { ctl.abort(error); for(const actor of loaded)dispose(actor); throw error;
  } finally { clearTimeout(timer);signal.removeEventListener('abort',cancel);ctl.signal.removeEventListener('abort',abort); }
}

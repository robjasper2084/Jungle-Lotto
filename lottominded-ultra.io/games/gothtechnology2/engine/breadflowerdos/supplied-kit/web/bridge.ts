/** Isolated BreadFlowerDos input bridge. NOT a movement, combat, or network engine. */
type NativeApi = {
  sr_abi_version(): number; sr_capabilities(): number; sr_slots(): number;
  sr_upstream_id(): number; sr_clear(slot: number): number;
  sr_set(slot: number, channel: number, value: number): number;
  sr_has(slot: number, channel: number): number;
  sr_get(slot: number, channel: number): number;
};
export const ActionChannels = Object.freeze({
  steer: 0, throttle: 3, aimYaw: 4, aimPitch: 5, fire: 8,
  hop: 9, use: 10, burst: 13, altFire: 31, crouch: 38,
});
// This application mapping is NEW code. Upstream calls channel 9 "PIAction", not "hop".
// Aim is normalized here; adapters must convert explicitly to their real angular units.
const integer = (n: number, max: number, label: string): void => {
  if (!Number.isInteger(n) || n < 0 || n >= max) throw new RangeError(`${label} out of range`);
};
const scalar = (n: number): void => {
  if (!Number.isFinite(n) || n < -1 || n > 1) throw new RangeError('Input must be finite and normalized to [-1, 1]');
};
export type InputEntry = readonly [channel: number, value: number];

export class BreadflowerInputBridge {
  private readonly api: NativeApi;
  constructor(instance: WebAssembly.Instance) {
    const names = ['sr_abi_version','sr_capabilities','sr_slots','sr_upstream_id','sr_clear','sr_set','sr_has','sr_get'];
    for (const name of names) if (typeof instance.exports[name] !== 'function') throw new Error(`Missing Wasm export: ${name}`);
    this.api = instance.exports as unknown as NativeApi;
    if (this.api.sr_abi_version() !== 1 || this.api.sr_capabilities() !== 1 || this.api.sr_slots() !== 6 || this.api.sr_upstream_id() !== 0x6b4d4e1f)
      throw new Error('Bridge ABI/provenance mismatch');
  }
  static async fromBytes(bytes: BufferSource): Promise<BreadflowerInputBridge> {
    const compiled = await WebAssembly.compile(bytes);
    return BreadflowerInputBridge.fromModule(compiled);
  }
  static fromModule(compiled: WebAssembly.Module): BreadflowerInputBridge {
    // Compiled code may be cached; instances and their mutable memory must not be shared between matches.
    return new BreadflowerInputBridge(new WebAssembly.Instance(compiled, {}));
  }
  static async fromURL(url: URL | string): Promise<BreadflowerInputBridge> {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Wasm load failed: HTTP ${response.status}`);
    return BreadflowerInputBridge.fromBytes(await response.arrayBuffer());
  }
  clear(slot: number): void {
    integer(slot, 6, 'Slot');
    if (this.api.sr_clear(slot) !== 1) throw new Error('Native input reset failed');
  }
  set(slot: number, channel: number, value: number): void {
    integer(slot, 6, 'Slot'); integer(channel, 64, 'Channel'); scalar(value);
    if (this.api.sr_set(slot, channel, value) !== 1) throw new Error('Native input write failed');
  }
  has(slot: number, channel: number): boolean {
    integer(slot, 6, 'Slot'); integer(channel, 64, 'Channel');
    const result = this.api.sr_has(slot, channel);
    if (result < 0) throw new Error('Native input lookup failed');
    return result === 1;
  }
  get(slot: number, channel: number): number {
    integer(slot, 6, 'Slot'); integer(channel, 64, 'Channel');
    const value = this.api.sr_get(slot, channel); scalar(value); return value;
  }
  writeFrame(slot: number, entries: readonly InputEntry[]): void {
    integer(slot, 6, 'Slot');
    if (entries.length > 64) throw new RangeError('Too many input channels');
    const seen = new Set<number>();
    // Validate the WHOLE frame first so malformed frames cannot clear a valid held input.
    for (const [channel, value] of entries) {
      integer(channel,64,'Channel'); scalar(value);
      if (seen.has(channel)) throw new Error('Duplicate input channel'); seen.add(channel);
    }
    this.clear(slot);
    for (const [channel,value] of entries) this.set(slot,channel,value);
  }
  snapshot(slot: number): InputEntry[] {
    integer(slot,6,'Slot'); const result: InputEntry[]=[];
    for(let c=0;c<64;c++) if(this.has(slot,c)) result.push([c,this.get(slot,c)]);
    return result; // Input state only, NOT a controller rollback snapshot.
  }
}

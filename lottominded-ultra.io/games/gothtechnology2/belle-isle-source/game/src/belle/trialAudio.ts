import type {TrialStorage} from './trialRecords.ts';

export const TRIAL_AUDIO_KEY = 'belle-isle-gate-sounds-v1';
export type TrialTone = {frequency: number; offset: number; duration: number; gain: number};

/** Short, bounded cues: a two-note checkpoint ping and a different finish chime. */
export function trialTones(finish = false): TrialTone[] {
  return (finish ? [880, 1108.73, 1318.51] : [880, 1320]).map((frequency, index) => ({
    frequency, offset: index * (finish ? .09 : .055), duration: finish ? .23 : .13, gain: finish ? .065 : .05,
  }));
}

function storage(): TrialStorage | null {
  try { return globalThis.localStorage ?? null; } catch { return null; }
}

function context(): AudioContext | undefined {
  const scope = globalThis as typeof globalThis & {webkitAudioContext?: typeof AudioContext};
  const Constructor = scope.AudioContext ?? scope.webkitAudioContext;
  return Constructor ? new Constructor() : undefined;
}

/** Opt-in UI feedback. Construction and playback never unlock audio automatically. */
export class TrialAudio {
  enabled = false;
  status = 'Gate sounds are off. Enable to hear a preview.';
  private readonly storage: TrialStorage | null;
  private readonly createContext: () => AudioContext | undefined;
  private readonly changed: () => void;
  private context?: AudioContext;
  private master?: GainNode;
  private readonly voices = new Set<{source: OscillatorNode; gain: GainNode}>();
  private cueGeneration = 0;

  constructor(options: {storage?: TrialStorage | null; createContext?: () => AudioContext | undefined; changed?: () => void} = {}) {
    this.storage = options.storage === undefined ? storage() : options.storage;
    this.createContext = options.createContext ?? context;
    this.changed = options.changed ?? (() => {});
    try { this.enabled = this.storage?.getItem(TRIAL_AUDIO_KEY) === 'on'; } catch { /* Session-only preference. */ }
    if (this.enabled) this.status = 'Gate sounds enabled. Start a course to activate audio.';
  }

  /** Call directly from the course/start/sound button's user gesture. */
  async unlock(preview = false): Promise<boolean> {
    if (!this.enabled) return false;
    const generation = this.cueGeneration;
    try {
      if (!this.context) {
        this.context = this.createContext();
        if (!this.context) throw new Error('Web Audio unavailable');
        this.master = this.context.createGain();
        this.master.gain.value = .7;
        this.master.connect(this.context.destination);
      }
      await this.context.resume();
      if (!this.enabled || this.context.state !== 'running') return false;
      this.status = 'Gate sounds on · Sky Circuit checkpoints and finish.';
      if (preview && generation === this.cueGeneration) this.checkpoint();
      this.changed();
      return true;
    } catch {
      this.status = 'Audio could not start. Toggle gate sounds off and on to retry.';
      this.changed();
      return false;
    }
  }

  setEnabled(value: boolean): Promise<boolean> {
    this.enabled = value;
    try { this.storage?.setItem(TRIAL_AUDIO_KEY, value ? 'on' : 'off'); } catch { /* Keep the current visit usable. */ }
    if (!value) {
      this.silence(); this.status = 'Gate sounds are off. Enable to hear a preview.'; this.changed();
      return Promise.resolve(false);
    }
    this.status = 'Starting gate sounds…'; this.changed();
    return this.unlock(true);
  }

  checkpoint(finish = false) {
    const c = this.context, master = this.master;
    if (!this.enabled || !c || !master || c.state !== 'running') return;
    // A finish replaces the previous ping; rapid crossings never accumulate voices.
    this.silence();
    for (const tone of trialTones(finish)) {
      const source = c.createOscillator(), gain = c.createGain(), start = c.currentTime + tone.offset;
      source.type = 'sine'; source.frequency.value = tone.frequency;
      gain.gain.setValueAtTime(.0001, start);
      gain.gain.linearRampToValueAtTime(tone.gain, start + .008);
      gain.gain.exponentialRampToValueAtTime(.0001, start + tone.duration);
      source.connect(gain); gain.connect(master);
      const voice = {source, gain}; this.voices.add(voice);
      source.onended = () => { this.voices.delete(voice); source.disconnect(); gain.disconnect(); };
      source.start(start); source.stop(start + tone.duration + .01);
    }
  }

  silence() {
    this.cueGeneration++;
    for (const {source, gain} of this.voices) {
      try { source.stop(); } catch { /* Already ended. */ }
      source.disconnect(); gain.disconnect();
    }
    this.voices.clear();
  }

  capture() {
    const c = this.context, master = this.master;
    if (!c || !master) return;
    const output = c.createMediaStreamDestination(); master.connect(output);
    return {stream: output.stream, release: () => { master.disconnect(output); output.stream.getTracks().forEach(track => track.stop()); }};
  }
}

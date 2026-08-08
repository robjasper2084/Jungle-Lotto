export function createTriviaAudio() {
  let context = null;
  let enabled = false;

  function ensureContext() {
    if (!context) {
      const AudioContext = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (AudioContext) context = new AudioContext();
    }
    if (context?.state === "suspended") context.resume().catch(() => {});
    return context;
  }

  function tone({ frequency = 440, duration = 0.08, type = "sine", gain = 0.025, offset = 0 } = {}) {
    if (!enabled) return;
    const active = ensureContext();
    if (!active) return;
    const oscillator = active.createOscillator();
    const volume = active.createGain();
    const startsAt = active.currentTime + offset;
    const endsAt = startsAt + duration;
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, startsAt);
    volume.gain.setValueAtTime(0.0001, startsAt);
    volume.gain.exponentialRampToValueAtTime(gain, startsAt + 0.012);
    volume.gain.exponentialRampToValueAtTime(0.0001, endsAt);
    oscillator.connect(volume).connect(active.destination);
    oscillator.start(startsAt);
    oscillator.stop(endsAt + 0.01);
  }

  return Object.freeze({
    get enabled() { return enabled; },
    setEnabled(value) {
      enabled = Boolean(value);
      if (enabled) {
        ensureContext();
        tone({ frequency: 528, duration: 0.12, type: "triangle", gain: 0.02 });
      }
      return enabled;
    },
    select() { tone({ frequency: 420, duration: 0.045, type: "square", gain: 0.012 }); },
    correct() {
      tone({ frequency: 528, duration: 0.09, type: "triangle" });
      tone({ frequency: 792, duration: 0.16, type: "triangle", offset: 0.08 });
    },
    incorrect() {
      tone({ frequency: 180, duration: 0.16, type: "sawtooth", gain: 0.018 });
      tone({ frequency: 120, duration: 0.18, type: "sawtooth", gain: 0.014, offset: 0.1 });
    },
    vault() {
      [220, 330, 440, 660].forEach((frequency, index) => tone({ frequency, duration: 0.2, type: "triangle", gain: 0.018, offset: index * 0.07 }));
    },
    stop() {
      context?.close().catch(() => {});
      context = null;
      enabled = false;
    },
  });
}

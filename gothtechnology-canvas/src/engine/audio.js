export class WebAudioBus {
  constructor(musicUrl = "") {
    this.ctx = null;
    this.muted = false;
    this.musicUrl = musicUrl;
    this.music = null;
    this.musicStarted = false;
  }

  ensure() {
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) this.ctx = new AudioContext();
    }
    if (this.ctx?.state === "suspended") this.ctx.resume?.();
    this.startMusic();
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.music) {
      this.music.muted = this.muted;
      if (this.muted) this.music.pause();
      else this.startMusic();
    }
  }

  startMusic() {
    if (!this.musicUrl || this.muted) return;
    if (!this.music) {
      this.music = new Audio(this.musicUrl);
      this.music.loop = true;
      this.music.preload = "auto";
      this.music.volume = 0.68;
      this.music.muted = this.muted;
    }
    if (this.musicStarted && !this.music.paused) return;
    this.musicStarted = true;
    this.music.play().catch(() => {
      this.musicStarted = false;
    });
  }

  beep(type = "hit") {
    if (this.muted) return;
    this.ensure();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const settings = {
      hit: [190, 0.12, "square", 0.08],
      block: [320, 0.1, "triangle", 0.05],
      select: [520, 0.08, "sine", 0.04],
      special: [120, 0.26, "sawtooth", 0.07],
      super: [75, 0.42, "sawtooth", 0.09],
      ko: [55, 0.8, "triangle", 0.11]
    }[type] ?? [240, 0.1, "sine", 0.05];
    osc.type = settings[2];
    osc.frequency.setValueAtTime(settings[0], now);
    osc.frequency.exponentialRampToValueAtTime(settings[0] * 2.4, now + settings[1]);
    gain.gain.setValueAtTime(settings[3], now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + settings[1]);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + settings[1]);
  }
}

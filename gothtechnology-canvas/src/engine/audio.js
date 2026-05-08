export class WebAudioBus {
  constructor(musicUrls = "") {
    this.ctx = null;
    this.muted = false;
    this.musicUrls = typeof musicUrls === "string"
      ? { menu: musicUrls, fight: musicUrls }
      : { menu: musicUrls.menu ?? "", fight: musicUrls.fight ?? musicUrls.menu ?? "" };
    this.music = null;
    this.musicTracks = {};
    this.musicStarted = false;
    this.musicMode = "silent";
    this.pendingMode = "menu";
  }

  ensure() {
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) this.ctx = new AudioContext();
    }
    if (this.ctx?.state === "suspended") this.ctx.resume?.();
    this.preloadMusic("menu");
    this.preloadMusic("fight");
    if (this.pendingMode !== "silent") this.startMusic(this.pendingMode);
  }

  toggleMute() {
    this.muted = !this.muted;
    for (const track of Object.values(this.musicTracks)) {
      track.muted = this.muted;
      if (this.muted) track.pause();
    }
    if (this.music) {
      if (this.muted) this.musicStarted = false;
      else if (this.pendingMode !== "silent") this.startMusic(this.pendingMode);
    }
  }

  preloadMusic(mode = "menu") {
    const url = this.musicUrls[mode] ?? this.musicUrls.menu;
    if (!url) return null;
    if (!this.musicTracks[mode]) {
      const track = new Audio(url);
      track.loop = true;
      track.preload = "auto";
      track.volume = mode === "fight" ? 0.74 : 0.5;
      track.muted = this.muted;
      track.load?.();
      this.musicTracks[mode] = track;
    }
    return this.musicTracks[mode];
  }

  startMusic(mode = "menu", options = {}) {
    this.pendingMode = mode;
    if (this.muted) return;
    const nextMusic = this.preloadMusic(mode);
    if (!nextMusic) return;
    if (this.music && this.music !== nextMusic) {
      this.music.pause();
      try {
        this.music.currentTime = 0;
      } catch (error) {
        // Some browsers reject currentTime changes before metadata arrives.
      }
      this.musicStarted = false;
    }
    this.music = nextMusic;
    const restart = Boolean(options.restart);
    if (restart) {
      try {
        this.music.currentTime = 0;
      } catch (error) {
        // Some browsers reject currentTime changes before metadata arrives.
      }
    }
    this.music.volume = mode === "fight" ? 0.74 : 0.5;
    if (this.musicStarted && !this.music.paused && this.musicMode === mode && !restart) return;
    this.musicMode = mode;
    this.musicStarted = true;
    this.music.play().catch(() => {
      this.musicStarted = false;
    });
  }

  stopMusic(options = {}) {
    this.pendingMode = "silent";
    const track = this.music;
    if (!track) return;
    track.pause();
    this.musicStarted = false;
    this.musicMode = "silent";
    if (options.reset) {
      try {
        track.currentTime = 0;
      } catch (error) {
        // Ignore metadata timing on mobile browsers.
      }
    }
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

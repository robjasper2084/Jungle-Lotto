(() => {
  const revealEls = document.querySelectorAll("[data-cinematic-reveal]");
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) {
    revealEls.forEach((el) => el.classList.add("is-visible"));
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-visible");
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });

  revealEls.forEach((el, index) => {
    el.style.transitionDelay = `${Math.min(index * 55, 260)}ms`;
    observer.observe(el);
  });

  const eqPanels = Array.from(document.querySelectorAll("[data-live-eq]"));
  const eqBars = eqPanels.flatMap((panel) => Array.from(panel.querySelectorAll(".live-eq-meter i")));
  const eqStatuses = Array.from(document.querySelectorAll("[data-eq-status]"));
  const knobButtons = Array.from(document.querySelectorAll("[data-fx-control]"));
  const featureTrack = document.querySelector("[data-feature-entry-track]");
  const player = document.querySelector("[data-feature-live-player]");
  const playerToggle = player?.querySelector("[data-feature-player-toggle]");
  const playerPrev = player?.querySelector("[data-feature-player-prev]");
  const playerNext = player?.querySelector("[data-feature-player-next]");
  const playerTime = player?.querySelector("[data-feature-player-time]");
  const isHealingGenerator = Boolean(player?.matches("[data-healing-frequency-generator]"));
  const healingToneButtons = Array.from(player?.querySelectorAll("[data-healing-tone]") || []);
  const healingHz = player?.querySelector("[data-healing-hz]");
  const healingTitle = player?.querySelector("[data-healing-title]");
  const healingDesc = player?.querySelector("[data-healing-desc]");
  const healingOutput = player?.querySelector("[data-healing-output]");
  const healingState = player?.querySelector("[data-healing-state]");
  const healingPresets = healingToneButtons.map((button, index) => ({
    button,
    hz: Number(button.dataset.healingTone || 528),
    label: button.dataset.healingLabel || "Reset",
    hue: [190, 176, 160, 48, 184, 270][index % 6],
  }));
  const maxEntryLoops = 2;
  let completedEntryLoops = 0;
  let audioCtx = null;
  let analyser = null;
  let master = null;
  let effectInput = null;
  let driveInput = null;
  let driveNode = null;
  let toneFilter = null;
  let bassFilter = null;
  let midFilter = null;
  let highFilter = null;
  let dryGain = null;
  let delayNode = null;
  let delayFeedback = null;
  let delayWet = null;
  let reverbNode = null;
  let reverbWet = null;
  let limiter = null;
  let eqData = null;
  let eqFrame = 0;
  let idlePhase = 0;
  let visualImpulse = 0;
  let lastBeatPaintAt = 0;
  let lastEqSnapshot = { average: 0, bass: 0, mid: 0, high: 0 };
  let healingIndex = Math.max(0, healingPresets.findIndex((preset) => preset.hz === 528));
  let healingVoice = null;
  let healingActive = false;
  const featureEntryVolume = 0.12;
  const featureManualVolume = 0.38;
  const mediaSources = new WeakSet();
  const fxState = { drive: 0.14, reverb: 0.2, delay: 0.16, master: 0.56 };

  function setEqStatus(text) {
    eqStatuses.forEach((status) => {
      status.textContent = text;
    });
    document.body.dataset.featureEqStatus = text;
  }

  function clampFxValue(value) {
    return Math.max(0, Math.min(1, Number(value) || 0));
  }

  function makeDriveCurve(amount = 0) {
    const samples = 512;
    const curve = new Float32Array(samples);
    const drive = 1 + amount * 34;
    const normal = Math.tanh(drive);
    for (let index = 0; index < samples; index += 1) {
      const x = (index * 2) / samples - 1;
      curve[index] = Math.tanh(x * drive) / normal;
    }
    return curve;
  }

  function buildImpulseResponse(ctx) {
    const duration = 1.35;
    const length = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let channel = 0; channel < impulse.numberOfChannels; channel += 1) {
      const data = impulse.getChannelData(channel);
      for (let index = 0; index < length; index += 1) {
        const decay = Math.pow(1 - index / length, 2.35);
        data[index] = (Math.random() * 2 - 1) * decay;
      }
    }
    return impulse;
  }

  function syncKnobControls(label = "") {
    const labels = { drive: "Drive", reverb: "Reverb", delay: "Delay", master: "Master" };
    knobButtons.forEach((button) => {
      const name = button.dataset.fxControl;
      const value = fxState[name] ?? 0;
      button.dataset.fxValue = value.toFixed(2);
      button.dataset.fxReadout = `${Math.round(value * 100)}%`;
      button.style.setProperty("--knob-fx", value.toFixed(3));
      button.setAttribute("aria-pressed", String(value > 0.05));
      button.setAttribute("aria-valuemin", "0");
      button.setAttribute("aria-valuemax", "100");
      button.setAttribute("aria-valuenow", String(Math.round(value * 100)));
      button.title = `${labels[name] || "Effect"} ${Math.round(value * 100)}%`;
    });
    document.body.dataset.featureFxDrive = fxState.drive.toFixed(2);
    document.body.dataset.featureFxReverb = fxState.reverb.toFixed(2);
    document.body.dataset.featureFxDelay = fxState.delay.toFixed(2);
    document.body.dataset.featureFxMaster = fxState.master.toFixed(2);
    if (label) setEqStatus(label);
  }

  function applyFxState(label = "") {
    if (audioCtx) {
      const now = audioCtx.currentTime;
      driveInput?.gain.setTargetAtTime(1 + fxState.drive * 3.8, now, 0.03);
      if (driveNode) {
        driveNode.curve = makeDriveCurve(fxState.drive);
        driveNode.oversample = "4x";
      }
      dryGain?.gain.setTargetAtTime(0.92 - fxState.delay * 0.12 - fxState.reverb * 0.1, now, 0.05);
      bassFilter?.gain.setTargetAtTime(0.4 + fxState.drive * 3.8, now, 0.04);
      midFilter?.gain.setTargetAtTime(-1.2 + fxState.reverb * 1.4 - fxState.drive * 0.8, now, 0.04);
      highFilter?.gain.setTargetAtTime(0.5 + fxState.delay * 2.7 - fxState.drive * 2.2, now, 0.04);
      toneFilter?.frequency.setTargetAtTime(15000 - fxState.drive * 9400, now, 0.04);
      toneFilter?.Q.setTargetAtTime(0.45 + fxState.drive * 6.8, now, 0.04);
      delayNode?.delayTime.setTargetAtTime(0.06 + fxState.delay * 0.48, now, 0.04);
      delayFeedback?.gain.setTargetAtTime(fxState.delay * 0.58, now, 0.04);
      delayWet?.gain.setTargetAtTime(fxState.delay * 0.48, now, 0.04);
      reverbWet?.gain.setTargetAtTime(fxState.reverb * 0.66, now, 0.04);
      master?.gain.setTargetAtTime(0.22 + fxState.master * 0.52, now, 0.04);
    }
    syncKnobControls(label);
  }

  function setFxControlValue(name, value, labelPrefix = "") {
    if (!name || !(name in fxState)) return false;
    getContext();
    fxState[name] = clampFxValue(value);
    const label = `${labelPrefix}${name.charAt(0).toUpperCase()}${name.slice(1)} ${Math.round(fxState[name] * 100)}%`;
    applyFxState(label);
    visualImpulse = Math.max(visualImpulse, 0.78);
    startEqRender();
    return true;
  }

  function nudgeFxControl(name) {
    if (!name || !(name in fxState)) return;
    const step = name === "master" ? 0.08 : 0.12;
    if (name === "master") {
      setFxControlValue(name, fxState.master >= 0.98 ? 0.36 : fxState.master + step);
    } else {
      setFxControlValue(name, fxState[name] >= 0.98 ? 0 : fxState[name] + step);
    }
  }


  function formatMediaTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return "--:--";
    const minutes = Math.floor(seconds / 60);
    const remaining = Math.floor(seconds % 60);
    return `${minutes}:${String(remaining).padStart(2, "0")}`;
  }

  function syncPlayerUi() {
    const preset = getHealingPreset();
    if (!featureTrack && !isHealingGenerator) return;
    const duration = featureTrack && Number.isFinite(featureTrack.duration) ? featureTrack.duration : 0;
    const progress = featureTrack && duration ? Math.min(1, Math.max(0, featureTrack.currentTime / duration)) : (healingActive ? 1 : 0);
    const isPlaying = isHealingGenerator ? healingActive : Boolean(featureTrack && !featureTrack.paused && !featureTrack.ended);
    if (player) {
      player.style.setProperty("--player-progress", progress.toFixed(3));
      player.classList.toggle("is-playing", isPlaying);
    }
    if (playerToggle) {
      playerToggle.innerHTML = isPlaying ? "II" : "&#9654;";
      playerToggle.setAttribute("aria-pressed", String(isPlaying));
      if (isHealingGenerator && preset) {
        playerToggle.setAttribute("aria-label", isPlaying ? `Pause ${preset.hz} Hz ${preset.label}` : `Start ${preset.hz} Hz ${preset.label}`);
      }
    }
    if (playerTime) {
      playerTime.textContent = isHealingGenerator && preset
        ? `${preset.hz} Hz / ${isPlaying ? "active" : "ready"}`
        : `${formatMediaTime(featureTrack?.currentTime || 0)} / ${formatMediaTime(duration)}`;
    }
    syncHealingUi();
  }

  function setBeatVars(energy = 0, bass = 0) {
    const root = document.body;
    root.classList.toggle("is-feature-beat-active", energy > 0.035 || bass > 0.035);
    root.style.setProperty("--feature-beat-energy", energy.toFixed(3));
    root.style.setProperty("--feature-beat-bass", bass.toFixed(3));
    root.style.setProperty("--feature-video-opacity-a", (0.13 + energy * 0.12).toFixed(3));
    root.style.setProperty("--feature-video-opacity-b", (0.08 + energy * 0.1).toFixed(3));
  }

  function resetBeatVars() {
    setBeatVars(0, 0);
    lastBeatPaintAt = 0;
  }
  function getContext() {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    audioCtx = audioCtx || new AudioCtx();
    if (audioCtx.state === "suspended") audioCtx.resume().catch(() => {});

    if (!analyser) {
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.78;
      eqData = new Uint8Array(analyser.frequencyBinCount);
      analyser.connect(audioCtx.destination);
    }

    if (!effectInput) {
      effectInput = audioCtx.createGain();
      driveInput = audioCtx.createGain();
      driveNode = audioCtx.createWaveShaper();
      toneFilter = audioCtx.createBiquadFilter();
      bassFilter = audioCtx.createBiquadFilter();
      midFilter = audioCtx.createBiquadFilter();
      highFilter = audioCtx.createBiquadFilter();
      dryGain = audioCtx.createGain();
      delayNode = audioCtx.createDelay(0.8);
      delayFeedback = audioCtx.createGain();
      delayWet = audioCtx.createGain();
      reverbNode = audioCtx.createConvolver();
      reverbWet = audioCtx.createGain();
      master = audioCtx.createGain();
      limiter = audioCtx.createDynamicsCompressor();

      toneFilter.type = "lowpass";
      bassFilter.type = "lowshelf";
      bassFilter.frequency.value = 150;
      midFilter.type = "peaking";
      midFilter.frequency.value = 860;
      midFilter.Q.value = 0.9;
      highFilter.type = "highshelf";
      highFilter.frequency.value = 4100;
      dryGain.gain.value = 0.92;
      delayWet.gain.value = 0;
      delayFeedback.gain.value = 0;
      reverbWet.gain.value = 0;
      limiter.threshold.value = -18;
      limiter.knee.value = 24;
      limiter.ratio.value = 8;
      limiter.attack.value = 0.006;
      limiter.release.value = 0.18;
      reverbNode.buffer = buildImpulseResponse(audioCtx);

      effectInput.connect(driveInput);
      driveInput.connect(driveNode);
      driveNode.connect(toneFilter);
      toneFilter.connect(bassFilter);
      bassFilter.connect(midFilter);
      midFilter.connect(highFilter);
      highFilter.connect(dryGain);
      dryGain.connect(master);
      highFilter.connect(delayNode);
      delayNode.connect(delayFeedback);
      delayFeedback.connect(delayNode);
      delayNode.connect(delayWet);
      delayWet.connect(master);
      highFilter.connect(reverbNode);
      reverbNode.connect(reverbWet);
      reverbWet.connect(master);
      master.connect(limiter);
      limiter.connect(analyser);
      applyFxState();
    }

    return audioCtx;
  }

  function getOutput() {
    return getContext() ? effectInput : null;
  }

  function getHealingPreset() {
    if (!healingPresets.length) return null;
    return healingPresets[(healingIndex + healingPresets.length) % healingPresets.length];
  }

  function syncHealingUi() {
    if (!isHealingGenerator) return;
    const preset = getHealingPreset();
    if (!preset || !player) return;
    healingToneButtons.forEach((button, index) => {
      const isActive = index === healingIndex;
      button.classList.toggle("is-selected", isActive);
      button.setAttribute("aria-pressed", String(isActive));
    });
    player.dataset.healingActive = String(healingActive);
    player.dataset.healingFrequency = String(preset.hz);
    player.style.setProperty("--healing-hue", String(preset.hue));
    player.style.setProperty("--healing-energy", healingActive ? "1" : "0");
    if (healingHz) healingHz.textContent = String(preset.hz);
    if (healingTitle) healingTitle.textContent = `${preset.hz} Hz ${preset.label}`;
    if (healingDesc) healingDesc.textContent = healingActive ? "Generated tone active" : "Tap Play to start a pure tone";
    if (healingOutput) healingOutput.textContent = preset.label.split(" ")[0];
    if (healingState) healingState.textContent = healingActive ? "Tone Active" : "Tap Play";
  }

  function selectHealingPreset(index, { restart = false } = {}) {
    if (!healingPresets.length) return;
    healingIndex = (index + healingPresets.length) % healingPresets.length;
    if (restart || healingActive) startHealingTone({ restart: true });
    syncHealingUi();
    syncPlayerUi();
  }

  function stopHealingTone({ sync = true } = {}) {
    if (!healingVoice || !audioCtx) {
      healingVoice = null;
      healingActive = false;
      if (sync) syncHealingUi();
      return;
    }
    const now = audioCtx.currentTime;
    healingVoice.gain.gain.cancelScheduledValues(now);
    healingVoice.gain.gain.setTargetAtTime(0.0001, now, 0.08);
    healingVoice.oscillators.forEach((oscillator) => {
      try {
        oscillator.stop(now + 0.34);
      } catch {
        // The voice may already be stopped.
      }
    });
    healingVoice = null;
    healingActive = false;
    if (sync) syncHealingUi();
  }

  function startHealingTone({ restart = false } = {}) {
    const preset = getHealingPreset();
    if (!isHealingGenerator || !preset) return false;
    const output = getOutput();
    if (!audioCtx || !output) {
      healingVoice = null;
      healingActive = true;
      visualImpulse = Math.max(visualImpulse, 0.86);
      setEqStatus(`${preset.hz} Hz ${preset.label}`);
      startEqRender();
      syncHealingUi();
      return true;
    }
    if (restart) stopHealingTone({ sync: false });
    if (healingVoice) {
      healingActive = true;
      syncHealingUi();
      return true;
    }

    try {
      if (audioCtx.state === "suspended") audioCtx.resume().catch(() => {});
      const now = audioCtx.currentTime;
      const gain = audioCtx.createGain();
      const filter = audioCtx.createBiquadFilter();
      const body = audioCtx.createOscillator();
      const low = audioCtx.createOscillator();
      const shimmer = audioCtx.createOscillator();

      body.type = "sine";
      low.type = "triangle";
      shimmer.type = "sine";
      body.frequency.setValueAtTime(preset.hz, now);
      low.frequency.setValueAtTime(Math.max(44, preset.hz / 2), now);
      shimmer.frequency.setValueAtTime(preset.hz * 2, now);
      shimmer.detune.setValueAtTime(4, now);
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(Math.min(6200, 1800 + preset.hz * 4), now);
      filter.Q.setValueAtTime(0.72, now);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.038, now + 0.18);

      body.connect(filter);
      low.connect(filter);
      shimmer.connect(filter);
      filter.connect(gain);
      gain.connect(output);
      [body, low, shimmer].forEach((oscillator) => oscillator.start(now));
      healingVoice = { oscillators: [body, low, shimmer], gain };
      healingActive = true;
      visualImpulse = Math.max(visualImpulse, 0.86);
      setEqStatus(`${preset.hz} Hz ${preset.label}`);
      startEqRender();
      syncHealingUi();
      return true;
    } catch {
      healingActive = false;
      syncHealingUi();
      return false;
    }
  }

  function connectPlayableMedia(media) {
    if (!media || mediaSources.has(media)) return;
    if (media !== featureTrack && (media.muted || media.volume === 0)) return;
    const ctx = getContext();
    if (!ctx || !analyser) return;

    try {
      const output = getOutput();
      if (!output) return;
      const source = ctx.createMediaElementSource(media);
      source.connect(output);
      mediaSources.add(media);
      if (media === featureTrack) document.body.dataset.featureTrackConnected = "true";
      setEqStatus("Media linked");
    } catch {
      mediaSources.add(media);
    }
  }

  function scanPageMedia() {
    if (document.hidden) return;
    document.querySelectorAll("audio, video").forEach((media) => {
      if (!media.paused && !media.muted && media.volume > 0) connectPlayableMedia(media);
    });
  }


  async function startFeatureTrack({ restart = false, entry = false } = {}) {
    if (!featureTrack) return false;
    const ctx = getContext();
    if (!ctx) return false;
    connectPlayableMedia(featureTrack);
    if (restart) {
      completedEntryLoops = 0;
      try {
        featureTrack.currentTime = 0;
      } catch {
        // Metadata may not be ready yet.
      }
    }
    try {
      if (ctx.state === "suspended") await ctx.resume();
    } catch {
      // Browsers can require a tap before resuming audio.
    }
    try {
      featureTrack.loop = false;
      const targetVolume = entry ? featureEntryVolume : featureManualVolume;
      featureTrack.volume = targetVolume;
      document.body.dataset.featureTrackVolume = targetVolume.toFixed(2);
      await featureTrack.play();
      setEqStatus(entry ? "Digital Static" : "Playing");
      startEqRender();
      syncPlayerUi();
      return true;
    } catch {
      setEqStatus("Tap Play");
      syncPlayerUi();
      return false;
    }
  }
  function startEqRender() {
    if (eqFrame || !eqBars.length) return;

    const render = () => {
      if (document.hidden) {
        eqFrame = 0;
        resetBeatVars();
        return;
      }

      let average = 0;
      let bass = 0;
      let mid = 0;
      let high = 0;

      if (analyser && eqData) {
        analyser.getByteFrequencyData(eqData);

        const nyquist = audioCtx ? audioCtx.sampleRate / 2 : 22050;
        const readBand = (lowHz, highHz) => {
          const lowIndex = Math.max(0, Math.floor((lowHz / nyquist) * eqData.length));
          const highIndex = Math.min(eqData.length - 1, Math.ceil((highHz / nyquist) * eqData.length));
          let total = 0;
          let count = 0;
          for (let index = lowIndex; index <= highIndex; index += 1) {
            total += eqData[index] / 255;
            count += 1;
          }
          return count ? total / count : 0;
        };

        for (let i = 0; i < eqData.length; i += 1) {
          average += eqData[i] / 255;
        }
        average /= eqData.length;
        bass = readBand(38, 180);
        mid = readBand(220, 1800);
        high = readBand(2200, 12000);
      }

      lastEqSnapshot = { average, bass, mid, high };
      idlePhase += 0.052;
      const idle = 0.1 + Math.sin(idlePhase) * 0.035;
      const energy = Math.max(average, idle, visualImpulse * 0.68);
      const trackIsLive = featureTrack && !featureTrack.paused && !featureTrack.ended;
      const nowMs = Date.now();
      const shouldPaintFullPageBeat =
        !trackIsLive ||
        visualImpulse > 0.72 ||
        nowMs - lastBeatPaintAt > 84;
      if (shouldPaintFullPageBeat) {
        setBeatVars(trackIsLive ? Math.min(1, average * 2.1) : 0, trackIsLive ? Math.min(1, bass * 1.7) : 0);
        lastBeatPaintAt = nowMs;
      }
      syncPlayerUi();

      eqBars.forEach((bar, index) => {
        const bandSeed = index / Math.max(1, eqBars.length - 1);
        let analyzed = 0;
        if (analyser && eqData && audioCtx) {
          const nyquist = audioCtx.sampleRate / 2;
          const lowHz = 42 * Math.pow(12000 / 42, bandSeed);
          const highHz = 42 * Math.pow(12000 / 42, Math.min(1, bandSeed + 1 / Math.max(1, eqBars.length)));
          const lowIndex = Math.max(0, Math.floor((lowHz / nyquist) * eqData.length));
          const highIndex = Math.min(eqData.length - 1, Math.ceil((highHz / nyquist) * eqData.length));
          let bandTotal = 0;
          let bandCount = 0;
          for (let bandIndex = lowIndex; bandIndex <= highIndex; bandIndex += 1) {
            bandTotal += eqData[bandIndex] / 255;
            bandCount += 1;
          }
          analyzed = bandCount ? bandTotal / bandCount : 0;
        }
        const pulse = Math.sin(idlePhase + index * 0.76) * 0.08;
        const hit = visualImpulse * (0.18 + ((index % 5) / 5) * 0.22);
        const level = Math.max(0.1, Math.min(1, analyzed * 0.92 + energy * 0.42 + hit + pulse));
        bar.style.setProperty("--eq-level", level.toFixed(3));
      });

      eqPanels.forEach((panel) => {
        panel.style.setProperty("--eq-bass", Math.max(bass, idle).toFixed(3));
        panel.style.setProperty("--eq-mid", Math.max(mid, idle * 0.9).toFixed(3));
        panel.style.setProperty("--eq-high", Math.max(high, idle * 0.85).toFixed(3));
        panel.dataset.eqEnergy = average.toFixed(3);
        panel.dataset.eqBass = bass.toFixed(3);
        panel.dataset.eqMid = mid.toFixed(3);
        panel.dataset.eqHigh = high.toFixed(3);
      });

      knobButtons.forEach((button, index) => {
        const band = index === 0 ? bass : index === 1 ? mid : index === 2 ? high : energy;
        const motion = Math.max(band, visualImpulse * 0.64, idle * (1 + index * 0.08));
        button.style.setProperty("--knob-energy", motion.toFixed(3));
        button.style.setProperty("--knob-rotation", `${Math.round(-74 + motion * 168 + index * 11)}deg`);
      });

      visualImpulse *= 0.93;
      if (!trackIsLive && visualImpulse < 0.025) {
        eqFrame = 0;
        resetBeatVars();
        return;
      }
      eqFrame = window.requestAnimationFrame(render);
    };

    setEqStatus("Listening");
    eqFrame = window.requestAnimationFrame(render);
  }

  function playTone(seed = 0) {
    const output = getOutput();
    if (!audioCtx || !output) return;
    const notes = [261.63, 293.66, 329.63, 392, 440, 493.88, 523.25];
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = "triangle";
    osc.frequency.setValueAtTime(notes[seed % notes.length], now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.055, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
    osc.connect(gain);
    gain.connect(output);
    osc.start(now);
    osc.stop(now + 0.24);
    visualImpulse = Math.max(visualImpulse, 0.62);
    startEqRender();
  }

  if (isHealingGenerator) {
    healingToneButtons.forEach((button, index) => {
      button.addEventListener("click", () => selectHealingPreset(index, { restart: healingActive }));
    });
    syncHealingUi();
  }

  document.querySelectorAll("button:not(.piano-key):not([data-feature-player-control]):not([data-fx-control]):not([data-healing-tone]), .rail-cards a, .feature-cta").forEach((el, index) => {
    el.addEventListener("pointerdown", () => playTone(index), { passive: true });
  });

  let activeKnobDrag = null;

  knobButtons.forEach((button) => {
    button.setAttribute("role", "slider");
    button.addEventListener("pointerdown", (event) => {
      if (!button.dataset.fxControl) return;
      event.preventDefault();
      getContext();
      button.setPointerCapture?.(event.pointerId);
      activeKnobDrag = {
        button,
        name: button.dataset.fxControl,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startValue: fxState[button.dataset.fxControl] ?? 0,
        moved: false,
      };
      button.classList.add("is-adjusting");
      setFxControlValue(activeKnobDrag.name, activeKnobDrag.startValue, "Adjust ");
    });
    button.addEventListener("pointermove", (event) => {
      if (!activeKnobDrag || activeKnobDrag.button !== button || activeKnobDrag.pointerId !== event.pointerId) return;
      const deltaY = activeKnobDrag.startY - event.clientY;
      const deltaX = event.clientX - activeKnobDrag.startX;
      if (Math.abs(deltaY) > 2 || Math.abs(deltaX) > 4) activeKnobDrag.moved = true;
      const travel = activeKnobDrag.name === "master" ? 170 : 140;
      setFxControlValue(activeKnobDrag.name, activeKnobDrag.startValue + deltaY / travel + deltaX / (travel * 2), "Adjust ");
    });
    button.addEventListener("pointerup", (event) => {
      if (!activeKnobDrag || activeKnobDrag.button !== button || activeKnobDrag.pointerId !== event.pointerId) return;
      const shouldClickNudge = !activeKnobDrag.moved;
      activeKnobDrag = null;
      button.classList.remove("is-adjusting");
      button.releasePointerCapture?.(event.pointerId);
      if (shouldClickNudge) nudgeFxControl(button.dataset.fxControl);
    });
    button.addEventListener("pointercancel", (event) => {
      if (!activeKnobDrag || activeKnobDrag.button !== button || activeKnobDrag.pointerId !== event.pointerId) return;
      activeKnobDrag = null;
      button.classList.remove("is-adjusting");
      button.releasePointerCapture?.(event.pointerId);
    });
    button.addEventListener("wheel", (event) => {
      if (!button.dataset.fxControl) return;
      event.preventDefault();
      const step = event.shiftKey ? 0.03 : 0.08;
      setFxControlValue(button.dataset.fxControl, (fxState[button.dataset.fxControl] ?? 0) + (event.deltaY < 0 ? step : -step), "Adjust ");
    }, { passive: false });
    button.addEventListener("keydown", (event) => {
      const name = button.dataset.fxControl;
      if (!name || event.repeat) return;
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        nudgeFxControl(name);
      }
      if (event.key === "ArrowUp" || event.key === "ArrowRight") {
        event.preventDefault();
        setFxControlValue(name, fxState[name] + 0.06, "Adjust ");
      }
      if (event.key === "ArrowDown" || event.key === "ArrowLeft") {
        event.preventDefault();
        setFxControlValue(name, fxState[name] - 0.06, "Adjust ");
      }
      if (event.key === "Home") {
        event.preventDefault();
        setFxControlValue(name, name === "master" ? 0.24 : 0, "Adjust ");
      }
      if (event.key === "End") {
        event.preventDefault();
        setFxControlValue(name, 1, "Adjust ");
      }
    });
  });
  syncKnobControls();

  window.LMFeatureAudio = {
    getState() {
      return {
        contextState: audioCtx?.state || "not-started",
        featureTrackConnected: featureTrack ? mediaSources.has(featureTrack) : false,
        featureTrackPaused: featureTrack ? featureTrack.paused : true,
        featureTrackVolume: featureTrack ? featureTrack.volume : 0,
        healing: {
          active: healingActive,
          preset: getHealingPreset() ? { hz: getHealingPreset().hz, label: getHealingPreset().label } : null
        },
        effects: { ...fxState },
        eq: { ...lastEqSnapshot }
      };
    },
    setEffect(name, value) {
      return setFxControlValue(name, value);
    }
  };

  ["pointerdown", "touchstart", "keydown"].forEach((type) => {
    document.addEventListener(type, () => {
      getContext();
      scanPageMedia();
      startEqRender();
    }, { once: true, passive: true });
  });

  document.addEventListener("play", (event) => {
    if (event.target instanceof HTMLMediaElement) connectPlayableMedia(event.target);
  }, true);
  document.addEventListener("volumechange", (event) => {
    if (event.target instanceof HTMLMediaElement) connectPlayableMedia(event.target);
  }, true);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && eqFrame) {
      window.cancelAnimationFrame(eqFrame);
      eqFrame = 0;
      resetBeatVars();
      return;
    }
    if ((featureTrack && !featureTrack.paused) || healingActive) startEqRender();
  });
  const scanTimer = window.setInterval(scanPageMedia, 2200);
  startEqRender();


  playerToggle?.addEventListener("click", async () => {
    if (isHealingGenerator) {
      if (healingActive) {
        stopHealingTone();
        resetBeatVars();
        setEqStatus("Paused");
      } else {
        startHealingTone({ restart: true });
      }
      syncPlayerUi();
      return;
    }
    if (!featureTrack) return;
    if (featureTrack.paused) {
        await startFeatureTrack({ restart: featureTrack.ended || completedEntryLoops >= maxEntryLoops });
    } else {
      featureTrack.pause();
      resetBeatVars();
      setEqStatus("Paused");
      syncPlayerUi();
    }
  });

  playerPrev?.addEventListener("click", () => {
    if (isHealingGenerator) {
      selectHealingPreset(healingIndex - 1, { restart: healingActive });
      return;
    }
    if (!featureTrack) return;
    try {
      featureTrack.currentTime = Math.max(0, featureTrack.currentTime - 15);
    } catch {
      // Metadata may not be ready yet.
    }
    syncPlayerUi();
  });

  playerNext?.addEventListener("click", () => {
    if (isHealingGenerator) {
      selectHealingPreset(healingIndex + 1, { restart: healingActive });
      return;
    }
    if (!featureTrack) return;
    const duration = Number.isFinite(featureTrack.duration) ? featureTrack.duration : featureTrack.currentTime + 15;
    try {
      featureTrack.currentTime = Math.min(duration, featureTrack.currentTime + 15);
    } catch {
      // Metadata may not be ready yet.
    }
    syncPlayerUi();
  });

  if (featureTrack) {
    featureTrack.addEventListener("ended", () => {
      completedEntryLoops += 1;
      resetBeatVars();
      if (completedEntryLoops < maxEntryLoops) {
        try {
          featureTrack.currentTime = 0;
        } catch {
          // Metadata may not be ready yet.
        }
        startFeatureTrack({ entry: true });
        return;
      }
      completedEntryLoops = 0;
      try {
        featureTrack.currentTime = 0;
      } catch {
        // Metadata may not be ready yet.
      }
      stopHealingTone();
      setEqStatus("Complete");
      syncPlayerUi();
    });

    featureTrack.addEventListener("play", () => {
      connectPlayableMedia(featureTrack);
      setEqStatus("Playing");
      startEqRender();
      syncPlayerUi();
    });
    featureTrack.addEventListener("pause", () => {
      if (!featureTrack.ended) {
        stopHealingTone();
        resetBeatVars();
        setEqStatus("Paused");
        syncPlayerUi();
      }
    });
    featureTrack.addEventListener("loadedmetadata", syncPlayerUi);
    featureTrack.addEventListener("durationchange", syncPlayerUi);
    featureTrack.addEventListener("timeupdate", syncPlayerUi);
    featureTrack.addEventListener("seeking", syncPlayerUi);
    syncPlayerUi();
    window.setTimeout(() => startFeatureTrack({ restart: true, entry: true }), 320);
  } else {
    syncPlayerUi();
  }
  const pianos = Array.from(document.querySelectorAll("[data-playable-piano]"));
  if (!pianos.length) return;

  const activeVoices = new Map();

  function playPianoKey(key, pointerId = "keyboard") {
    const output = getOutput();
    if (!audioCtx || !output) return;
    const frequency = Number(key.dataset.frequency || 261.63);
    const now = audioCtx.currentTime;
    const voiceGain = audioCtx.createGain();
    const filter = audioCtx.createBiquadFilter();
    const body = audioCtx.createOscillator();
    const tine = audioCtx.createOscillator();
    const shimmer = audioCtx.createOscillator();

    body.type = "triangle";
    tine.type = "sine";
    shimmer.type = "sine";
    body.frequency.setValueAtTime(frequency, now);
    tine.frequency.setValueAtTime(frequency * 2.01, now);
    shimmer.frequency.setValueAtTime(frequency * 3.01, now);
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(5200, now);
    filter.frequency.exponentialRampToValueAtTime(1550, now + 0.52);
    voiceGain.gain.setValueAtTime(0.0001, now);
    voiceGain.gain.linearRampToValueAtTime(0.18, now + 0.014);
    voiceGain.gain.exponentialRampToValueAtTime(0.045, now + 0.38);

    body.connect(filter);
    tine.connect(filter);
    shimmer.connect(filter);
    filter.connect(voiceGain);
    voiceGain.connect(output);
    body.start(now);
    tine.start(now);
    shimmer.start(now);
    key.classList.add("is-playing");
    key.setAttribute("aria-pressed", "true");
    setEqStatus("Piano signal");
    visualImpulse = Math.max(visualImpulse, 0.86);
    startEqRender();

    activeVoices.set(pointerId, { body, tine, shimmer, gain: voiceGain, key });
  }

  function releasePianoKey(pointerId = "keyboard") {
    const voice = activeVoices.get(pointerId);
    if (!voice || !audioCtx) return;
    const now = audioCtx.currentTime;
    voice.gain.gain.cancelScheduledValues(now);
    voice.gain.gain.setTargetAtTime(0.0001, now, 0.07);
    voice.body.stop(now + 0.36);
    voice.tine.stop(now + 0.36);
    voice.shimmer.stop(now + 0.36);
    voice.key.classList.remove("is-playing");
    voice.key.setAttribute("aria-pressed", "false");
    activeVoices.delete(pointerId);
  }

  pianos.forEach((piano) => {
    piano.querySelectorAll(".piano-key").forEach((key) => {
      key.setAttribute("aria-pressed", "false");
      key.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        key.setPointerCapture?.(event.pointerId);
        releasePianoKey(event.pointerId);
        playPianoKey(key, event.pointerId);
      });
      key.addEventListener("pointerup", (event) => releasePianoKey(event.pointerId));
      key.addEventListener("pointercancel", (event) => releasePianoKey(event.pointerId));
      key.addEventListener("lostpointercapture", (event) => releasePianoKey(event.pointerId));
      key.addEventListener("mousedown", () => {
        if (activeVoices.has("mouse")) return;
        playPianoKey(key, "mouse");
      });
      key.addEventListener("mouseup", () => releasePianoKey("mouse"));
      key.addEventListener("mouseleave", () => releasePianoKey("mouse"));
      key.addEventListener("click", () => {
        if (activeVoices.size) return;
        playPianoKey(key, `tap-${key.dataset.note}`);
        window.setTimeout(() => releasePianoKey(`tap-${key.dataset.note}`), 240);
      });
      key.addEventListener("keydown", (event) => {
        if (event.repeat || (event.key !== "Enter" && event.key !== " ")) return;
        event.preventDefault();
        playPianoKey(key, `key-${key.dataset.note}`);
      });
      key.addEventListener("keyup", () => releasePianoKey(`key-${key.dataset.note}`));
    });
  });

  window.addEventListener("pagehide", () => {
    window.clearInterval(scanTimer);
    if (eqFrame) window.cancelAnimationFrame(eqFrame);
  });
})();

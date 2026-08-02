(() => {
  "use strict";

  const boot = async () => {

  const body = document.body;
  const root = document.getElementById("lmMembership");
  if (!body?.classList.contains("memberships-page") || !root || body.dataset.lmMembershipReady === "true") return;
  body.dataset.lmMembershipReady = "true";

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
  const gsap = window.gsap || null;
  const ScrollTrigger = window.ScrollTrigger || null;
  const SplitText = window.SplitText || null;
  if (gsap && ScrollTrigger) gsap.registerPlugin(ScrollTrigger);
  if (gsap && SplitText) gsap.registerPlugin(SplitText);
  if (window.LMPageTransitionAudio?.config) {
    window.LMPageTransitionAudio.config.volume = 0.08;
    window.LMPageTransitionAudio.config.playCloseBeforeNavigate = false;
  }
  const sectionMap = [
    ["dust", "Dust", "T − 13.8 Gyr"],
    ["ignition", "Ignition", "T − 13.6 Gyr"],
    ["worlds", "Worlds", "T − 4.6 Gyr"],
    ["water", "Water", "T − 3.8 Gyr"],
    ["life", "Life", "T − 0.54 Gyr"],
    ["flight", "Flight", "Member program"],
    ["signal", "Signal", "T − 0.00 Gyr"],
    ["lm-final", "Return", "Now"],
  ].map(([id, label, time], index) => ({ id, label, time, index, node: document.getElementById(id) })).filter((item) => item.node);

  const state = {
    activeIndex: 0,
    visual: null,
    disturbedTimer: 0,
    lenis: null,
    soundEnabled: false,
    audioContext: null,
    hintRetired: false,
    telemetry: { x: 0.5, y: 0.5, status: "ARRAY STABLE" },
  };

  const commercialModal = document.querySelector("[data-membership-commercial-modal]");
  const commercialVideo = commercialModal?.querySelector("[data-membership-commercial-video]");
  const heroCommercialVideo = document.querySelector("[data-membership-hero-commercial]");
  const featuredCommercialVideo = document.querySelector("[data-membership-featured-commercial]");
  const featuredCommercialSound = document.querySelector("[data-membership-featured-sound]");
  const commercialOpeners = [...document.querySelectorAll("[data-membership-commercial-open]")];
  const commercialClose = commercialModal?.querySelector("[data-membership-commercial-close]");
  const commercialEnter = commercialModal?.querySelector("[data-membership-commercial-enter]");
  const commercialReplay = commercialModal?.querySelector("[data-membership-commercial-replay]");
  const commercialChapters = [...(commercialModal?.querySelectorAll("[data-membership-commercial-chapter]") || [])];
  const commercialTitle = commercialModal?.querySelector("[data-membership-commercial-title]");
  const commercialSignal = commercialModal?.querySelector("[data-membership-commercial-signal]");
  const commercialCopy = commercialModal?.querySelector("[data-membership-commercial-copy]");
  const commercialTelemetry = commercialModal?.querySelector("[data-membership-commercial-telemetry]");
  const commercialSound = commercialModal?.querySelector("[data-membership-commercial-sound]");
  const membershipSoundtrack = document.querySelector("#siteSoundtrack");
  const membershipSoundPreferenceKey = "lottominded.ultra.membershipSound.v1";
  let soundToggle = null;
  let soundtrackPausedForCommercial = false;
  let soundtrackShouldStartAfterCommercial = false;
  try {
    state.soundOptOut = localStorage.getItem(membershipSoundPreferenceKey) === "off";
  } catch (_) {
    state.soundOptOut = false;
  }
  if (membershipSoundtrack) {
    membershipSoundtrack.loop = false;
    membershipSoundtrack.removeAttribute("loop");
    membershipSoundtrack.volume = window.LMAudioMix?.levels.background ?? 0.42;
  }

  const audioReactiveMedia = new Map();
  let audioReactiveFrame = 0;
  let audioReactiveEnergy = 0;

  const updateAudioReactiveEnergy = () => {
    let targetEnergy = 0;
    let activeSource = "none";
    audioReactiveMedia.forEach((entry, media) => {
      if (media.paused || media.muted || media.volume <= 0) return;
      entry.analyser.getByteFrequencyData(entry.data);
      const upperBin = Math.max(8, Math.floor(entry.data.length * 0.58));
      let total = 0;
      let peak = 0;
      for (let index = 2; index < upperBin; index += 1) {
        total += entry.data[index];
        peak = Math.max(peak, entry.data[index]);
      }
      const average = total / Math.max(1, upperBin - 2);
      const normalizedAverage = Math.max(0, Math.min(1, (average - 14) / 112));
      const normalizedPeak = Math.max(0, Math.min(1, (peak - 42) / 180));
      const energy = normalizedAverage * 0.68 + normalizedPeak * 0.32;
      if (energy > targetEnergy) {
        targetEnergy = energy;
        activeSource = media === featuredCommercialVideo
          ? "featured-commercial"
          : media === commercialVideo
            ? "commercial-modal"
            : "membership-soundtrack";
      }
    });
    const smoothing = targetEnergy > audioReactiveEnergy ? 0.34 : 0.1;
    audioReactiveEnergy += (targetEnergy - audioReactiveEnergy) * smoothing;
    if (audioReactiveEnergy < 0.002) audioReactiveEnergy = 0;
    window.__lmMembershipAudioEnergy = reducedMotion.matches ? 0 : audioReactiveEnergy;
    root.style.setProperty("--lm-membership-audio-energy", window.__lmMembershipAudioEnergy.toFixed(3));
    root.dataset.audioReactiveSource = activeSource;
    audioReactiveFrame = requestAnimationFrame(updateAudioReactiveEnergy);
  };

  const enableAudioReactiveMedia = async (media) => {
    if (!media) return false;
    if (audioReactiveMedia.has(media)) return true;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return false;
    state.audioContext ||= new AudioContext();
    const context = state.audioContext;
    if (context.state === "suspended") await context.resume().catch(() => {});
    if (context.state !== "running") return false;
    try {
      const source = context.createMediaElementSource(media);
      const analyser = context.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.68;
      source.connect(analyser);
      analyser.connect(context.destination);
      audioReactiveMedia.set(media, {
        source,
        analyser,
        data: new Uint8Array(analyser.frequencyBinCount),
      });
      if (!audioReactiveFrame) audioReactiveFrame = requestAnimationFrame(updateAudioReactiveEnergy);
      return true;
    } catch (_) {
      return false;
    }
  };

  window.__lmMembershipAudioReactive = Object.freeze({
    get energy() { return window.__lmMembershipAudioEnergy || 0; },
    get source() { return root.dataset.audioReactiveSource || "none"; },
  });
  window.addEventListener("pagehide", () => {
    cancelAnimationFrame(audioReactiveFrame);
    audioReactiveFrame = 0;
  }, { once: true });

  const syncMembershipSoundState = () => {
    if (!soundToggle) return;
    soundToggle.setAttribute("aria-pressed", String(state.soundEnabled));
    soundToggle.textContent = state.soundEnabled ? "MUSIC ON" : "MUSIC OFF";
    soundToggle.setAttribute(
      "aria-label",
      `${state.soundEnabled ? "Pause" : "Play"} membership background music and transition sounds`,
    );
  };

  const playMembershipSoundtrack = async ({ remember = false, restart = false, volume = window.LMAudioMix?.levels.background ?? 0.42, silent = false } = {}) => {
    if (!membershipSoundtrack || state.soundOptOut) return false;
    restoreDeferredVideoSources(membershipSoundtrack);
    membershipSoundtrack.loop = false;
    membershipSoundtrack.volume = volume;
    if (restart) {
      try { membershipSoundtrack.currentTime = 0; } catch (_) {}
    }
    try {
      await enableAudioReactiveMedia(membershipSoundtrack);
      window.LMAudioMix?.claim?.(membershipSoundtrack);
      await membershipSoundtrack.play();
      state.soundEnabled = !silent;
      if (remember) {
        try { localStorage.setItem(membershipSoundPreferenceKey, "on"); } catch (_) {}
      }
      syncMembershipSoundState();
      return true;
    } catch (_) {
      state.soundEnabled = false;
      syncMembershipSoundState();
      return false;
    }
  };

  const pauseMembershipSoundtrack = ({ optOut = false } = {}) => {
    membershipSoundtrack?.pause();
    state.soundEnabled = false;
    if (optOut) {
      state.soundOptOut = true;
      try { localStorage.setItem(membershipSoundPreferenceKey, "off"); } catch (_) {}
    }
    syncMembershipSoundState();
  };

  membershipSoundtrack?.addEventListener("play", () => {
    state.soundEnabled = membershipSoundtrack.volume > 0;
    syncMembershipSoundState();
  });
  membershipSoundtrack?.addEventListener("pause", () => {
    state.soundEnabled = false;
    syncMembershipSoundState();
  });
  membershipSoundtrack?.addEventListener("ended", () => {
    state.soundEnabled = false;
    syncMembershipSoundState();
  });
  const commercialFilms = [
    {
      src: "./assets/merch/lottomind-membership-hoodie-commercial-20260716.mp4",
      poster: "./assets/merch/lottomind-membership-hoodie-commercial-poster-20260716.jpg",
      signal: "Membership commercial / Wear the signal",
      title: "Detroit Signal, Worn Forward.",
      telemetry: "LM-MEMBERSHIP / SIGNAL ONLINE",
      copy: "Wear the city-built LottoMind identity, then move into a connected network of creative tools, arcade routes, and member access.",
      volume: 0.78,
    },
  ];
  const commercialFocusables = () => commercialModal
    ? [...commercialModal.querySelectorAll("button, a[href], video[controls]")].filter((node) => !node.hidden && node.getClientRects().length)
    : [];
  let commercialReturnFocus = null;
  let commercialFilmIndex = 0;
  let commercialIsClosing = false;
  let entryCommercialOpened = false;
  let entryCommercialFallback = 0;
  let featuredCommercialSoundEnabled = false;

  const restoreDeferredVideoSources = (video) => {
    if (!video) return false;
    let changed = false;
    if (video.dataset.src && !video.hasAttribute("src")) {
      video.setAttribute("src", video.dataset.src);
      changed = true;
    }
    video.querySelectorAll("source").forEach((source) => {
      if (source.dataset.src && !source.hasAttribute("src")) {
        source.setAttribute("src", source.dataset.src);
        changed = true;
      }
    });
    if (changed) video.load();
    return changed;
  };

  const playCommercialWithFallback = async ({ restart = false, allowSound = true } = {}) => {
    if (!commercialVideo) return false;
    restoreDeferredVideoSources(commercialVideo);
    if (restart) {
      try { commercialVideo.currentTime = 0; } catch (_) {}
    }
    commercialVideo.volume = commercialFilms[commercialFilmIndex]?.volume ?? 0.64;
    window.LMAudioMix?.claim?.(commercialVideo);
    if (!allowSound) {
      commercialVideo.muted = true;
      commercialVideo.defaultMuted = true;
      commercialVideo.setAttribute("muted", "");
      if (commercialSound) {
        commercialSound.hidden = false;
        commercialSound.textContent = "Play with sound";
      }
      await commercialVideo.play().catch(() => {});
      return false;
    }
    commercialVideo.muted = false;
    commercialVideo.defaultMuted = false;
    commercialVideo.removeAttribute("muted");
    try {
      await enableAudioReactiveMedia(commercialVideo);
      await commercialVideo.play();
      if (commercialSound) commercialSound.hidden = true;
      return true;
    } catch (_) {
      commercialVideo.muted = true;
      commercialVideo.defaultMuted = true;
      commercialVideo.setAttribute("muted", "");
      if (commercialSound) {
        commercialSound.hidden = false;
        commercialSound.textContent = "Play with sound";
      }
      await commercialVideo.play().catch(() => {});
      return false;
    }
  };

  const setCommercialFilm = (index, { restart = true, play = false, muted = false } = {}) => {
    if (!commercialVideo) return;
    const normalizedIndex = Math.max(0, Math.min(commercialFilms.length - 1, Number(index) || 0));
    const film = commercialFilms[normalizedIndex];
    const activeSource = commercialVideo.getAttribute("src") || commercialVideo.dataset.src;
    const sourceChanged = activeSource !== film.src;
    commercialFilmIndex = normalizedIndex;
    if (sourceChanged) {
      commercialVideo.pause();
      commercialVideo.removeAttribute("src");
      commercialVideo.dataset.src = film.src;
      commercialVideo.poster = film.poster;
      commercialVideo.load();
    } else if (restart) {
      commercialVideo.currentTime = 0;
    }
    if (commercialSignal) commercialSignal.textContent = film.signal;
    if (commercialTitle) commercialTitle.textContent = film.title;
    if (commercialCopy) commercialCopy.textContent = film.copy;
    if (commercialTelemetry) commercialTelemetry.textContent = film.telemetry;
    commercialChapters.forEach((button) => {
      const active = Number(button.dataset.commercialIndex) === normalizedIndex;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-current", active ? "true" : "false");
    });
    if (play) playCommercialWithFallback({ restart: false });
  };

  let heroCommercialInView = false;
  let featuredCommercialInView = false;
  let deferredMembershipMediaReady = false;

  const enableDeferredMembershipMedia = () => {
    deferredMembershipMediaReady = true;
    syncHeroCommercialPlayback();
    syncFeaturedCommercialPlayback();
  };

  const scheduleDeferredMembershipMedia = () => {
    const begin = () => {
      if ("requestIdleCallback" in window) {
        window.requestIdleCallback(enableDeferredMembershipMedia, { timeout: 2600 });
      } else {
        window.setTimeout(enableDeferredMembershipMedia, 900);
      }
    };
    if (document.readyState === "complete") begin();
    else window.addEventListener("load", begin, { once: true });
  };

  const syncHeroCommercialPlayback = () => {
    if (!heroCommercialVideo) return;
    const modalIsOpen = commercialModal && !commercialModal.hidden;
    if (!deferredMembershipMediaReady || reducedMotion.matches || document.hidden || !heroCommercialInView || modalIsOpen) {
      heroCommercialVideo.pause();
      return;
    }
    restoreDeferredVideoSources(heroCommercialVideo);
    if (!heroCommercialVideo.currentSrc) return;
    heroCommercialVideo.muted = true;
    heroCommercialVideo.play().catch(() => {});
  };
  if (heroCommercialVideo) {
    const heroCommercialObserver = new IntersectionObserver((entries) => {
      heroCommercialInView = Boolean(entries[0]?.isIntersecting && entries[0].intersectionRatio >= 0.28);
      syncHeroCommercialPlayback();
    }, { threshold: [0, 0.28, 0.65] });
    heroCommercialObserver.observe(heroCommercialVideo);
    document.addEventListener("visibilitychange", syncHeroCommercialPlayback);
    reducedMotion.addEventListener?.("change", syncHeroCommercialPlayback);
  }

  const syncFeaturedCommercialPlayback = () => {
    if (!featuredCommercialVideo) return;
    const modalIsOpen = commercialModal && !commercialModal.hidden;
    if (!deferredMembershipMediaReady || reducedMotion.matches || document.hidden || !featuredCommercialInView || modalIsOpen) {
      featuredCommercialVideo.pause();
      return;
    }
    restoreDeferredVideoSources(featuredCommercialVideo);
    featuredCommercialVideo.muted = !featuredCommercialSoundEnabled;
    featuredCommercialVideo.play().catch(() => {});
  };
  if (featuredCommercialVideo) {
    const featuredCommercialObserver = new IntersectionObserver((entries) => {
      featuredCommercialInView = Boolean(entries[0]?.isIntersecting && entries[0].intersectionRatio >= 0.28);
      syncFeaturedCommercialPlayback();
    }, { threshold: [0, 0.28, 0.65] });
    featuredCommercialObserver.observe(featuredCommercialVideo);
    document.addEventListener("visibilitychange", syncFeaturedCommercialPlayback);
    reducedMotion.addEventListener?.("change", syncFeaturedCommercialPlayback);
  }
  featuredCommercialSound?.addEventListener("click", async () => {
    if (!featuredCommercialVideo) return;
    featuredCommercialSoundEnabled = !featuredCommercialSoundEnabled;
    featuredCommercialVideo.muted = !featuredCommercialSoundEnabled;
    featuredCommercialVideo.volume = window.LMAudioMix?.levels.preview ?? 0.48;
    featuredCommercialSound.setAttribute("aria-pressed", String(featuredCommercialSoundEnabled));
    featuredCommercialSound.textContent = featuredCommercialSoundEnabled ? "Sound on" : "Play with sound";
    if (featuredCommercialSoundEnabled) {
      window.LMAudioMix?.claim?.(featuredCommercialVideo);
      restoreDeferredVideoSources(featuredCommercialVideo);
      await enableAudioReactiveMedia(featuredCommercialVideo);
      featuredCommercialVideo.play().catch(() => {});
    }
  });
  scheduleDeferredMembershipMedia();

  let commercialShouldRestoreFocus = true;
  let commercialHandoffFallback = 0;
  const handleCommercialHandoffComplete = (event) => {
    if (event?.detail?.source !== "membership-commercial") return;
    finishCommercialHandoff();
  };

  const finishCommercialHandoff = () => {
    window.clearTimeout(commercialHandoffFallback);
    window.removeEventListener("lottomind:transition-complete", handleCommercialHandoffComplete);
    commercialModal?.setAttribute("aria-hidden", "true");
    if (commercialModal) commercialModal.hidden = true;
    commercialModal?.classList.remove("is-entry");
    body.classList.remove("has-membership-commercial");
    delete body.dataset.membershipCommercialEntry;
    root.inert = false;
    document.querySelector("[data-site-header]")?.removeAttribute("inert");
    state.lenis?.start();
    syncHeroCommercialPlayback();
    syncFeaturedCommercialPlayback();
    if (soundtrackShouldStartAfterCommercial && membershipSoundtrack) {
      if (!membershipSoundtrack.paused) {
        try { membershipSoundtrack.currentTime = 0; } catch (_) {}
        membershipSoundtrack.volume = window.LMAudioMix?.levels.background ?? 0.42;
        state.soundEnabled = true;
        syncMembershipSoundState();
      } else {
        playMembershipSoundtrack({ remember: true, restart: true, volume: window.LMAudioMix?.levels.background ?? 0.42 });
      }
    }
    soundtrackShouldStartAfterCommercial = false;
    if (commercialClose) commercialClose.textContent = "Close";
    if (commercialShouldRestoreFocus) commercialReturnFocus?.focus?.({ preventScroll: true });
    commercialIsClosing = false;
  };

  const closeCommercial = ({ restoreFocus = true, startMusic = false } = {}) => {
    if (!commercialModal || commercialModal.hidden || commercialIsClosing) return;
    commercialIsClosing = true;
    const isEntryCommercial = commercialModal.classList.contains("is-entry");
    commercialShouldRestoreFocus = restoreFocus;
    commercialVideo?.pause();
    soundtrackShouldStartAfterCommercial = Boolean(
      (startMusic && !state.soundOptOut) || soundtrackPausedForCommercial,
    );
    if (soundtrackShouldStartAfterCommercial && membershipSoundtrack) {
      if (startMusic) {
        try { localStorage.setItem(membershipSoundPreferenceKey, "on"); } catch (_) {}
      }
      membershipSoundtrack.volume = 0;
      try { membershipSoundtrack.currentTime = 0; } catch (_) {}
      playMembershipSoundtrack({ remember: startMusic, restart: true, volume: 0, silent: true });
    }
    soundtrackPausedForCommercial = false;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        commercialModal.classList.remove("is-open");
        window.setTimeout(() => {
          if (isEntryCommercial) {
            window.addEventListener("lottomind:transition-complete", handleCommercialHandoffComplete);
            window.dispatchEvent(new CustomEvent("lottomind:commercial-dismissed", {
              detail: {
                label: "Membership signal online",
                source: "membership-commercial",
                theme: "memberships",
              },
            }));
          }
          commercialModal.setAttribute("aria-hidden", "true");
          commercialModal.hidden = true;
          if (isEntryCommercial) {
            commercialHandoffFallback = window.setTimeout(finishCommercialHandoff, 1500);
          } else {
            finishCommercialHandoff();
          }
        }, 140);
      });
    });
  };

  const openCommercial = (trigger, options = {}) => {
    if (!commercialModal || !commercialVideo) return;
    commercialIsClosing = false;
    const entry = options.entry === true;
    const requestedIndex = options.index ?? trigger?.dataset.commercialIndex;
    commercialReturnFocus = trigger || document.activeElement;
    setCommercialFilm(requestedIndex, { restart: true, play: false });
    commercialModal.hidden = false;
    commercialModal.setAttribute("aria-hidden", "false");
    commercialModal.classList.toggle("is-entry", entry);
    body.classList.add("has-membership-commercial");
    if (entry) body.dataset.membershipCommercialEntry = "true";
    else delete body.dataset.membershipCommercialEntry;
    soundtrackPausedForCommercial = Boolean(membershipSoundtrack && !membershipSoundtrack.paused);
    membershipSoundtrack?.pause();
    heroCommercialVideo?.pause();
    featuredCommercialVideo?.pause();
    root.inert = true;
    document.querySelector("[data-site-header]")?.setAttribute("inert", "");
    state.lenis?.stop();
    requestAnimationFrame(() => commercialModal.classList.add("is-open"));
    if (commercialClose) commercialClose.textContent = "X";
    if (commercialSound) {
      commercialSound.hidden = false;
      commercialSound.textContent = "Play with sound";
    }
    void playCommercialWithFallback({ restart: false, allowSound: true });
    commercialClose?.focus({ preventScroll: true });
  };

  const openEntryCommercial = () => {
    if (entryCommercialOpened || !commercialModal?.hidden || document.hidden) return;
    if (
      document.documentElement.classList.contains("lm-transition-arriving") ||
      body.classList.contains("lm-page-is-transitioning")
    ) return;
    entryCommercialOpened = true;
    window.clearTimeout(entryCommercialFallback);
    window.removeEventListener("lottomind:transition-complete", handleEntryTransitionComplete);
    openCommercial(null, { entry: true, index: 0 });
  };

  function handleEntryTransitionComplete(event) {
    if (event?.detail?.source !== "arrival") return;
    openEntryCommercial();
  }

  const scheduleEntryCommercial = () => {
    window.addEventListener("lottomind:transition-complete", handleEntryTransitionComplete);
    entryCommercialFallback = window.setTimeout(openEntryCommercial, 1800);
  };

  commercialOpeners.forEach((button) => button.addEventListener("click", () => openCommercial(button)));
  commercialClose?.addEventListener("click", () => closeCommercial({ startMusic: true }));
  commercialEnter?.addEventListener("click", () => closeCommercial({ startMusic: true }));
  commercialReplay?.addEventListener("click", () => {
    playCommercialWithFallback({ restart: true });
  });
  commercialSound?.addEventListener("click", () => playCommercialWithFallback({ restart: true }));
  commercialVideo?.addEventListener("pointerdown", () => {
    if (!commercialVideo.currentSrc || commercialVideo.muted) playCommercialWithFallback({ restart: true });
  }, { passive: true });
  commercialChapters.forEach((button) => button.addEventListener("click", () => {
    setCommercialFilm(button.dataset.commercialIndex, { restart: true, play: true });
  }));
  commercialVideo?.addEventListener("ended", () => {
    closeCommercial({ startMusic: true });
  });
  commercialModal?.addEventListener("click", (event) => {
    if (event.target === commercialModal) closeCommercial({ startMusic: true });
  });
  document.addEventListener("keydown", (event) => {
    if (!commercialModal || commercialModal.hidden) return;
    if (event.key === "Escape") {
      event.preventDefault();
      closeCommercial({ startMusic: true });
      return;
    }
    if (event.key !== "Tab") return;
    const focusables = commercialFocusables();
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  const setChromeHeight = () => {
    const header = document.querySelector("[data-site-header]");
    const ribbon = document.querySelector(".home-signal-marquee");
    const candidates = [header, ribbon].filter(Boolean).map((node) => node.getBoundingClientRect().bottom);
    const height = Math.max(0, ...candidates);
    if (height > 0) body.style.setProperty("--lm-chrome-h", `${Math.ceil(height)}px`);
  };

  const chromeObserver = typeof ResizeObserver === "function" ? new ResizeObserver(setChromeHeight) : null;
  const observeChrome = () => {
    chromeObserver?.disconnect();
    document.querySelectorAll("[data-site-header], .home-signal-marquee").forEach((node) => chromeObserver?.observe(node));
    setChromeHeight();
  };
  observeChrome();
  window.setTimeout(observeChrome, 250);
  window.addEventListener("resize", setChromeHeight, { passive: true });

  if (!reducedMotion.matches && window.Lenis) {
    state.lenis = new window.Lenis({
      duration: 1.35,
      easing: (value) => 1 - Math.pow(1 - value, 4),
      smoothWheel: true,
      syncTouch: false,
      autoRaf: false,
    });
    state.lenis.stop();
    state.lenis.on("scroll", () => ScrollTrigger?.update());
    if (gsap) {
      gsap.ticker.add((time) => state.lenis?.raf(time * 1000));
      gsap.ticker.lagSmoothing(0);
    }
  }

  const scrollToNode = (node) => {
    if (!node) return;
    if (state.lenis && !reducedMotion.matches) {
      state.lenis.scrollTo(node, { offset: -(parseFloat(getComputedStyle(body).getPropertyValue("--lm-chrome-h")) || 0) - 20 });
    } else {
      node.scrollIntoView({ behavior: reducedMotion.matches ? "auto" : "smooth", block: "start" });
    }
  };

  const rail = document.createElement("nav");
  rail.className = "lm-section-rail";
  rail.setAttribute("aria-label", "Membership sections");
  sectionMap.forEach((item) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = item.label;
    button.dataset.lmSectionTarget = item.id;
    button.addEventListener("click", () => scrollToNode(item.node));
    rail.append(button);
  });
  root.append(rail);

  const hudLeft = document.createElement("div");
  hudLeft.className = "lm-membership-hud lm-membership-hud--left";
  hudLeft.setAttribute("aria-hidden", "true");
  const hudRight = document.createElement("div");
  hudRight.className = "lm-membership-hud lm-membership-hud--right";
  hudRight.setAttribute("aria-hidden", "true");
  hudRight.textContent = "0.50 · 0.50 · ARRAY STABLE";
  root.append(hudLeft, hudRight);

  soundToggle = document.createElement("button");
  soundToggle.type = "button";
  soundToggle.className = "lm-sound-toggle";
  soundToggle.setAttribute("aria-pressed", "false");
  soundToggle.setAttribute("aria-label", "Play membership background music and transition sounds");
  soundToggle.textContent = "MUSIC OFF";
  root.append(soundToggle);

  const cursorDot = document.createElement("span");
  const cursorRing = document.createElement("span");
  const cursorHint = document.createElement("span");
  cursorDot.className = "lm-cursor-dot";
  cursorRing.className = "lm-cursor-ring";
  cursorHint.className = "lm-cursor-hint";
  cursorHint.textContent = "Click — disturb the array";
  cursorDot.setAttribute("aria-hidden", "true");
  cursorRing.setAttribute("aria-hidden", "true");
  cursorHint.setAttribute("aria-hidden", "true");
  try { state.hintRetired = localStorage.getItem("aeonBurstDiscovered") === "yes"; } catch (error) {}
  if (finePointer.matches && !reducedMotion.matches) {
    root.append(cursorDot, cursorRing);
    if (!state.hintRetired) root.append(cursorHint);
  }

  const eraChimeFrequencies = [196, 220, 246.94, 293.66, 329.63, 392, 440, 493.88];
  let lastEraChimeAt = 0;
  const playEraChime = (index) => {
    if (!state.soundEnabled) return;
    const timestamp = performance.now();
    if (timestamp - lastEraChimeAt < 240) return;
    lastEraChimeAt = timestamp;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    state.audioContext ||= new AudioContext();
    const context = state.audioContext;
    if (context.state === "suspended") context.resume().catch(() => {});
    const now = context.currentTime + 0.01;
    const duration = 0.9;
    const frequency = eraChimeFrequencies[index % eraChimeFrequencies.length];
    const output = context.createGain();
    const shimmerGain = context.createGain();
    const filter = context.createBiquadFilter();
    const bell = context.createOscillator();
    const shimmer = context.createOscillator();
    const panner = context.createStereoPanner?.() || null;
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(1800, now);
    filter.Q.setValueAtTime(0.7, now);
    bell.type = "sine";
    shimmer.type = "sine";
    bell.frequency.setValueAtTime(frequency, now);
    shimmer.frequency.setValueAtTime(frequency * 2.005, now);
    shimmerGain.gain.setValueAtTime(0.2, now);
    output.gain.setValueAtTime(0.0001, now);
    output.gain.exponentialRampToValueAtTime(0.014, now + 0.04);
    output.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    bell.connect(filter);
    shimmer.connect(shimmerGain);
    shimmerGain.connect(filter);
    filter.connect(output);
    if (panner) {
      panner.pan.setValueAtTime(((index % 3) - 1) * 0.12, now);
      output.connect(panner);
      panner.connect(context.destination);
    } else {
      output.connect(context.destination);
    }
    const cleanup = () => {
      [bell, shimmer, shimmerGain, filter, output, panner].filter(Boolean).forEach((node) => {
        try { node.disconnect(); } catch (_) {}
      });
    };
    bell.addEventListener("ended", cleanup, { once: true });
    bell.start(now);
    shimmer.start(now + 0.025);
    bell.stop(now + duration + 0.05);
    shimmer.stop(now + duration + 0.05);
  };

  soundToggle.addEventListener("click", async () => {
    if (state.soundEnabled && membershipSoundtrack && !membershipSoundtrack.paused) {
      pauseMembershipSoundtrack({ optOut: true });
      return;
    }
    state.soundOptOut = false;
    await playMembershipSoundtrack({ remember: true });
  });

  const updateTelemetry = () => {
    hudRight.textContent = `${state.telemetry.x.toFixed(2)} · ${state.telemetry.y.toFixed(2)} · ${state.telemetry.status}`;
  };
  document.addEventListener("pointermove", (event) => {
    state.telemetry.x = Math.max(0, Math.min(1, event.clientX / innerWidth));
    state.telemetry.y = Math.max(0, Math.min(1, event.clientY / innerHeight));
    updateTelemetry();
  }, { passive: true });

  const formatDeepTime = (years, progress) => {
    if (progress >= 0.9995 || years < 0.5) return "T − 0 · now";
    const units = years >= 1e9
      ? [1e9, "Gyr"]
      : years >= 1e6
        ? [1e6, "Myr"]
        : years >= 1e3
          ? [1e3, "kyr"]
          : [1, "yr"];
    const value = years / units[0];
    const digits = value >= 100 ? 0 : value >= 10 ? 1 : 2;
    return `T − ${value.toFixed(digits)} ${units[1]}`;
  };

  const updateChronometer = () => {
    const scrollRange = Math.max(1, document.documentElement.scrollHeight - innerHeight);
    const scrollProgress = Math.max(0, Math.min(1, scrollY / scrollRange));
    const years = 13.8e9 * Math.pow(1 - scrollProgress, 7);
    hudLeft.textContent = formatDeepTime(years, scrollProgress);
  };

  const setActiveSection = (index) => {
    const item = sectionMap[index];
    if (!item || state.activeIndex === index && body.dataset.lmActiveSection) return;
    const previousIndex = state.activeIndex;
    state.activeIndex = index;
    body.dataset.lmActiveSection = item.label.toLowerCase();
    const glow = item.node.dataset.lmGlow || "#5be9ff";
    const background = item.node.dataset.lmBg || "#04060a";
    if (gsap && !reducedMotion.matches) {
      gsap.to(body, { backgroundColor: background, "--lm-active-glow": glow, duration: 0.9, ease: "expo.out", overwrite: true });
    } else {
      body.style.backgroundColor = background;
      body.style.setProperty("--lm-active-glow", glow);
    }
    rail.querySelectorAll("button").forEach((button) => {
      const active = button.dataset.lmSectionTarget === item.id;
      button.classList.toggle("is-active", active);
      if (active) button.setAttribute("aria-current", "true");
      else button.removeAttribute("aria-current");
    });
    window.dispatchEvent(new CustomEvent("lm:membership-era", {
      detail: { index, label: item.label, time: item.time, glow, background },
    }));
    if (item.id !== "ignition") state.visual?.arrivalPulse?.();
    if (previousIndex !== index) playEraChime(index);
  };

  if (gsap && ScrollTrigger && !reducedMotion.matches) {
    sectionMap.forEach((item, index) => {
      ScrollTrigger.create({
        trigger: item.node,
        start: "top 52%",
        end: "top 48%",
        onEnter: () => setActiveSection(index),
        onLeaveBack: () => setActiveSection(Math.max(0, index - 1)),
      });
    });
  } else {
    const sectionObserver = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => {
        const aDistance = Math.abs(a.boundingClientRect.top + a.boundingClientRect.height / 2 - innerHeight / 2);
        const bDistance = Math.abs(b.boundingClientRect.top + b.boundingClientRect.height / 2 - innerHeight / 2);
        return aDistance - bDistance;
      });
      if (!visible.length) return;
      const index = sectionMap.findIndex((item) => item.node === visible[0].target);
      if (index >= 0) setActiveSection(index);
    }, { rootMargin: "-32% 0px -48%", threshold: [0, 0.05, 0.2] });
    sectionMap.forEach((item) => sectionObserver.observe(item.node));
  }

  const revealTargets = [...root.querySelectorAll(
    ".membership-section-heading, .membership-signal-card, .membership-plan-card, .membership-feature-grid article, .credit-pack-grid article, .membership-steps li, .membership-program__row, .membership-vault-copy, .membership-vault-visual, .membership-final"
  )];
  revealTargets.forEach((node) => node.classList.add("lm-reveal"));
  body.classList.add("lm-cinematic-ready");
  if (gsap && ScrollTrigger && !reducedMotion.matches) {
    gsap.set(revealTargets, { autoAlpha: 0, y: 28 });
    ScrollTrigger.batch(revealTargets, {
      start: "top 96%",
      once: true,
      onEnter: (batch) => gsap.to(batch, { autoAlpha: 1, y: 0, duration: 0.78, stagger: 0.07, ease: "expo.out", overwrite: true }),
    });
  } else if (!reducedMotion.matches) {
    const revealObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    }, { rootMargin: "0px 0px -7%", threshold: 0.06 });
    revealTargets.filter((node) => !node.classList.contains("is-visible")).forEach((node) => revealObserver.observe(node));
  } else {
    revealTargets.forEach((node) => node.classList.add("is-visible"));
  }

  const waterSection = document.getElementById("water");
  const waterFigure = waterSection?.querySelector("[data-lm-water-figure]");
  const waterMedia = waterFigure?.querySelector("[data-lm-water-media]");
  const waterImage = waterFigure?.querySelector("[data-lm-water-image]");
  if (waterSection && waterFigure && waterMedia && waterImage) {
    if (gsap && ScrollTrigger && !reducedMotion.matches) {
      const waterIsVideo = waterImage instanceof HTMLVideoElement;
      const figureSpeed = Number.parseFloat(waterFigure.dataset.speed || "1.1") || 1.1;
      const drift = waterIsVideo ? 0 : 11 * figureSpeed;
      gsap.set(waterMedia, { clipPath: "inset(0 0 100% 0)" });
      gsap.set(waterImage, {
        "--lm-water-scale": waterIsVideo ? 1.04 : 1.25,
        "--lm-water-pan": "0%",
        "--lm-water-drift": `${-drift}px`,
      });
      ScrollTrigger.create({
        trigger: waterFigure,
        start: "top 88%",
        once: true,
        onEnter: () => {
          gsap.timeline()
            .to(waterMedia, { clipPath: "inset(0 0 0% 0)", duration: 1.45, ease: "expo.out" })
            .to(waterImage, { "--lm-water-scale": 1, duration: 1.55, ease: "expo.out" }, 0);
        },
      });
      gsap.to(waterImage, {
        "--lm-water-pan": waterIsVideo ? "0%" : "-12%",
        ease: "none",
        scrollTrigger: {
          id: "lm-water-photo-pan",
          trigger: waterSection,
          start: "top bottom",
          end: "bottom top",
          scrub: true,
        },
      });
      gsap.to(waterImage, {
        "--lm-water-drift": `${drift}px`,
        ease: "none",
        scrollTrigger: {
          id: "lm-water-photo-parallax",
          trigger: waterSection,
          start: "top bottom",
          end: "bottom top",
          scrub: figureSpeed,
        },
      });
    } else {
      waterMedia.style.clipPath = "none";
      waterImage.style.setProperty("--lm-water-scale", "1");
      waterImage.style.setProperty("--lm-water-pan", "0%");
      waterImage.style.setProperty("--lm-water-drift", "0px");
    }
  }

  const manifestoSection = document.getElementById("signal");
  const manifestoLines = manifestoSection
    ? [...manifestoSection.querySelectorAll("[data-lm-manifesto-line]")]
    : [];
  if (manifestoSection && manifestoLines.length) {
    if (gsap && ScrollTrigger && !reducedMotion.matches) {
      gsap.set(manifestoLines, { opacity: 0.1, y: 26 });
      const manifestoTimeline = gsap.timeline({ paused: true })
        .to(manifestoLines, {
          opacity: 1,
          y: 0,
          duration: 0.5,
          stagger: 0.5,
          ease: "none",
        });
      const manifestoTrigger = ScrollTrigger.create({
        id: "lm-manifesto-ignite",
        trigger: manifestoSection,
        start: "top 82%",
        end: "center 42%",
        scrub: 0.6,
        animation: manifestoTimeline,
        invalidateOnRefresh: true,
      });
      window.__lmMembershipManifesto = {
        get progress() { return manifestoTimeline.progress(); },
        get lineOpacity() { return manifestoLines.map((line) => Number.parseFloat(getComputedStyle(line).opacity)); },
        get lineY() { return manifestoLines.map((line) => new DOMMatrixReadOnly(getComputedStyle(line).transform).m42); },
        trigger: manifestoTrigger,
      };
    } else {
      manifestoLines.forEach((line) => {
        line.style.opacity = "1";
        line.style.transform = "none";
      });
    }
  }

  let heroSplit = null;
  const heroTitle = document.getElementById("membershipHeroTitle");
  if (gsap && SplitText && heroTitle && !reducedMotion.matches) {
    try {
      heroSplit = SplitText.create
        ? SplitText.create(heroTitle, { type: "lines,chars", mask: "lines", charsClass: "lm-hero-char" })
        : new SplitText(heroTitle, { type: "lines,chars", mask: "lines", charsClass: "lm-hero-char" });
      document.getElementById("dust")?.classList.add("lm-hero-particle-fold");
      gsap.set(heroSplit.chars, {
        x: (index) => ((index % 7) - 3) * 22,
        y: (index) => ((index % 5) - 2) * 18,
        z: (index) => -120 + (index % 6) * 24,
        rotationX: (index) => ((index % 4) - 1.5) * 28,
        rotationY: (index) => (index % 2 ? -1 : 1) * (68 + (index % 4) * 7),
        scale: 0.12,
        opacity: 0,
        filter: "blur(8px)",
        transformOrigin: "50% 50%",
        force3D: true,
      });
    } catch (error) {
      heroSplit = null;
    }
  }

  let heroFoldTimeline = null;
  let heroFoldTrigger = null;
  const heroSection = document.getElementById("dust");
  const heroFoldCopy = root.querySelectorAll(
    ".membership-hero-copy > :is(.membership-temporal-subtitle, .membership-collectible-offer)"
  );
  if (gsap && ScrollTrigger && heroSection && heroSplit?.chars?.length && !reducedMotion.matches) {
    const heroChars = heroSplit.chars;
    heroFoldTimeline = gsap.timeline({ paused: true })
      .to(heroChars, {
        x: (index) => (index < heroChars.length / 2 ? -1 : 1) * (38 + (index % 7) * 10),
        y: (index) => ((index % 5) - 2) * 14,
        z: (index) => -80 - (index % 6) * 22,
        rotationX: (index) => ((index % 3) - 1) * 48,
        rotationY: (index) => (index % 2 ? -1 : 1) * 88,
        scale: 0.08,
        opacity: 0.06,
        filter: "blur(5px)",
        duration: 1,
        stagger: { amount: 0.18, from: "edges" },
        ease: "none",
      }, 0)
      .to(heroFoldCopy, {
        x: 34,
        scaleX: 0.18,
        opacity: 0.12,
        filter: "blur(3px)",
        transformOrigin: "0% 50%",
        duration: 0.72,
        stagger: 0.05,
        ease: "none",
      }, 0.16);
    heroFoldTrigger = ScrollTrigger.create({
      id: "lm-hero-particle-fold",
      trigger: heroSection,
      start: "top 20%",
      end: "top -30%",
      scrub: 0.65,
      animation: heroFoldTimeline,
      invalidateOnRefresh: true,
    });
    window.__lmHeroParticleFold = {
      get progress() { return heroFoldTimeline.progress(); },
      get triggerProgress() { return heroFoldTrigger.progress; },
      get charOpacity() { return Number.parseFloat(getComputedStyle(heroChars[0]).opacity); },
    };
  }

  if (gsap && SplitText && ScrollTrigger && !reducedMotion.matches) {
    root.querySelectorAll(".membership-section-heading h2, .membership-vault-copy h2, .membership-final h2").forEach((heading) => {
      try {
        const split = SplitText.create
          ? SplitText.create(heading, { type: "lines", mask: "lines", linesClass: "lm-heading-line" })
          : new SplitText(heading, { type: "lines", mask: "lines", linesClass: "lm-heading-line" });
        gsap.from(split.lines, { yPercent: 112, duration: 0.9, stagger: 0.09, ease: "expo.out", scrollTrigger: { trigger: heading, start: "top 92%", once: true } });
      } catch (error) {}
    });
  }

  const revealHero = () => {
    if (!gsap || reducedMotion.matches) return;
    const supporting = root.querySelectorAll(".membership-hero-copy > :not(h1)");
    gsap.timeline()
      .to(heroSplit?.chars || heroTitle, {
        x: 0,
        y: 0,
        z: 0,
        yPercent: 0,
        rotationX: 0,
        rotationY: 0,
        scale: 1,
        opacity: 1,
        filter: "blur(0px)",
        duration: 1.28,
        stagger: { each: 0.024, from: "center" },
        ease: "expo.out",
      })
      .fromTo(supporting, { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.72, stagger: 0.07, ease: "expo.out" }, "-=0.68");
  };

  root.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener("click", (event) => {
      const target = document.querySelector(link.getAttribute("href"));
      if (!target) return;
      event.preventDefault();
      history.pushState(null, "", link.getAttribute("href"));
      scrollToNode(target);
    });
  });

  const compareButton = root.querySelector("[data-lm-compare]");
  const comparePanel = document.getElementById(compareButton?.getAttribute("aria-controls") || "");
  compareButton?.addEventListener("click", () => {
    const open = compareButton.getAttribute("aria-expanded") !== "true";
    compareButton.setAttribute("aria-expanded", String(open));
    comparePanel.hidden = !open;
    if (open) comparePanel.querySelector("[tabindex]")?.focus({ preventScroll: true });
  });

  if (finePointer.matches && !reducedMotion.matches) {
    root.querySelectorAll(".membership-plan-card, .membership-feature-grid article").forEach((card) => {
      card.addEventListener("pointermove", (event) => {
        const rect = card.getBoundingClientRect();
        card.style.setProperty("--card-x", `${((event.clientX - rect.left) / rect.width) * 100}%`);
        card.style.setProperty("--card-y", `${((event.clientY - rect.top) / rect.height) * 100}%`);
      }, { passive: true });
    });

    const pointer = { targetX: -100, targetY: -100, x: -100, y: -100 };
    const interactiveSelector = "a, button, input, textarea, select, form, [tabindex], article, table, .collector-access, .lm-section-rail, footer, .site-header";
    root.addEventListener("pointermove", (event) => {
      pointer.targetX = event.clientX;
      pointer.targetY = event.clientY;
      const interactive = !!event.target.closest(interactiveSelector);
      cursorRing.classList.toggle("is-interactive", interactive);
      cursorHint.classList.toggle("is-visible", !interactive && !state.hintRetired);
      body.classList.add("lm-cursor-ready");
    }, { passive: true });
    root.addEventListener("pointerleave", () => {
      body.classList.remove("lm-cursor-ready");
      cursorHint.classList.remove("is-visible");
    }, { passive: true });
    const moveCursor = () => {
      pointer.x += (pointer.targetX - pointer.x) * 0.18;
      pointer.y += (pointer.targetY - pointer.y) * 0.18;
      const transform = `translate3d(${pointer.x}px, ${pointer.y}px, 0)`;
      cursorDot.style.transform = transform;
      cursorRing.style.transform = transform;
      const hintWidth = cursorHint.offsetWidth || 190;
      const hintHeight = cursorHint.offsetHeight || 24;
      const hintX = Math.max(10, Math.min(pointer.x + 18, window.innerWidth - hintWidth - 12));
      const hintY = Math.max(10, Math.min(pointer.y + 22, window.innerHeight - hintHeight - 12));
      cursorHint.style.transform = `translate3d(${hintX}px, ${hintY}px, 0)`;
    };
    if (gsap) gsap.ticker.add(moveCursor);

    root.querySelectorAll(".primary-action, .secondary-action, .lm-sound-toggle").forEach((button) => {
      button.addEventListener("pointermove", (event) => {
        const rect = button.getBoundingClientRect();
        const x = (event.clientX - rect.left - rect.width / 2) * 0.35;
        const y = (event.clientY - rect.top - rect.height / 2) * 0.35;
        if (gsap) gsap.to(button, { x, y, duration: 0.34, ease: "expo.out", overwrite: true });
      }, { passive: true });
      button.addEventListener("pointerleave", () => {
        if (gsap) gsap.to(button, { x: 0, y: 0, duration: 0.85, ease: "elastic.out(1, 0.35)", overwrite: true });
      }, { passive: true });
    });
  }

  const setDisturbed = (duration = 2850) => {
    window.clearTimeout(state.disturbedTimer);
    state.telemetry.status = "ARRAY DISTURBED";
    body.classList.add("lm-array-disturbed");
    updateTelemetry();
    state.disturbedTimer = window.setTimeout(() => {
      state.telemetry.status = "ARRAY STABLE";
      body.classList.remove("lm-array-disturbed");
      updateTelemetry();
    }, duration);
  };

  window.addEventListener("aeon:burst", () => {
    setDisturbed();
    if (state.hintRetired) return;
    state.hintRetired = true;
    cursorHint.classList.remove("is-visible");
    cursorHint.remove();
    try { localStorage.setItem("aeonBurstDiscovered", "yes"); } catch (error) {}
  });

  document.addEventListener("click", (event) => {
    if (reducedMotion.matches) return;
    if (event.target.closest("a, button, input, textarea, select, form, [tabindex], article, table, .collector-access, .lm-section-rail, footer, .site-header")) return;
    state.visual?.burst?.();
  });

  const footer = document.querySelector("body.memberships-page > footer");
  const syncHudState = () => {
    updateChronometer();
    if (footer) body.classList.toggle("lm-near-footer", footer.getBoundingClientRect().top < innerHeight + 70);
  };
  document.addEventListener("scroll", syncHudState, { passive: true });
  state.lenis?.on?.("scroll", syncHudState);

  const statement = document.getElementById("dust");
  if (gsap && ScrollTrigger && statement && !reducedMotion.matches) {
    ScrollTrigger.create({
      trigger: statement,
      start: "top 75%",
      onEnter: () => body.classList.add("lm-hud-visible"),
      onLeaveBack: () => body.classList.remove("lm-hud-visible"),
    });
  }

  // The persistent WebGL entity is isolated in memberships-main.js.


  const runPreloader = () => Promise.resolve();

  let heroIntroRequested = false;
  state.visual = window.__lmMembershipVisual || null;
  window.addEventListener("lm:membership-entity-ready", (event) => {
    state.visual = event.detail;
    if (heroIntroRequested) state.visual?.startHeroIntro?.();
  });
  window.__lmMembershipRuntime = { lenis: state.lenis };
  window.dispatchEvent(new CustomEvent("lm:membership-runtime-ready", { detail: window.__lmMembershipRuntime }));
  setActiveSection(0);
  updateTelemetry();
  syncHudState();
  body.classList.add("lm-motion-ready");
  ScrollTrigger?.refresh();
  await runPreloader();
  heroIntroRequested = true;
  state.visual?.startHeroIntro?.();
  state.lenis?.start();
  revealHero();
  ScrollTrigger?.refresh();
  scheduleEntryCommercial();
  };

  const windowReady = document.readyState === "complete"
    ? Promise.resolve()
    : new Promise((resolve) => window.addEventListener("load", resolve, { once: true }));
  const fontsReady = document.fonts?.ready || Promise.resolve();
  Promise.all([windowReady, fontsReady]).then(boot).catch(() => {
    document.querySelector(".lm-temporal-loader")?.remove();
    document.body?.classList.add("lm-no-webgl");
  });
})();

export function initInlineFilms() {
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const connection = (navigator as Navigator & {connection?: EventTarget & {saveData?: boolean}}).connection;
  const automaticEnabled = () => !motion.matches
    && document.documentElement.dataset.reducedMotion !== 'true' && !connection?.saveData;

  document.querySelectorAll<HTMLElement>('[data-inline-film]').forEach(host => {
    const film = host.querySelector<HTMLVideoElement>('video')!;
    const toggle = host.querySelector<HTMLButtonElement>('[data-origin-film-toggle]')!;
    const sound = host.querySelector<HTMLButtonElement>('[data-origin-film-sound]')!;
    const status = host.querySelector<HTMLElement>('[data-origin-film-status]')!;
    let visible = false, userPaused = false, autoplayBlocked = false, starting = false;
    let contextPauses = 0;
    film.muted = true;

    const sync = () => {
      toggle.textContent = (film.ended ? 'Replay ' : film.paused ? 'Play ' : 'Pause ') + toggle.dataset.filmLabel;
      sound.textContent = film.muted ? 'Turn sound on' : 'Mute sound';
      sound.setAttribute('aria-pressed', String(!film.muted));
    };
    const contextAllowsPlayback = () => visible && !document.hidden && !document.querySelector('dialog[open]');
    const pauseForContext = () => {
      // Native pause events are asynchronous. Do not mistake our own pause for a visitor's choice.
      if (!film.paused) { contextPauses++; film.pause(); }
    };
    const start = async (automatic: boolean) => {
      if (starting) return;
      starting = true;
      if (automatic) film.muted = true;
      try {
        await film.play();
        status.textContent = '';
        if (!contextAllowsPlayback() || (automatic && !automaticEnabled())) pauseForContext();
      } catch {
        // Scrolling away or pressing Pause can cancel an in-flight play request.
        if (contextAllowsPlayback() && !userPaused && (!automatic || automaticEnabled())) {
          autoplayBlocked = true;
          status.textContent = 'Press Play to start the film, or use the video controls.';
        }
      } finally { starting = false; sync(); }
    };
    const update = () => {
      if (!contextAllowsPlayback()) { pauseForContext(); return; }
      if (automaticEnabled() && film.paused && !film.ended && !userPaused && !autoplayBlocked) void start(true);
    };

    toggle.addEventListener('click', () => {
      if (!film.paused) { userPaused = true; film.pause(); return; }
      userPaused = false;
      autoplayBlocked = false;
      void start(false);
    });
    sound.addEventListener('click', () => { film.muted = !film.muted; sync(); });
    film.addEventListener('play', () => {
      userPaused = false;
      autoplayBlocked = false;
      status.textContent = '';
      sync();
      document.dispatchEvent(new Event('store:media-play'));
    });
    film.addEventListener('pause', () => {
      if (contextPauses > 0) contextPauses--;
      else if (!film.ended) userPaused = true;
      sync();
    });
    film.addEventListener('ended', sync);
    film.addEventListener('volumechange', sync);
    film.addEventListener('error', () => {
      autoplayBlocked = true;
      status.textContent = 'Video unavailable. Try opening the video file.';
    });

    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting && entry.intersectionRatio >= .25;
        update();
      }, {threshold: [0, .25]});
      observer.observe(film);
    } else {
      // Older browsers keep the native and explicit Play controls without forcing autoplay.
      visible = true;
      autoplayBlocked = true;
    }
    const preferencesChanged = () => { if (!automaticEnabled()) pauseForContext(); update(); };
    document.addEventListener('store:preferences', preferencesChanged);
    motion.addEventListener('change', preferencesChanged);
    connection?.addEventListener('change', preferencesChanged);
    document.addEventListener('visibilitychange', update);
    document.addEventListener('store:dialog', update);
    window.addEventListener('pagehide', pauseForContext);
    window.addEventListener('pageshow', update);
    sync();
  });
}

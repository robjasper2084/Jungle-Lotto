(function initializeArcadePilot(global, document) {
  "use strict";

  let games = Array.isArray(global.LottoMindArcadeGames)
    ? global.LottoMindArcadeGames.slice()
    : [];
  const grid = document.querySelector("[data-arcade-grid]");
  const filters = document.querySelector("[data-arcade-filters]");
  const search = document.querySelector("[data-arcade-search]");
  const sort = document.querySelector("[data-arcade-sort]");
  const empty = document.querySelector("[data-arcade-empty]");
  const live = document.querySelector("[data-arcade-live]");
  const count = document.querySelector("[data-arcade-count]");
  const visibleCount = document.querySelector("[data-arcade-visible-count]");
  const directory = document.querySelector("[data-view]");
  const viewButtons = [...document.querySelectorAll("[data-arcade-view]")];
  const viewStatus = document.querySelector("[data-arcade-view-status]");
  const railButtons = [...document.querySelectorAll("[data-arcade-scroll]")];
  const featuredLink = document.querySelector("[data-arcade-featured-link]");
  const loading = document.querySelector("[data-arcade-loading]");
  const loadError = document.querySelector("[data-arcade-load-error]");
  const retry = document.querySelector("[data-arcade-retry]");
  const lastChecked = document.querySelector("[data-arcade-last-checked]");
  const heroVideo = document.querySelector("[data-arcade-hero-video]");
  const heroVideoToggle = document.querySelector("[data-arcade-hero-video-toggle]");
  const reducedMotion = global.matchMedia("(prefers-reduced-motion: reduce)");
  const difficultyOrder = { Casual: 0, Intermediate: 1, Advanced: 2 };
  const viewStorageKey = "lm-arcade-directory-view";
  let savedView = "grid";
  try {
    const storedView = global.localStorage.getItem(viewStorageKey);
    if (storedView === "grid" || storedView === "rail") savedView = storedView;
  } catch (_error) {
    // Storage can be unavailable in private browsing or restricted previews.
  }
  const state = { category: "All", query: "", sort: "featured", view: savedView };

  function updateRailControls() {
    const railActive = state.view === "rail";
    const maxScroll = Math.max(0, grid.scrollWidth - grid.clientWidth);
    railButtons.forEach((button) => {
      const direction = Number(button.dataset.arcadeScroll);
      button.disabled = !railActive
        || (direction < 0 ? grid.scrollLeft <= 2 : grid.scrollLeft >= maxScroll - 2);
    });
  }

  function scrollRail(direction) {
    if (state.view !== "rail") return;
    const card = grid.querySelector(".arcade-game-card");
    const gap = Number.parseFloat(global.getComputedStyle(grid).columnGap) || 16;
    const distance = card ? card.getBoundingClientRect().width + gap : grid.clientWidth * 0.85;
    grid.scrollBy({
      left: direction * distance,
      behavior: reducedMotion.matches ? "auto" : "smooth"
    });
  }

  function updateHeroVideoControl() {
    if (!heroVideo || !heroVideoToggle) return;
    const paused = heroVideo.paused;
    heroVideoToggle.setAttribute("aria-pressed", String(paused));
    heroVideoToggle.setAttribute("aria-label", `${paused ? "Play" : "Pause"} Arcade signal film`);
    heroVideoToggle.title = `${paused ? "Play" : "Pause"} film`;
    const icon = heroVideoToggle.querySelector("span");
    if (icon) icon.textContent = paused ? "▶" : "Ⅱ";
  }

  function restoreHeroVideoSource() {
    if (!heroVideo || heroVideo.currentSrc) return;
    const source = heroVideo.querySelector("source[data-src]");
    if (!source) return;
    source.src = source.dataset.src;
    heroVideo.load();
  }

  function applyHeroVideoMotionPreference() {
    if (!heroVideo) return;
    if (reducedMotion.matches) {
      heroVideo.pause();
      heroVideo.currentTime = 0;
      updateHeroVideoControl();
      return;
    }
    restoreHeroVideoSource();
    heroVideo.play().catch(updateHeroVideoControl);
  }

  if (heroVideo && heroVideoToggle) {
    heroVideo.muted = true;
    heroVideo.addEventListener("play", updateHeroVideoControl);
    heroVideo.addEventListener("pause", updateHeroVideoControl);
    heroVideoToggle.addEventListener("click", () => {
      if (heroVideo.paused) {
        restoreHeroVideoSource();
        heroVideo.play().catch(updateHeroVideoControl);
      }
      else heroVideo.pause();
    });
    reducedMotion.addEventListener?.("change", applyHeroVideoMotionPreference);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) heroVideo.pause();
      else applyHeroVideoMotionPreference();
    });
    const scheduleHeroFilm = () => {
      if ("requestIdleCallback" in global) {
        global.requestIdleCallback(applyHeroVideoMotionPreference, { timeout: 2600 });
      } else {
        global.setTimeout(applyHeroVideoMotionPreference, 900);
      }
    };
    if (document.readyState === "complete") scheduleHeroFilm();
    else global.addEventListener("load", scheduleHeroFilm, { once: true });
    updateHeroVideoControl();
  }

  if (!grid || !filters || !search || !sort || !empty || !live || !count || !visibleCount || !directory) return;

  function announce(message) {
    live.textContent = "";
    global.requestAnimationFrame(() => {
      live.textContent = message;
    });
  }

  function applyView(view, options = {}) {
    const nextView = view === "rail" ? "rail" : "grid";
    const { persist = true, announceChange = true } = options;
    state.view = nextView;
    directory.dataset.view = nextView;
    viewButtons.forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.arcadeView === nextView));
    });
    if (viewStatus) viewStatus.textContent = nextView === "grid" ? "All routes shown" : "Swipe or scroll routes";
    if (nextView === "grid") grid.scrollLeft = 0;
    if (persist) {
      try {
        global.localStorage.setItem(viewStorageKey, nextView);
      } catch (_error) {
        // The selected view still works for this session without persistence.
      }
    }
    global.requestAnimationFrame(updateRailControls);
    if (announceChange) announce(`${nextView === "grid" ? "Grid" : "Rail"} view selected.`);
  }

  function filterButton(category) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "arcade-filter";
    button.dataset.category = category;
    button.setAttribute("aria-pressed", String(category === state.category));
    button.textContent = category;
    return button;
  }

  function createCard(game, index) {
    const article = document.createElement("article");
    article.className = `arcade-game-card arcade-game-card--${game.accent || "signal"}`;
    article.setAttribute("role", "listitem");
    article.dataset.gameId = game.id;
    article.dataset.category = game.category;

    const media = document.createElement("a");
    media.className = "arcade-game-card__media";
    media.href = game.path;
    media.setAttribute("aria-label", `Play ${game.title}`);

    const image = document.createElement("img");
    image.src = game.image;
    image.alt = `${game.title} game key art`;
    image.loading = index < 2 ? "eager" : "lazy";
    image.decoding = "async";
    image.width = 720;
    image.height = 405;
    media.append(image);

    const status = document.createElement("span");
    status.className = "arcade-game-card__status";
    status.textContent = game.status;
    media.append(status);

    const body = document.createElement("div");
    body.className = "arcade-game-card__body";

    const channel = document.createElement("p");
    channel.className = "arcade-game-card__channel";
    channel.textContent = `${game.category} / ${game.difficulty}`;

    const title = document.createElement("h3");
    const titleLink = document.createElement("a");
    titleLink.href = game.path;
    titleLink.textContent = game.title;
    title.append(titleLink);

    const description = document.createElement("p");
    description.className = "arcade-game-card__description";
    description.textContent = game.description;

    const meta = document.createElement("dl");
    meta.className = "arcade-game-card__meta";
    const controlsLabel = document.createElement("dt");
    controlsLabel.textContent = "Controls";
    const controls = document.createElement("dd");
    controls.textContent = game.controls;
    meta.append(controlsLabel, controls);

    const actions = document.createElement("div");
    actions.className = "arcade-game-card__actions";
    const actionItems = Array.isArray(game.actions) && game.actions.length
      ? game.actions
      : [{ label: "Launch game", path: game.path }];
    actionItems.forEach((item) => {
      const action = document.createElement("a");
      action.className = "arcade-game-card__launch";
      action.href = item.path;
      action.textContent = item.label;
      action.addEventListener("click", () => announce(`Opening ${game.title}: ${item.label}.`));
      actions.append(action);
    });
    if (game.notice) {
      const notice = document.createElement("p");
      notice.className = "arcade-game-card__notice";
      notice.textContent = game.notice;
      body.append(channel, title, description, meta, notice, actions);
    } else {
      body.append(channel, title, description, meta, actions);
    }
    article.append(media, body);
    return article;
  }

  function filteredGames() {
    const query = state.query.trim().toLowerCase();
    const result = games.filter((game) => {
      const inCategory = state.category === "All" || game.category === state.category;
      const text = [game.title, game.description, game.category, game.controls, ...(game.tags || [])]
        .join(" ")
        .toLowerCase();
      return inCategory && (!query || text.includes(query));
    });

    return result.sort((left, right) => {
      if (state.sort === "alphabetical") return left.title.localeCompare(right.title);
      if (state.sort === "difficulty") {
        return (difficultyOrder[left.difficulty] ?? 9) - (difficultyOrder[right.difficulty] ?? 9)
          || left.title.localeCompare(right.title);
      }
      return Number(Boolean(right.featured)) - Number(Boolean(left.featured))
        || left.title.localeCompare(right.title);
    });
  }

  function render() {
    const visible = filteredGames();
    grid.replaceChildren(...visible.map(createCard));
    grid.scrollLeft = 0;
    visibleCount.textContent = String(visible.length);
    empty.hidden = visible.length > 0;
    filters.querySelectorAll("button").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.category === state.category));
    });
    announce(`${visible.length} arcade route${visible.length === 1 ? "" : "s"} visible in ${state.view} view.`);
    global.requestAnimationFrame(updateRailControls);
  }

  filters.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-category]");
    if (!button) return;
    state.category = button.dataset.category;
    render();
  });
  search.addEventListener("input", () => {
    state.query = search.value;
    render();
  });
  sort.addEventListener("change", () => {
    state.sort = sort.value;
    render();
  });
  viewButtons.forEach((button) => {
    button.addEventListener("click", () => applyView(button.dataset.arcadeView));
  });
  railButtons.forEach((button) => {
    button.addEventListener("click", () => scrollRail(Number(button.dataset.arcadeScroll)));
  });
  grid.addEventListener("scroll", updateRailControls, { passive: true });
  global.addEventListener("resize", updateRailControls);

  async function loadDirectory(force = false) {
    if (loading) loading.hidden = false;
    if (loadError) loadError.hidden = true;
    grid.setAttribute("aria-busy", "true");
    const loader = force ? global.LottoMindLoadArcadeGames?.({ cache: "reload" }) : global.LottoMindArcadeGamesReady;
    const result = await (loader || Promise.resolve({
      games: global.LottoMindArcadeGames || [],
      manifest: global.LottoMindArcadeManifest,
      error: new Error("Game manifest loader is unavailable")
    }));
    games = Array.isArray(result?.games) ? result.games.slice() : [];
    const categories = ["All", ...new Set(games.map((game) => game.category))];
    filters.replaceChildren(...categories.map(filterButton));
    count.textContent = String(games.length);
    const featured = games.find((game) => game.featured) || games[0];
    if (featured && featuredLink) featuredLink.href = featured.path;
    if (lastChecked) lastChecked.textContent = `Last checked ${result?.manifest?.lastChecked || "not available"}`;
    if (loading) loading.hidden = true;
    grid.setAttribute("aria-busy", "false");
    if (loadError) loadError.hidden = !result?.error;
    render();
    if (result?.error) announce(`Unable to refresh games. Showing ${games.length} verified fallback routes.`);
  }

  retry?.addEventListener("click", () => loadDirectory(true));
  applyView(state.view, { persist: false, announceChange: false });
  loadDirectory();
})(window, document);

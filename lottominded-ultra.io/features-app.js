(function initializeArcadePilot(global, document) {
  "use strict";

  const games = Array.isArray(global.LottoMindArcadeGames)
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
  const railButtons = [...document.querySelectorAll("[data-arcade-scroll]")];
  const featuredLink = document.querySelector("[data-arcade-featured-link]");
  const heroVideo = document.querySelector("[data-arcade-hero-video]");
  const heroVideoToggle = document.querySelector("[data-arcade-hero-video-toggle]");
  const recentPanel = document.querySelector("[data-arcade-recent]");
  const recentList = document.querySelector("[data-arcade-recent-list]");
  const reducedMotion = global.matchMedia("(prefers-reduced-motion: reduce)");
  const difficultyOrder = { Casual: 0, Intermediate: 1, Advanced: 2 };
  const state = { category: "All", query: "", sort: "featured" };
  const recentKey = "lottomind.arcade.recent.v1";

  function updateRailControls() {
    const maxScroll = Math.max(0, grid.scrollWidth - grid.clientWidth);
    railButtons.forEach((button) => {
      const direction = Number(button.dataset.arcadeScroll);
      button.disabled = direction < 0 ? grid.scrollLeft <= 2 : grid.scrollLeft >= maxScroll - 2;
    });
  }

  function scrollRail(direction) {
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

  function applyHeroVideoMotionPreference() {
    if (!heroVideo) return;
    if (reducedMotion.matches) {
      heroVideo.pause();
      heroVideo.currentTime = 0;
      updateHeroVideoControl();
      return;
    }
    heroVideo.play().catch(updateHeroVideoControl);
  }

  if (heroVideo && heroVideoToggle) {
    heroVideo.muted = true;
    heroVideo.addEventListener("play", updateHeroVideoControl);
    heroVideo.addEventListener("pause", updateHeroVideoControl);
    heroVideoToggle.addEventListener("click", () => {
      if (heroVideo.paused) heroVideo.play().catch(updateHeroVideoControl);
      else heroVideo.pause();
    });
    reducedMotion.addEventListener?.("change", applyHeroVideoMotionPreference);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) heroVideo.pause();
      else applyHeroVideoMotionPreference();
    });
    applyHeroVideoMotionPreference();
    updateHeroVideoControl();
  }

  if (!grid || !filters || !search || !sort || !empty || !live || !count || !visibleCount) return;

  function announce(message) {
    live.textContent = "";
    global.requestAnimationFrame(() => {
      live.textContent = message;
    });
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
    article.dataset.gameId = game.id;
    article.dataset.category = game.category;

    const media = document.createElement("a");
    media.className = "arcade-game-card__media";
    media.href = game.path;
    media.setAttribute("aria-label", `${game.type === "game" ? "Play" : "Open"} ${game.title}`);
    media.addEventListener("click", () => remember(game));

    const image = document.createElement("img");
    image.src = game.image;
    image.alt = `${game.title} key art`;
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
    const typeLabel = game.type === "interactive-tool" ? "Interactive Tool" : game.type === "music" ? "Music & Rhythm" : "Game";
    channel.textContent = `${typeLabel} / ${game.difficulty}`;

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
    const supportLabel = document.createElement("dt");
    supportLabel.textContent = "Support";
    const support = document.createElement("dd");
    support.textContent = [
      game.touchSupport ? "Touch" : "",
      game.gamepadSupport ? "Gamepad" : "",
      game.progressSupport || "",
    ].filter(Boolean).join(" / ") || "Browser";
    meta.append(controlsLabel, controls, supportLabel, support);

    const action = document.createElement("a");
    action.className = "arcade-game-card__launch";
    action.href = game.path;
    action.textContent = game.type === "game" ? "Play" : "Open Tool";
    action.addEventListener("click", () => {
      remember(game);
      announce(`Opening ${game.title}.`);
    });

    body.append(channel, title, description, meta, action);
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
    announce(`${visible.length} arcade route${visible.length === 1 ? "" : "s"} visible.`);
    global.requestAnimationFrame(updateRailControls);
  }

  function recentIds() {
    try {
      const value = JSON.parse(global.localStorage.getItem(recentKey) || "[]");
      return Array.isArray(value) ? value.filter((id) => games.some((game) => game.id === id)).slice(0, 4) : [];
    } catch (_error) {
      return [];
    }
  }

  function renderRecent() {
    if (!recentPanel || !recentList) return;
    const recentGames = recentIds().map((id) => games.find((game) => game.id === id)).filter(Boolean);
    recentPanel.hidden = recentGames.length === 0;
    recentList.replaceChildren(...recentGames.map((game) => {
      const link = document.createElement("a");
      link.href = game.path;
      link.textContent = game.title;
      return link;
    }));
  }

  function remember(game) {
    try {
      const ids = [game.id, ...recentIds().filter((id) => id !== game.id)].slice(0, 4);
      global.localStorage.setItem(recentKey, JSON.stringify(ids));
      renderRecent();
    } catch (_error) {}
  }

  const categories = ["All", ...new Set(games.map((game) => game.category))];
  filters.replaceChildren(...categories.map(filterButton));
  count.textContent = String(games.length);
  const featured = games.find((game) => game.featured) || games[0];
  if (featured && featuredLink) featuredLink.href = featured.path;

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
  railButtons.forEach((button) => {
    button.addEventListener("click", () => scrollRail(Number(button.dataset.arcadeScroll)));
  });
  grid.addEventListener("scroll", updateRailControls, { passive: true });
  global.addEventListener("resize", updateRailControls);

  render();
  renderRecent();
})(window, document);

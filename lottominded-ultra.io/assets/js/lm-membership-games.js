(function renderMembershipGameDirectory(global, document) {
  "use strict";

  const track = document.querySelector("[data-lm-worlds-track]");
  const count = document.querySelector("[data-membership-game-count]");
  const checked = document.querySelector("[data-membership-games-checked]");
  if (!track) return;

  function card(game, index) {
    const link = document.createElement("a");
    link.className = "lm-epoch-card lm-world-game-card";
    link.href = game.path;
    link.setAttribute("aria-label", `${game.status === "Beta" ? "Open beta" : "Play"} ${game.title}`);

    const media = document.createElement("div");
    media.className = "lm-epoch-card__media";
    const image = document.createElement("img");
    image.src = game.image;
    image.alt = "";
    image.loading = "lazy";
    image.decoding = "async";
    media.append(image);

    const body = document.createElement("div");
    body.className = "lm-epoch-card__body";
    const meta = document.createElement("div");
    meta.className = "lm-epoch-card__meta";
    const number = document.createElement("span");
    number.className = "lm-epoch-card__number";
    number.textContent = `${String(index + 1).padStart(2, "0")} · ${game.status}`;
    const details = document.createElement("span");
    details.className = "lm-epoch-card__era";
    details.textContent = `${game.category} · ${game.difficulty}`;
    meta.append(number, details);
    const title = document.createElement("h3");
    title.textContent = game.title;
    const description = document.createElement("p");
    description.textContent = game.description;
    const launch = document.createElement("span");
    launch.className = "lm-world-game-card__launch";
    launch.innerHTML = `${game.category.includes("Tools") || game.category.includes("Rhythm") ? "Open" : "Play now"} <span aria-hidden="true">&rarr;</span>`;
    body.append(meta, title, description, launch);
    link.append(media, body);
    return link;
  }

  function render(result) {
    const games = Array.isArray(result?.games) ? result.games : [];
    track.replaceChildren(...games.map(card));
    if (count) count.textContent = String(games.length);
    track.parentElement?.setAttribute("aria-label", `${games.length} playable LottoMind routes`);
    if (checked) checked.textContent = `Last checked ${result?.manifest?.lastChecked || "not available"}`;
    document.dispatchEvent(new CustomEvent("lottomind:membership-games-rendered", { detail: { count: games.length } }));
  }

  render({ games: global.LottoMindArcadeGames, manifest: global.LottoMindArcadeManifest });
  global.LottoMindArcadeGamesReady?.then(render);
})(window, document);

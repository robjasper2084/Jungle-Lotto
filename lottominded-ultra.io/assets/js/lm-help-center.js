(() => {
  "use strict";

  const search = document.querySelector("[data-help-search]");
  const filters = document.querySelector("[data-help-filters]");
  const articles = [...document.querySelectorAll("[data-help-category]")];
  const status = document.querySelector("[data-help-status]");
  if (!search || !filters || !articles.length) return;

  const state = { category: "All", query: "" };
  const categories = ["All", ...new Set(articles.map((article) => article.dataset.helpCategory))];

  function update() {
    const query = state.query.trim().toLowerCase();
    let visible = 0;
    articles.forEach((article) => {
      const text = [
        article.querySelector("summary")?.textContent,
        article.dataset.helpKeywords,
        article.dataset.helpCategory,
        article.textContent,
      ].join(" ").toLowerCase();
      const matchesCategory = state.category === "All" || article.dataset.helpCategory === state.category;
      const matchesQuery = !query || text.includes(query);
      article.hidden = !(matchesCategory && matchesQuery);
      if (!article.hidden) visible += 1;
    });
    filters.querySelectorAll("button").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.category === state.category));
    });
    status.textContent = visible
      ? `${visible} help ${visible === 1 ? "topic" : "topics"} shown.`
      : "No help topics match. Try a broader search or contact support.";
  }

  categories.forEach((category) => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.category = category;
    button.setAttribute("aria-pressed", String(category === "All"));
    button.textContent = category;
    filters.append(button);
  });

  filters.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-category]");
    if (!button) return;
    state.category = button.dataset.category;
    update();
  });
  search.addEventListener("input", () => {
    state.query = search.value;
    update();
  });

  const requestedArticle = window.location.hash ? document.querySelector(window.location.hash) : null;
  if (requestedArticle?.matches(".lm-help-article")) {
    requestedArticle.open = true;
    requestAnimationFrame(() => requestedArticle.scrollIntoView({ block: "start" }));
  }
  update();
})();

(() => {
  "use strict";

  const form = document.querySelector("[data-services-form]");
  const result = document.querySelector("[data-services-result]");
  const status = document.querySelector("[data-services-status]");
  const draft = document.querySelector("[data-services-draft]");
  const copyButton = document.querySelector("[data-services-copy]");
  if (!form || !result || !status || !draft) return;

  const loadedAt = performance.now();
  const minimumCompletionMs = 3000;
  const cooldownMs = 20000;
  const cooldownKey = "lm-services-inquiry-prepared-at";
  let prepared = "";

  const setStatus = (message, tone = "") => {
    status.textContent = message;
    status.classList.toggle("is-error", tone === "error");
    status.classList.toggle("is-ready", tone === "ready");
  };

  const clean = (value) => String(value || "").replace(/[\r\n]+/g, " ").trim();

  document.querySelectorAll("[data-package-choice]").forEach((link) => {
    link.addEventListener("click", () => {
      const projectType = form.elements.projectType;
      const description = form.elements.description;
      const packageName = clean(link.dataset.packageChoice);
      if (projectType && !projectType.value) projectType.value = packageName === "Custom World" ? "Multi-page promotional world" : "Cinematic product page";
      if (description && !description.value) description.value = `I am interested in the ${packageName} starting package. `;
      window.setTimeout(() => form.elements.name?.focus(), 300);
    });
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    result.hidden = true;

    if (!form.reportValidity()) {
      setStatus("Complete every required field before preparing the inquiry.", "error");
      return;
    }

    const data = new FormData(form);
    if (clean(data.get("website"))) {
      setStatus("This inquiry could not be prepared. Refresh the page and try again.", "error");
      return;
    }

    if (performance.now() - loadedAt < minimumCompletionMs) {
      setStatus("Please review the project details before preparing the inquiry.", "error");
      return;
    }

    const lastPreparedAt = Number(sessionStorage.getItem(cooldownKey) || 0);
    if (lastPreparedAt && Date.now() - lastPreparedAt < cooldownMs) {
      setStatus("An inquiry was just prepared. Wait a moment before preparing another draft.", "error");
      return;
    }

    prepared = [
      "LottoMind / Digital Static commercial project inquiry",
      `Name: ${clean(data.get("name"))}`,
      `Company: ${clean(data.get("company"))}`,
      `Email: ${clean(data.get("email"))}`,
      `Project type: ${clean(data.get("projectType"))}`,
      `Budget range: ${clean(data.get("budget"))}`,
      `Target launch date: ${clean(data.get("launchDate"))}`,
      "",
      "Project description:",
      String(data.get("description") || "").trim(),
      "",
      "Consent confirmed: Yes - requester chose to prepare and review this email draft.",
    ].join("\n");

    sessionStorage.setItem(cooldownKey, String(Date.now()));
    const subject = `Commercial project inquiry - ${clean(data.get("company"))}`;
    draft.href = `mailto:support@lottomind.one?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(prepared)}`;
    result.hidden = false;
    setStatus("Inquiry prepared locally. Nothing has been uploaded or sent.", "ready");
    result.scrollIntoView({ behavior: "smooth", block: "nearest" });
  });

  form.addEventListener("reset", () => {
    prepared = "";
    result.hidden = true;
    window.setTimeout(() => setStatus("No inquiry has been prepared or sent."), 0);
  });

  copyButton?.addEventListener("click", async () => {
    if (!prepared) return;
    try {
      await navigator.clipboard.writeText(prepared);
      setStatus("Prepared inquiry copied. Nothing has been sent.", "ready");
    } catch {
      setStatus("Copy is unavailable in this browser. Open the email draft to review the inquiry.", "error");
    }
  });
})();

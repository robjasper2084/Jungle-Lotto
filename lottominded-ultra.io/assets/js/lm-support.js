(() => {
  "use strict";

  const form = document.querySelector("[data-support-form]");
  const result = document.querySelector("[data-support-result]");
  const status = document.querySelector("[data-support-status]");
  const draft = document.querySelector("[data-support-draft]");
  const copyRequest = document.querySelector("[data-copy-support-request]");
  const copyEmail = document.querySelector("[data-copy-support-email]");

  if (!form || !result || !status || !draft) return;

  let prepared = "";
  const setStatus = (message) => {
    status.textContent = message;
  };
  const copy = async (value, message) => {
    try {
      await navigator.clipboard.writeText(value);
      setStatus(message);
    } catch {
      setStatus("Copy is unavailable in this browser. Select the prepared text manually.");
    }
  };

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(form);
    prepared = [
      "LottoMind support request",
      `Topic: ${String(data.get("topic") || "other")}`,
      `Reply email: ${String(data.get("email") || "")}`,
      `Page: ${String(data.get("page") || location.href)}`,
      "",
      String(data.get("details") || ""),
    ].join("\n");
    draft.href = `mailto:support@lottomind.one?subject=${encodeURIComponent("LottoMind support request")}&body=${encodeURIComponent(prepared)}`;
    result.hidden = false;
    setStatus("Support request prepared locally. Nothing has been sent.");
    result.scrollIntoView({ behavior: "smooth", block: "nearest" });
  });

  copyRequest?.addEventListener("click", () => copy(prepared, "Prepared request copied."));
  copyEmail?.addEventListener("click", () => copy("support@lottomind.one", "Support email copied."));
})();

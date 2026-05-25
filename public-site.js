document.querySelectorAll("[data-copy]").forEach((button) => {
  button.addEventListener("click", async () => {
    const value = button.dataset.copy;
    try {
      await navigator.clipboard.writeText(value);
      button.textContent = "Copied";
      window.setTimeout(() => {
        button.textContent = value.includes("stem-studio") ? "Copy Studio URL" : "Copy GitHub Pages Home";
      }, 1600);
    } catch (error) {
      button.textContent = value;
    }
  });
});

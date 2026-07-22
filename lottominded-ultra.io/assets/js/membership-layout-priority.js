(() => {
  const moveMembershipDeckFirst = () => {
    const main = document.querySelector(".membership-main");
    const deck = main?.querySelector(":scope > #membership-plans");
    const hero = main?.querySelector(":scope > #dust");
    if (main && deck && hero) main.insertBefore(deck, hero);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", moveMembershipDeckFirst, { once: true });
  } else {
    moveMembershipDeckFirst();
  }
})();

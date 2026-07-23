(() => {
  const arrangeMembershipSections = () => {
    const main = document.querySelector(".membership-main");
    const deck = main?.querySelector(":scope > #membership-plans");
    const hero = main?.querySelector(":scope > #dust");
    const collector = main?.querySelector("#lm-access-hero");
    const showcase = main?.querySelector("#worlds");
    if (main && deck && hero) main.insertBefore(hero, deck);

    if (main && collector && showcase) {
      let showcaseRegion = showcase;
      while (showcaseRegion.parentElement && showcaseRegion.parentElement !== main) {
        showcaseRegion = showcaseRegion.parentElement;
      }
      showcaseRegion.insertAdjacentElement("afterend", collector);
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", arrangeMembershipSections, { once: true });
  } else {
    arrangeMembershipSections();
  }
})();

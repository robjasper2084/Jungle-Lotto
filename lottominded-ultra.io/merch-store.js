const merchRoot = document.documentElement;
const merchHero = document.querySelector("[data-merch-tilt]");
const bagDrawer = document.querySelector("[data-bag-drawer]");
const bagItems = document.querySelector("[data-bag-items]");
const bagTotal = document.querySelector("[data-bag-total]");
const cartNote = document.querySelector("[data-cart-note]");
const wishlistDrawer = document.querySelector("[data-wishlist-drawer]");
const wishlistItems = document.querySelector("[data-wishlist-items]");
const wishlistNote = document.querySelector("[data-wishlist-note]");
const merchSoundCard = document.querySelector("[data-merch-sound-card]");
const merchSoundVideo = document.querySelector("[data-merch-sound-video]");
const merchSoundToggle = document.querySelector("[data-merch-sound-toggle]");
const merchCommercialModal = document.querySelector("[data-merch-commercial-modal]");
const merchCommercialModalVideo = document.querySelector("[data-merch-commercial-modal-video]");
const merchCommercialOpen = document.querySelector("[data-merch-commercial-open]");
const merchCommercialClose = document.querySelector("[data-merch-commercial-close]");
const merchCommercialReplay = document.querySelector("[data-merch-commercial-replay]");
const merchShadowPopup = document.querySelector("[data-merch-shadow-popup]");
const merchShadowFrame = document.querySelector("[data-merch-shadow-frame]");
const merchShadowCloseButtons = document.querySelectorAll("[data-merch-shadow-close]");
let merchHeroVideo = document.querySelector(".merch-hero-video");
const CART_STORAGE_KEY = "lottomind.merch.cart.v1";
const WISHLIST_STORAGE_KEY = "lottomind.merch.wishlist.v1";
const MERCH_SHADOW_AUTO_DELAY = 90000;
const MERCH_SHADOW_AUTO_CLOSE_DELAY = 15000;
const MERCH_SHADOW_AUTO_KEY = "lottomind.merch.shadowAutoShown.v1";
let merchCommercialReturnFocus = null;
let merchShadowAutoCloseTimer = 0;

function loadCart() {
  try {
    return JSON.parse(localStorage.getItem(CART_STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

const bag = loadCart();

function loadWishlist() {
  try {
    const saved = JSON.parse(localStorage.getItem(WISHLIST_STORAGE_KEY));
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

const wishlist = loadWishlist();

function getMerchHeroVideo() {
  if (!merchHeroVideo || !document.contains(merchHeroVideo)) {
    merchHeroVideo = document.querySelector(".merch-hero-video");
  }
  return merchHeroVideo;
}

function primeMerchHeroBackgroundVideo() {
  const video = getMerchHeroVideo();
  if (!video) return;
  const source = video.querySelector("source");
  const heroSource =
    source?.getAttribute("src") ||
    source?.dataset.src ||
    source?.dataset.lmLazySrc ||
    video.dataset.src ||
    video.dataset.lmLazySrc ||
    "./assets/merch/merch-motion-01.opt.mp4";

  video.dataset.lmVideoUnmanaged = "true";
  video.muted = true;
  video.defaultMuted = true;
  video.loop = true;
  video.playsInline = true;
  video.setAttribute("muted", "");
  video.setAttribute("loop", "");
  video.setAttribute("playsinline", "");
  video.preload = "metadata";
  video.setAttribute("preload", "metadata");

  if (source && heroSource && !source.getAttribute("src")) {
    source.setAttribute("src", heroSource);
    video.load?.();
  } else if (heroSource && !video.currentSrc && !video.getAttribute("src") && !source) {
    video.setAttribute("src", heroSource);
    video.load?.();
  }

  video.play?.().catch(() => {
    // Muted hero video is decorative; leave the loaded frame visible if autoplay is blocked.
  });
}

function saveCart() {
  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(bag));
}

function saveWishlist() {
  localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(wishlist));
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  })[char]);
}

function formatMoney(value) {
  const amount = Number(value || 0);
  return `$${amount.toLocaleString("en-US", {
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

function getCartTotals() {
  return bag.reduce(
    (totals, item) => ({
      count: totals.count + item.quantity,
      subtotal: totals.subtotal + item.price * item.quantity,
    }),
    { count: 0, subtotal: 0 },
  );
}

function updateBag() {
  const totals = getCartTotals();
  document.querySelectorAll("[data-bag-count]").forEach((target) => {
    target.textContent = String(totals.count);
  });
  if (bagTotal) bagTotal.textContent = formatMoney(totals.subtotal);

  if (bagItems) {
    bagItems.innerHTML = bag.length
      ? bag.map((item) => `
          <li class="cart-line">
            <div>
              <strong>${escapeHtml(item.name)}</strong>
              <span>${item.size ? `Size ${escapeHtml(item.size)} &middot; ` : ""}${formatMoney(item.price)} each</span>
            </div>
            <div class="cart-quantity" aria-label="${escapeHtml(item.name)} quantity">
              <button type="button" data-cart-decrease="${escapeHtml(item.id)}" aria-label="Decrease ${escapeHtml(item.name)}">-</button>
              <span>${item.quantity}</span>
              <button type="button" data-cart-increase="${escapeHtml(item.id)}" aria-label="Increase ${escapeHtml(item.name)}">+</button>
            </div>
            <strong>${formatMoney(item.price * item.quantity)}</strong>
            <button class="cart-remove" type="button" data-cart-remove="${escapeHtml(item.id)}">Remove</button>
          </li>
        `).join("")
      : `<li class="cart-empty">Your cart is empty. Add a hoodie, cap, polo, or gallery piece.</li>`;
  }

  if (cartNote) {
    cartNote.textContent = bag.length
      ? "Checkout preview is local only. Connect a live storefront when the drop is ready."
      : "Shipping and taxes are not calculated in this local preview.";
  }
  saveCart();
}

function addToCart(button) {
  const name = button.dataset.addItem;
  const price = Number(button.dataset.itemPrice || 0);
  if (!name || !price) return;
  const size = button.closest(".product-card")?.querySelector("[data-item-size]")?.value || "";
  const baseId = productId(name);
  const id = size ? `${baseId}-${size.toLowerCase()}` : baseId;
  const existing = bag.find((item) => item.id === id);
  if (existing) {
    existing.quantity += 1;
  } else {
    bag.push({ id, name, price, size, quantity: 1 });
  }
  updateBag();
  closeWishlist();
  bagDrawer?.classList.add("is-open");
  bagDrawer?.classList.add("is-cart-popping");
  button.classList.add("is-add-popping");

  const oldText = button.textContent;
  button.textContent = "Added";
  window.setTimeout(() => {
    button.textContent = oldText;
    button.classList.remove("is-add-popping");
    bagDrawer?.classList.remove("is-cart-popping");
  }, 900);
}

function changeCartQuantity(id, delta) {
  const index = bag.findIndex((item) => item.id === id);
  if (index < 0) return;
  bag[index].quantity += delta;
  if (bag[index].quantity <= 0) bag.splice(index, 1);
  updateBag();
}

function removeCartItem(id) {
  const index = bag.findIndex((item) => item.id === id);
  if (index < 0) return;
  bag.splice(index, 1);
  updateBag();
}

function copyTextArea(targetId, button) {
  const target = document.getElementById(targetId);
  if (!target) return;
  const copyJob = navigator.clipboard?.writeText
    ? navigator.clipboard.writeText(target.value)
    : Promise.resolve(target.select() || document.execCommand("copy"));
  copyJob.then(() => {
    const oldText = button.textContent;
    button.textContent = "Copied";
    window.setTimeout(() => {
      button.textContent = oldText;
    }, 1200);
  });
}

function pauseMerchIntroAudio(exceptMedia = merchSoundVideo) {
  document.querySelectorAll("audio, video").forEach((media) => {
    if (media === exceptMedia) return;
    const isIntroMedia =
      media.id === "siteSoundtrack" ||
      media.closest("[data-startup-video]") ||
      media.classList.contains("startup-video-player");
    if (media.tagName === "AUDIO" || isIntroMedia || !media.muted) {
      media.pause();
    }
  });
}

function productId(name) {
  return String(name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function initializeProductControls() {
  document.querySelectorAll(".product-card [data-add-item]").forEach((addButton) => {
    const card = addButton.closest(".product-card");
    const name = addButton.dataset.addItem;
    const id = productId(name);
    if (!card || !name || !id) return;

    card.dataset.productId = id;
    if (!card.id) card.id = `product-${id}`;

    if (addButton.dataset.itemSizes && !card.querySelector("[data-item-size]")) {
      const sizeControl = document.createElement("label");
      sizeControl.className = "product-size-control";
      const sizeLabel = document.createElement("span");
      sizeLabel.textContent = "Size";
      const sizeSelect = document.createElement("select");
      sizeSelect.dataset.itemSize = "";
      sizeSelect.setAttribute("aria-label", `Size for ${name}`);
      const labels = { S: "Small", M: "Medium", XL: "XL", XXL: "XXL" };
      addButton.dataset.itemSizes.split(",").forEach((size) => {
        const option = document.createElement("option");
        option.value = size;
        option.textContent = labels[size] || size;
        sizeSelect.append(option);
      });
      sizeControl.append(sizeLabel, sizeSelect);
      addButton.closest(".product-row")?.before(sizeControl);
    }

    if (!card.querySelector("[data-wishlist-toggle]")) {
      const saveButton = document.createElement("button");
      saveButton.type = "button";
      saveButton.className = "product-wishlist-toggle";
      saveButton.dataset.wishlistToggle = id;
      saveButton.dataset.itemName = name;
      saveButton.dataset.itemPrice = addButton.dataset.itemPrice || "0";
      saveButton.dataset.itemTarget = card.id;
      saveButton.title = "Save to wishlist";
      saveButton.setAttribute("aria-pressed", "false");
      saveButton.setAttribute("aria-label", `Save ${name} to wishlist`);
      saveButton.textContent = "\u2661";
      card.append(saveButton);
    }
  });
}

function updateWishlist() {
  document.querySelectorAll("[data-wishlist-count]").forEach((target) => {
    target.textContent = String(wishlist.length);
  });

  document.querySelectorAll("[data-wishlist-toggle]").forEach((button) => {
    const saved = wishlist.some((item) => item.id === button.dataset.wishlistToggle);
    const name = button.dataset.itemName || "item";
    button.classList.toggle("is-saved", saved);
    button.setAttribute("aria-pressed", String(saved));
    button.setAttribute("aria-label", `${saved ? "Remove" : "Save"} ${name} ${saved ? "from" : "to"} wishlist`);
    button.title = saved ? "Remove from wishlist" : "Save to wishlist";
    button.textContent = saved ? "\u2665" : "\u2661";
  });

  if (wishlistItems) {
    wishlistItems.innerHTML = wishlist.length
      ? wishlist.map((item) => `
          <li class="wishlist-line">
            <div><strong>${escapeHtml(item.name)}</strong><span>${formatMoney(item.price)}</span></div>
            <a href="#${escapeHtml(item.target)}" data-wishlist-view>View item</a>
            <button type="button" data-wishlist-remove="${escapeHtml(item.id)}">Remove</button>
          </li>
        `).join("")
      : `<li class="cart-empty">Your wishlist is empty. Use the heart on any product to save it.</li>`;
  }

  if (wishlistNote) {
    wishlistNote.textContent = wishlist.length
      ? `${wishlist.length} saved ${wishlist.length === 1 ? "item" : "items"} on this device.`
      : "Your wishlist is empty.";
  }
  saveWishlist();
}

function toggleWishlistItem(button) {
  const id = button.dataset.wishlistToggle;
  const existingIndex = wishlist.findIndex((item) => item.id === id);
  if (existingIndex >= 0) {
    wishlist.splice(existingIndex, 1);
  } else {
    wishlist.push({
      id,
      name: button.dataset.itemName,
      price: Number(button.dataset.itemPrice || 0),
      target: button.dataset.itemTarget,
    });
  }
  updateWishlist();
}

function openWishlist() {
  bagDrawer?.classList.remove("is-open");
  wishlistDrawer?.classList.add("is-open");
  document.querySelector("[data-wishlist-toggle-drawer]")?.setAttribute("aria-expanded", "true");
}

function closeWishlist() {
  wishlistDrawer?.classList.remove("is-open");
  document.querySelector("[data-wishlist-toggle-drawer]")?.setAttribute("aria-expanded", "false");
}

function restoreMerchVideoSources(video) {
  if (!video) return false;
  let changed = false;
  if (video.dataset.src && !video.hasAttribute("src")) {
    video.setAttribute("src", video.dataset.src);
    changed = true;
  }
  video.querySelectorAll("source").forEach((source) => {
    if (source.dataset.src && !source.hasAttribute("src")) {
      source.setAttribute("src", source.dataset.src);
      changed = true;
    }
  });
  if (changed) video.load();
  return changed;
}

function resetMerchCapsuleVideo() {
  if (!merchSoundVideo) return;
  try {
    merchSoundVideo.currentTime = 0;
  } catch {
    // Some browsers block seeking before metadata is ready.
  }
}

async function playMerchCapsuleSound() {
  if (!merchSoundVideo || !merchSoundToggle) return;
  let played = false;
  pauseMerchIntroAudio();
  restoreMerchVideoSources(merchSoundVideo);
  resetMerchCapsuleVideo();
  try {
    merchSoundVideo.muted = false;
    merchSoundVideo.defaultMuted = false;
    merchSoundVideo.removeAttribute("muted");
    merchSoundVideo.volume = window.LMAudioMix?.levels.preview ?? 0.48;
    window.LMAudioMix?.claim?.(merchSoundVideo);
    await merchSoundVideo.play();
    played = true;
  } catch {
    played = false;
    merchSoundVideo.muted = true;
    merchSoundVideo.play().catch(() => {
      // Unmuted autoplay is browser-gated; muted visual playback is the fallback.
    });
  }
  if (played) {
    merchSoundToggle.textContent = "Sound on";
    merchSoundToggle.classList.add("is-playing");
  } else {
    merchSoundToggle.textContent = "Tap for sound";
    merchSoundToggle.classList.remove("is-playing");
  }
}

function startMerchCapsuleOnPageOpen() {
  if (!merchSoundVideo) return;
  merchSoundVideo.autoplay = false;
  merchSoundVideo.playsInline = true;
  merchSoundVideo.muted = true;
  merchSoundVideo.defaultMuted = true;
  merchSoundVideo.removeAttribute("autoplay");
  merchSoundVideo.setAttribute("playsinline", "");
  merchSoundVideo.setAttribute("muted", "");
  merchSoundVideo.pause();
  if (merchSoundToggle) {
    merchSoundToggle.textContent = "Play film";
    merchSoundToggle.classList.remove("is-playing");
  }
}

function pauseMerchCapsuleSound() {
  if (!merchSoundVideo || !merchSoundToggle) return;
  merchSoundVideo.muted = true;
  merchSoundToggle.textContent = "Play sound";
  merchSoundToggle.classList.remove("is-playing");
}

async function openMerchCommercial() {
  if (!merchCommercialModal || !merchCommercialModalVideo) return;
  merchCommercialReturnFocus = document.activeElement;
  pauseMerchIntroAudio(merchCommercialModalVideo);
  merchSoundVideo?.pause();
  merchCommercialModal.classList.remove("is-hidden");
  merchCommercialModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("has-merch-commercial-modal");
  restoreMerchVideoSources(merchCommercialModalVideo);
  if (merchCommercialModalVideo.readyState === 0) merchCommercialModalVideo.load();
  try {
    merchCommercialModalVideo.currentTime = 0;
  } catch {
    // Seeking can be unavailable until the commercial metadata is ready.
  }
  merchCommercialModalVideo.muted = false;
  merchCommercialModalVideo.volume = window.LMAudioMix?.levels.preview ?? 0.48;
  window.LMAudioMix?.claim?.(merchCommercialModalVideo);
  await merchCommercialModalVideo.play().catch(() => {
    // The native play control remains available if the browser blocks playback.
  });
  merchCommercialClose?.focus();
}

function closeMerchCommercial({ restoreFocus = true } = {}) {
  if (!merchCommercialModal) return;
  merchCommercialModalVideo?.pause();
  merchCommercialModal.classList.add("is-hidden");
  merchCommercialModal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("has-merch-commercial-modal");
  if (merchSoundVideo) {
    merchSoundVideo.muted = true;
    merchSoundVideo.defaultMuted = true;
    merchSoundVideo.setAttribute("muted", "");
    merchSoundVideo.play().catch(() => {});
  }
  if (restoreFocus) merchCommercialReturnFocus?.focus?.();
}

async function replayMerchCommercial() {
  if (!merchCommercialModalVideo) return;
  restoreMerchVideoSources(merchCommercialModalVideo);
  try {
    merchCommercialModalVideo.currentTime = 0;
  } catch {
    // The native controls remain usable if seeking is not ready yet.
  }
  merchCommercialModalVideo.muted = false;
  await merchCommercialModalVideo.play().catch(() => {});
}

function openMerchShadowPopup() {
  if (!merchShadowPopup) return;
  if (merchShadowFrame && !merchShadowFrame.getAttribute("src")) {
    merchShadowFrame.setAttribute("src", merchShadowFrame.dataset.src || "");
  }
  merchShadowPopup.classList.remove("is-hidden");
  merchShadowPopup.setAttribute("aria-hidden", "false");
  document.body.classList.add("has-merch-shadow-popup");
  window.clearTimeout(merchShadowAutoCloseTimer);
  merchShadowAutoCloseTimer = window.setTimeout(() => {
    if (!merchShadowPopup.classList.contains("is-hidden")) closeMerchShadowPopup();
  }, MERCH_SHADOW_AUTO_CLOSE_DELAY);
}

function closeMerchShadowPopup() {
  if (!merchShadowPopup) return;
  window.clearTimeout(merchShadowAutoCloseTimer);
  merchShadowAutoCloseTimer = 0;
  merchShadowPopup.classList.add("is-hidden");
  merchShadowPopup.setAttribute("aria-hidden", "true");
  document.body.classList.remove("has-merch-shadow-popup");
  merchShadowFrame?.removeAttribute("src");
}

function hasAutoShownMerchShadowPopup() {
  try {
    return sessionStorage.getItem(MERCH_SHADOW_AUTO_KEY) === "true";
  } catch {
    return Boolean(window.__lottomindMerchShadowAutoShown);
  }
}

function rememberAutoShownMerchShadowPopup() {
  window.__lottomindMerchShadowAutoShown = true;
  try {
    sessionStorage.setItem(MERCH_SHADOW_AUTO_KEY, "true");
  } catch {
    // Session storage may be unavailable in private browser modes.
  }
}

function scheduleAutoMerchShadowPopup() {
  const directOpen = new URLSearchParams(window.location.search).get("gothtechnology") === "1";
  if (directOpen && merchShadowPopup) {
    rememberAutoShownMerchShadowPopup();
    openMerchShadowPopup();
    return;
  }
  if (!merchShadowPopup || hasAutoShownMerchShadowPopup()) return;
  window.setTimeout(() => {
    if (!merchShadowPopup || hasAutoShownMerchShadowPopup() || document.visibilityState === "hidden") return;
    rememberAutoShownMerchShadowPopup();
    openMerchShadowPopup();
  }, MERCH_SHADOW_AUTO_DELAY);
}

document.addEventListener("pointermove", (event) => {
  merchRoot.style.setProperty("--mx", `${event.clientX}px`);
  merchRoot.style.setProperty("--my", `${event.clientY}px`);
  if (merchSoundCard) {
    const cardRect = merchSoundCard.getBoundingClientRect();
    const insideCard =
      event.clientX >= cardRect.left &&
      event.clientX <= cardRect.right &&
      event.clientY >= cardRect.top &&
      event.clientY <= cardRect.bottom;
    merchSoundCard.classList.toggle("is-hover-grown", insideCard);
  }
  if (!merchHero) return;
  const rect = merchHero.getBoundingClientRect();
  const x = event.clientX - rect.left - rect.width / 2;
  const y = event.clientY - rect.top - rect.height / 2;
  merchHero.style.setProperty("--hero-copy-x", `${x * -0.018}px`);
  merchHero.style.setProperty("--hero-copy-y", `${y * -0.018}px`);
  merchHero.style.setProperty("--hero-product-x", `${x * 0.018}px`);
  merchHero.style.setProperty("--hero-product-y", `${y * 0.018}px`);
});

document.addEventListener("click", (event) => {
  if (event.target.closest("[data-merch-sound-toggle]")) {
    event.preventDefault();
    event.stopPropagation();
    if (merchSoundVideo?.muted) {
      playMerchCapsuleSound();
    } else {
      pauseMerchCapsuleSound();
    }
    return;
  }

  if (event.target.closest("[data-merch-commercial-open]")) {
    event.preventDefault();
    openMerchCommercial();
    return;
  }

  if (event.target.closest("[data-merch-commercial-close]")) {
    event.preventDefault();
    closeMerchCommercial();
    return;
  }

  if (event.target.closest("[data-merch-commercial-replay]")) {
    event.preventDefault();
    replayMerchCommercial();
    return;
  }

  if (event.target.closest("[data-merch-commercial-shop]")) {
    closeMerchCommercial({ restoreFocus: false });
  }

  const wishlistButton = event.target.closest("[data-wishlist-toggle]");
  if (wishlistButton) {
    toggleWishlistItem(wishlistButton);
    return;
  }

  const wishlistRemove = event.target.closest("[data-wishlist-remove]");
  if (wishlistRemove) {
    const index = wishlist.findIndex((item) => item.id === wishlistRemove.dataset.wishlistRemove);
    if (index >= 0) wishlist.splice(index, 1);
    updateWishlist();
    return;
  }

  if (event.target.closest("[data-wishlist-view]")) {
    closeWishlist();
    return;
  }

  if (event.target.closest("[data-wishlist-toggle-drawer]")) {
    if (wishlistDrawer?.classList.contains("is-open")) closeWishlist();
    else openWishlist();
    return;
  }

  if (event.target.closest("[data-wishlist-close]")) {
    closeWishlist();
    return;
  }

  const stripLink = event.target.closest(".merch-strip a[href^='#']");
  if (stripLink) {
    const target = document.getElementById(stripLink.getAttribute("href").slice(1));
    if (target) {
      event.preventDefault();
      const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
      target.scrollIntoView({ behavior, block: "start" });
      history.pushState(null, "", stripLink.getAttribute("href"));
    }
    return;
  }

  const addButton = event.target.closest("[data-add-item]");
  if (addButton) {
    addToCart(addButton);
    return;
  }

  const copyButton = event.target.closest("[data-copy-target]");
  if (copyButton) {
    copyTextArea(copyButton.dataset.copyTarget, copyButton);
    return;
  }

  const increaseButton = event.target.closest("[data-cart-increase]");
  if (increaseButton) {
    changeCartQuantity(increaseButton.dataset.cartIncrease, 1);
    return;
  }

  const decreaseButton = event.target.closest("[data-cart-decrease]");
  if (decreaseButton) {
    changeCartQuantity(decreaseButton.dataset.cartDecrease, -1);
    return;
  }

  const removeButton = event.target.closest("[data-cart-remove]");
  if (removeButton) {
    removeCartItem(removeButton.dataset.cartRemove);
    return;
  }

  if (event.target.closest("[data-cart-clear]")) {
    bag.splice(0, bag.length);
    updateBag();
    return;
  }

  if (event.target.closest("[data-cart-checkout]")) {
    if (cartNote) cartNote.textContent = bag.length
      ? "Checkout is ready to connect. Add a Shopify or Stripe URL when the drop goes live."
      : "Add something to the cart before checkout preview.";
    return;
  }

  if (event.target.closest("[data-bag-toggle]")) {
    closeWishlist();
    bagDrawer?.classList.toggle("is-open");
    return;
  }

  if (event.target.closest("[data-bag-close]")) {
    bagDrawer?.classList.remove("is-open");
  }
});

primeMerchHeroBackgroundVideo();
document.addEventListener("DOMContentLoaded", () => {
  primeMerchHeroBackgroundVideo();
});
merchSoundVideo?.addEventListener("click", (event) => {
  event.preventDefault();
  playMerchCapsuleSound();
});
merchSoundVideo?.addEventListener("play", () => pauseMerchIntroAudio(merchSoundVideo));
merchSoundVideo?.addEventListener("volumechange", () => {
  if (!merchSoundVideo.muted) {
    pauseMerchIntroAudio();
    resetMerchCapsuleVideo();
  }
});

window.addEventListener("load", () => {
  primeMerchHeroBackgroundVideo();
  window.setTimeout(startMerchCapsuleOnPageOpen, 180);
  scheduleAutoMerchShadowPopup();
});

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startMerchCapsuleOnPageOpen, { once: true });
} else {
  startMerchCapsuleOnPageOpen();
}

window.addEventListener("pageshow", () => {
  primeMerchHeroBackgroundVideo();
  startMerchCapsuleOnPageOpen();
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    startMerchCapsuleOnPageOpen();
  }
});

merchShadowCloseButtons.forEach((button) => button.addEventListener("click", closeMerchShadowPopup));
window.addEventListener("lm:merch-shadow-open", openMerchShadowPopup);
merchShadowFrame?.addEventListener("focus", () => {
  window.clearTimeout(merchShadowAutoCloseTimer);
  merchShadowAutoCloseTimer = 0;
});
window.addEventListener("blur", () => {
  if (document.activeElement === merchShadowFrame) {
    window.clearTimeout(merchShadowAutoCloseTimer);
    merchShadowAutoCloseTimer = 0;
  }
});
merchShadowPopup?.addEventListener("click", (event) => {
  if (event.target === merchShadowPopup) {
    closeMerchShadowPopup();
  }
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !merchCommercialModal?.classList.contains("is-hidden")) {
    closeMerchCommercial();
    return;
  }
  if (event.key === "Escape" && !merchShadowPopup?.classList.contains("is-hidden")) {
    closeMerchShadowPopup();
    return;
  }
  if (event.key === "Escape" && wishlistDrawer?.classList.contains("is-open")) {
    closeWishlist();
    return;
  }
  if (event.key === "Escape" && bagDrawer?.classList.contains("is-open")) {
    bagDrawer.classList.remove("is-open");
  }
});

merchCommercialModal?.addEventListener("click", (event) => {
  if (event.target === merchCommercialModal) closeMerchCommercial();
});

const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
      }
    });
  },
  { threshold: 0.18 },
);

document.querySelectorAll(".merch-store-page [data-reveal]").forEach((section) => revealObserver.observe(section));

initializeProductControls();
updateBag();
updateWishlist();

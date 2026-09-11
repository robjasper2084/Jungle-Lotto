// Browser-local shopping list only. Checkout must reprice and validate on a server.
export const MERCH_CART_STORAGE_KEY = "lottomind.merch.cart.v1";
export const MERCH_CART_MAX_QUANTITY = 99;

export function createMerchCart({ catalog, getPriceCents, storage = null }) {
  const products = new Map(catalog.map((item) => [item.priceKey, item]));
  let quantities = new Map();
  let persistent = Boolean(storage);

  function priceCents(key) {
    const value = getPriceCents(key);
    return Number.isSafeInteger(value) && value > 0 && value <= 100000000 ? value : null;
  }

  function supported(key) {
    return typeof key === "string" && products.has(key) && priceCents(key) !== null;
  }

  function normalize(items) {
    const next = new Map();
    if (!Array.isArray(items)) return next;
    for (const item of items.slice(0, 500)) {
      if (!item || !supported(item.priceKey) || !Number.isInteger(item.quantity) || item.quantity < 1) continue;
      next.set(item.priceKey, Math.min(MERCH_CART_MAX_QUANTITY, (next.get(item.priceKey) || 0) + item.quantity));
    }
    return next;
  }

  function snapshot() {
    const lines = [];
    for (const [priceKey, quantity] of quantities) {
      if (!supported(priceKey)) continue;
      const product = products.get(priceKey);
      const unitPriceCents = priceCents(priceKey);
      lines.push({ priceKey, title: product.title, art: product.art, quantity, unitPriceCents, totalCents: unitPriceCents * quantity });
    }
    return {
      lines,
      itemCount: lines.reduce((sum, line) => sum + line.quantity, 0),
      subtotalCents: lines.reduce((sum, line) => sum + line.totalCents, 0),
      currency: "USD",
      maxQuantity: MERCH_CART_MAX_QUANTITY,
      storageStatus: persistent ? "saved" : "session-only",
    };
  }

  function reload() {
    if (!storage) return snapshot();
    try {
      const raw = storage.getItem(MERCH_CART_STORAGE_KEY);
      let saved = null;
      try { saved = raw && raw.length <= 50000 ? JSON.parse(raw) : null; } catch { /* Ignore malformed browser data. */ }
      quantities = normalize(saved?.version === 1 ? saved.items : []);
      persistent = true;
    } catch {
      persistent = false;
    }
    return snapshot();
  }

  function save() {
    // Never persist prices, totals, payment data, wallet values, or catalog HTML.
    const items = snapshot().lines.map(({ priceKey, quantity }) => ({ priceKey, quantity }));
    quantities = normalize(items);
    try {
      if (!storage) throw new Error("Storage unavailable");
      storage.setItem(MERCH_CART_STORAGE_KEY, JSON.stringify({ version: 1, items }));
      persistent = true;
    } catch {
      persistent = false;
    }
    return { ok: true, snapshot: snapshot() };
  }

  reload();
  return Object.freeze({
    snapshot,
    reload,
    add(priceKey) {
      if (!supported(priceKey)) return { ok: false, reason: "unavailable" };
      const quantity = quantities.get(priceKey) || 0;
      if (quantity >= MERCH_CART_MAX_QUANTITY) return { ok: false, reason: "limit" };
      quantities.set(priceKey, quantity + 1);
      return save();
    },
    setQuantity(priceKey, quantity) {
      if (!supported(priceKey) || !quantities.has(priceKey)) return { ok: false, reason: "unavailable" };
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > MERCH_CART_MAX_QUANTITY) return { ok: false, reason: "quantity" };
      quantities.set(priceKey, quantity);
      return save();
    },
    remove(priceKey) {
      quantities.delete(priceKey);
      return save();
    },
  });
}

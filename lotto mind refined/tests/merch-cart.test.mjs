import assert from "node:assert/strict";
import test from "node:test";
import { createMerchCart, MERCH_CART_STORAGE_KEY, MERCH_CART_MAX_QUANTITY } from "../services/merch-cart.mjs";

const catalog = [{ priceKey: "hoodie", title: "Hoodie", art: "hoodie.webp" }, { priceKey: "cap", title: "Cap", art: "cap.webp" }];
function setup(raw = null, customStorage) {
  const saved = new Map(raw === null ? [] : [[MERCH_CART_STORAGE_KEY, raw]]);
  const storage = customStorage ?? { getItem: (key) => saved.get(key), setItem: (key, value) => saved.set(key, value) };
  const prices = { hoodie: 6400, cap: 3450 };
  const cart = createMerchCart({ catalog, getPriceCents: (key) => prices[key], storage });
  return { cart, prices, storage, saved };
}

test("cart begins empty and totals use integer cents", () => {
  const { cart } = setup();
  assert.equal(cart.snapshot().itemCount, 0);
  assert.equal(cart.snapshot().subtotalCents, 0);
  cart.add("hoodie"); cart.add("cap"); cart.add("cap");
  assert.equal(cart.snapshot().lines.length, 2);
  assert.equal(cart.snapshot().itemCount, 3);
  assert.equal(cart.snapshot().subtotalCents, 13300);
  assert.equal(cart.snapshot().currency, "USD");
});

test("quantities update, items remove, and the last removal restores an empty cart", () => {
  const { cart } = setup();
  cart.add("hoodie");
  assert.equal(cart.setQuantity("hoodie", 3).ok, true);
  assert.equal(cart.snapshot().subtotalCents, 19200);
  assert.equal(cart.setQuantity("hoodie", 1).ok, true);
  cart.remove("hoodie");
  assert.equal(cart.snapshot().itemCount, 0);
  assert.equal(cart.snapshot().subtotalCents, 0);
});

test("saved IDs and quantities survive reload without storing wallet or payment values", () => {
  const { cart, saved, storage } = setup();
  cart.add("hoodie"); cart.add("cap");
  assert.deepEqual([...saved.keys()], [MERCH_CART_STORAGE_KEY]);
  assert.deepEqual(JSON.parse(saved.get(MERCH_CART_STORAGE_KEY)), { version: 1, items: [{ priceKey: "hoodie", quantity: 1 }, { priceKey: "cap", quantity: 1 }] });
  assert.equal(setup(null, storage).cart.snapshot().subtotalCents, 9850);
});

test("stored prices, totals, HTML, and retired products are never trusted", () => {
  const { cart, prices } = setup(JSON.stringify({ version: 1, subtotalCents: 1, items: [
    { priceKey: "hoodie", quantity: 2, unitPriceCents: 1, title: "<script>bad</script>" },
    { priceKey: "retired", quantity: 1 }, { priceKey: "__proto__", quantity: 1 },
  ] }));
  assert.equal(cart.snapshot().lines.length, 1);
  assert.equal(cart.snapshot().lines[0].title, "Hoodie");
  assert.equal(cart.snapshot().subtotalCents, 12800);
  prices.hoodie = 7000;
  assert.equal(cart.snapshot().subtotalCents, 14000);
});

test("invalid or oversized saved data safely produces an empty cart", () => {
  for (const raw of ["{broken", "null", JSON.stringify({ version: 2, items: [{ priceKey: "cap", quantity: 1 }] }), "x".repeat(50001)]) {
    assert.equal(setup(raw).cart.snapshot().itemCount, 0);
  }
});

test("saved duplicate lines merge and clamp to the supported quantity limit", () => {
  const raw = JSON.stringify({ version: 1, items: [{ priceKey: "cap", quantity: 80 }, { priceKey: "cap", quantity: 80 }, { priceKey: "hoodie", quantity: 1.5 }] });
  const { cart } = setup(raw);
  assert.equal(cart.snapshot().itemCount, MERCH_CART_MAX_QUANTITY);
  assert.equal(cart.snapshot().lines.length, 1);
  assert.equal(cart.add("cap").reason, "limit");
});

test("quantity mutation rejects negative, zero, non-integer and excessive amounts", () => {
  const { cart } = setup(); cart.add("cap");
  for (const value of [0, -1, 1.5, "2", NaN, Infinity, 100]) assert.equal(cart.setQuantity("cap", value).ok, false);
  assert.equal(cart.snapshot().itemCount, 1);
});

test("unknown products or missing prices cannot be added", () => {
  const { cart, prices } = setup();
  for (const key of ["unknown", "__proto__", null, {}]) assert.equal(cart.add(key).ok, false);
  for (const price of [0, -1, 1.5, NaN, Infinity, 100000001]) { prices.cap = price; assert.equal(cart.add("cap").ok, false); }
  assert.equal(cart.snapshot().itemCount, 0);
});

test("storage denial and quota errors keep an honest session-only cart", () => {
  const storage = { getItem() { throw Error("Denied"); }, setItem() { throw Error("Quota exceeded"); } };
  const { cart } = setup(null, storage);
  assert.equal(cart.add("hoodie").ok, true);
  assert.equal(cart.snapshot().storageStatus, "session-only");
  assert.equal(cart.snapshot().subtotalCents, 6400);
  cart.reload();
  assert.equal(cart.snapshot().itemCount, 1);
});

test("missing storage still supports add and remove for the session", () => {
  const cart = createMerchCart({ catalog, getPriceCents: () => 100 });
  cart.add("cap");
  assert.equal(cart.snapshot().storageStatus, "session-only");
  assert.equal(cart.snapshot().itemCount, 1);
  cart.remove("cap");
  assert.equal(cart.snapshot().subtotalCents, 0);
});

test("a reload sees another tab's update and clear", () => {
  const { cart, saved } = setup(); cart.add("cap");
  saved.set(MERCH_CART_STORAGE_KEY, JSON.stringify({ version: 1, items: [{ priceKey: "hoodie", quantity: 3 }] }));
  assert.equal(cart.reload().subtotalCents, 19200);
  saved.delete(MERCH_CART_STORAGE_KEY);
  assert.equal(cart.reload().itemCount, 0);
});

test("snapshot mutation does not alter the cart", () => {
  const { cart } = setup(); cart.add("cap");
  const snapshot = cart.snapshot(); snapshot.lines[0].quantity = 90; snapshot.lines.length = 0;
  assert.equal(cart.snapshot().itemCount, 1);
});

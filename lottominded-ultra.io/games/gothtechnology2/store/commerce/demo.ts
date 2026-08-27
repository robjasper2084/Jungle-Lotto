import type { Cart, CommerceProvider, Product, StoragePort } from './types.ts';
import { demoProducts, collections } from '../content/catalog.ts';
import { multiply, quantity, subtotal } from './money.ts';

export const DEMO_CART_KEY = 'gothtechnology.armory.cart.demo.v1';
type SavedLine = { variantId: string; quantity: number };
export class DemoProvider implements CommerceProvider {
  private saved: SavedLine[] = [];
  private warnings: string[] = [];
  constructor(private storage: StoragePort | null = null, private products: Product[] = demoProducts) {
    try {
      const raw = JSON.parse(storage?.getItem(DEMO_CART_KEY) ?? 'null');
      if (raw?.version === 1 && Array.isArray(raw.lines)) {
        for (const line of raw.lines.slice(0, 100)) {
          if (typeof line?.variantId !== 'string' || !Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > 99) continue;
          const match = this.find(line.variantId);
          if (!match?.variant.available || this.saved.some(x => x.variantId === line.variantId)) continue;
          this.saved.push({ variantId: line.variantId, quantity: line.quantity });
        }
      }
    } catch { this.warnings = ['Saved cart could not be read. You can continue with a new loadout.']; }
  }
  private find(id: string) {
    const product = this.products.find(p => p.variants.some(v => v.id === id));
    const variant = product?.variants.find(v => v.id === id);
    return product && variant ? { product, variant } : null;
  }
  private cart(): Cart {
    const lines = this.saved.flatMap(saved => {
      const item = this.find(saved.variantId);
      if (!item?.variant.available) return [];
      const { product, variant } = item;
      return [{ id: variant.id, variantId: variant.id, productHandle: product.handle, title: product.title,
        image: product.images[0] ?? null, size: variant.size, color: variant.color, quantity: saved.quantity,
        price: { ...variant.price }, total: multiply(variant.price, saved.quantity) }];
    });
    return { id: 'demo-loadout', lines, subtotal: subtotal(lines.map(l => l.total), lines[0]?.price.currency ?? 'USD'),
      totalQuantity: lines.reduce((sum, l) => sum + l.quantity, 0), checkoutUrl: null, demo: true, warnings: [...this.warnings] };
  }
  private persist() {
    try { this.storage?.setItem(DEMO_CART_KEY, JSON.stringify({ version: 1, lines: this.saved })); }
    catch { this.warnings = ['Storage is unavailable. Your loadout will last for this page only.']; }
    return this.cart();
  }
  private assertId(id: string) { if (id !== 'demo-loadout') throw new Error('This cart expired. Open a new loadout.'); }
  async getProducts() { return structuredClone(this.products); }
  async getProduct(handle: string) { return structuredClone(this.products.find(p => p.handle === handle) ?? null); }
  async getCollections() { return structuredClone(collections); }
  async createCart() { return this.cart(); }
  async getCart(id: string) { return id === 'demo-loadout' ? this.cart() : null; }
  async addCartLine(id: string, variantId: string, count: number) {
    this.assertId(id); quantity(count);
    if (!this.find(variantId)?.variant.available) throw new Error('This variant is unavailable. Select another option.');
    const line = this.saved.find(l => l.variantId === variantId);
    if (line) line.quantity = quantity(line.quantity + count);
    else { if (this.saved.length >= 100) throw new Error('Your loadout has reached its item limit.'); this.saved.push({ variantId, quantity: count }); }
    return this.persist();
  }
  async updateCartLine(id: string, lineId: string, count: number) {
    this.assertId(id); quantity(count);
    const line = this.saved.find(l => l.variantId === lineId);
    if (!line) throw new Error('This item is no longer in your loadout.');
    line.quantity = count; return this.persist();
  }
  async removeCartLine(id: string, lineId: string) {
    this.assertId(id); this.saved = this.saved.filter(l => l.variantId !== lineId); return this.persist();
  }
  async getCheckoutUrl(_id: string): Promise<string> {
    throw new Error('Demo store: payments are disabled. The owner must connect Shopify and approve products and policies before checkout opens. No order has been placed.');
  }
}

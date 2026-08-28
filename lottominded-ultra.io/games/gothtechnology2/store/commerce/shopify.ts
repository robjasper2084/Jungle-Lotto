import type { Cart, Collection, CommerceProvider, Product, Variant } from './types.ts';
import { productInformation } from '../content/launch.ts';
import { fromDecimal, quantity } from './money.ts';

const variantFields = 'id title availableForSale price { amount currencyCode } selectedOptions { name value }';
const productFields = `id handle title description productType tags availableForSale
  priceRange { minVariantPrice { amount currencyCode } }
  images(first: 12) { nodes { url altText width height } }
  collections(first: 20) { nodes { handle } }
  variants(first: 250) { nodes { ${variantFields} } pageInfo { hasNextPage endCursor } }
  seo { title description }`;
const cartFields = `id checkoutUrl totalQuantity cost { subtotalAmount { amount currencyCode } }
  lines(first: 250) { nodes { id quantity cost { totalAmount { amount currencyCode } amountPerQuantity { amount currencyCode } }
    merchandise { ... on ProductVariant { ${variantFields} image { url altText width height } product { handle title } } }
  } pageInfo { hasNextPage endCursor } }`;

type PageInfo = {hasNextPage: boolean; endCursor?: string | null};
type Connection<T> = {nodes?: T[]; edges?: {node:T}[]; pageInfo?: PageInfo};
type ApiMoney = {amount:string; currencyCode:string};
type ApiImage = {url:string; altText?:string|null; width?:number; height?:number};
type ApiVariant = {id:string;title:string;availableForSale:boolean;price:ApiMoney;selectedOptions?:{name:string;value:string}[];image?:ApiImage|null;product?:{handle:string;title:string}};
type ApiProduct = {id:string;handle:string;title:string;description?:string;productType?:string;tags?:string[];priceRange:{minVariantPrice:ApiMoney};images?:Connection<ApiImage>;collections?:Connection<{handle:string}>;variants:Connection<ApiVariant>;seo?:{title?:string;description?:string}};
type ApiCart = {id:string;checkoutUrl?:string|null;totalQuantity:number;cost:{subtotalAmount:ApiMoney};lines:Connection<{id:string;quantity:number;cost:{totalAmount:ApiMoney;amountPerQuantity:ApiMoney};merchandise:ApiVariant}>};
function nodes<T>(connection: Connection<T> | null | undefined): T[] { return connection?.nodes ?? connection?.edges?.map(edge => edge.node) ?? []; }
function safeImage(url: string): string {
  try { const parsed = new URL(url); return parsed.protocol === 'https:' && !parsed.username && !parsed.password ? parsed.href : ''; } catch { return ''; }
}
function variant(raw: ApiVariant): Variant {
  if (!raw || typeof raw.id !== 'string' || !raw.id || typeof raw.title !== 'string' || typeof raw.availableForSale !== 'boolean') throw new Error('Shopify returned an invalid variant.');
  const option = (name: string) => raw.selectedOptions?.find((o) => o.name.toLowerCase() === name)?.value;
  return { id: raw.id, title: raw.title, size: option('size') ?? 'One size', color: option('color') ?? option('colour') ?? 'Default',
    available: raw.availableForSale === true, price: fromDecimal(raw.price.amount, raw.price.currencyCode) };
}
export function normalizeProduct(raw: ApiProduct): Product {
  if (!raw?.id || !/^[a-z0-9][a-z0-9-]*$/.test(raw.handle) || !raw.title) throw new Error('Shopify returned an invalid product.');
  const variants = nodes(raw.variants).map(variant);
  if (!variants.length) throw new Error('Shopify returned a product without variants.');
  const collectionHandles = nodes(raw.collections).map(c => c.handle);
  return { id: raw.id, handle: raw.handle, title: raw.title, subtitle: raw.productType || 'GOTHTECHNOLOGY equipment',
    description: raw.description || '', price: fromDecimal(raw.priceRange.minVariantPrice.amount, raw.priceRange.minVariantPrice.currencyCode),
    compareAtPrice: null, productType: raw.productType || 'Apparel', collection: collectionHandles[0] ?? '', collections: collectionHandles,
    tags: raw.tags ?? [], images: nodes(raw.images).map((im, i) => ({ src: safeImage(im.url), alt: im.altText || raw.title,
      label: `Product reference ${i + 1}`, width: im.width, height: im.height })).filter(im => im.src),
    model: null, video: null, information: productInformation(raw.handle), colors: [...new Set(variants.map(v => v.color))], sizes: [...new Set(variants.map(v => v.size))], variants,
    inventory: null, materials: null, fabricWeight: null, finish: null, careInstructions: null, shippingMessage: null, returnMessage: null,
    featured: raw.tags?.includes('featured') ?? false, digital: raw.tags?.includes('digital') ?? false,
    preorder: raw.tags?.includes('preorder') ?? false, demo: false, characterAssociation: '',
    seo: { title: raw.seo?.title || raw.title, description: raw.seo?.description || raw.description || '' },
  };
}
export function normalizeCart(raw: ApiCart | null | undefined): Cart {
  if (!raw?.id || !raw.cost?.subtotalAmount) throw new Error('Shopify did not return a cart. Refresh your loadout and try again.');
  if (raw.lines?.pageInfo?.hasNextPage) throw new Error('This cart has more than 250 lines. Continue at Shopify checkout.');
  const lines = nodes(raw.lines).map(line => {
    const merchandise = line.merchandise;
    if (!merchandise?.product) throw new Error('A cart item is no longer available. Refresh your loadout.');
    const v = variant(merchandise);
    return { id: line.id, variantId: v.id, productHandle: merchandise.product.handle, title: merchandise.product.title,
      image: merchandise.image ? { src: safeImage(merchandise.image.url), alt: merchandise.image.altText || merchandise.product.title, label: 'Product' } : null,
      size: v.size, color: v.color, quantity: quantity(line.quantity),
      price: fromDecimal(line.cost.amountPerQuantity.amount, line.cost.amountPerQuantity.currencyCode),
      total: fromDecimal(line.cost.totalAmount.amount, line.cost.totalAmount.currencyCode) };
  });
  return { id: raw.id, lines, subtotal: fromDecimal(raw.cost.subtotalAmount.amount, raw.cost.subtotalAmount.currencyCode),
    totalQuantity: raw.totalQuantity, checkoutUrl: raw.checkoutUrl || null, demo: false, warnings: [] };
}
export function validateCheckoutUrl(value: string, domains: string[]): string {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.port || !domains.includes(url.hostname)) {
    throw new Error('Checkout returned an unexpected address. Contact the store; no payment was sent.');
  }
  return url.href;
}
export class ShopifyProvider implements CommerceProvider {
  private endpoint: string;
  private checkoutDomains: string[];
  constructor(private settings: { domain: string; token: string; version: string; checkoutDomain?: string }, private fetcher: typeof fetch = fetch) {
    if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(settings.domain) || !/^\d{4}-(01|04|07|10)$/.test(settings.version)) {
      throw new Error('Set a valid Shopify store domain and a stable API version.');
    }
    if (!/^[a-f0-9]{32}$/i.test(settings.token)) throw new Error('Use a public Shopify Storefront token, never an Admin or private token.');
    this.endpoint = `https://${settings.domain}/api/${settings.version}/graphql.json`;
    this.checkoutDomains = [settings.domain, 'checkout.shopify.com', 'shop.app'];
    if (settings.checkoutDomain && /^[a-z0-9.-]+\.[a-z]+$/.test(settings.checkoutDomain)) this.checkoutDomains.push(settings.checkoutDomain);
  }
  private async request<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
    let response: Response;
    try { response = await this.fetcher(this.endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Shopify-Storefront-Access-Token': this.settings.token },
      body: JSON.stringify({ query, variables }), signal: AbortSignal.timeout(12000), credentials: 'omit' }); }
    catch { throw new Error('Shopify could not be reached. Check your connection, refresh the loadout, and try again.'); }
    if (!response.ok) throw new Error(`Shopify is unavailable (HTTP ${response.status}). Please retry shortly.`);
    const result: unknown = await response.json();
    if (!result || typeof result !== 'object' || ('errors' in result && Array.isArray(result.errors) && result.errors.length) || !('data' in result) || !result.data) throw new Error('Shopify could not complete this request. Check Storefront API access and configuration.');
    // Typed GraphQL response boundary; normalizers below validate identifiers, prices and variants.
    return result.data as T;
  }
  private async completeVariants(raw: ApiProduct) {
    while (raw.variants.pageInfo?.hasNextPage) {
      const cursor = raw.variants.pageInfo.endCursor;
      const data = await this.request<{product:{variants:Connection<ApiVariant>}|null}>(`query Variants($handle: String!, $after: String) { product(handle: $handle) { variants(first:250, after:$after) { nodes { ${variantFields} } pageInfo { hasNextPage endCursor } } } }`, { handle: raw.handle, after: cursor });
      if (!data.product || data.product.variants.pageInfo?.endCursor === cursor) throw new Error('Product options could not be loaded completely.');
      raw.variants = { nodes: [...nodes(raw.variants), ...nodes(data.product.variants)], pageInfo: data.product.variants.pageInfo };
    }
    return normalizeProduct(raw);
  }
  async getProducts(): Promise<Product[]> {
    const products: Product[] = []; let after: string | null = null;
    do {
      const data: {products:Connection<ApiProduct>} = await this.request<{products:Connection<ApiProduct>}>(`query Products($after:String) { products(first:50, after:$after, sortKey:CREATED_AT) { nodes { ${productFields} } pageInfo { hasNextPage endCursor } } }`, { after });
      for (const raw of nodes(data.products)) products.push(await this.completeVariants(raw));
      const next: string | null = data.products.pageInfo?.hasNextPage ? data.products.pageInfo.endCursor ?? null : null;
      if (next && next === after) throw new Error('Shopify catalog pagination did not advance.');
      after = next;
    } while (after);
    return products;
  }
  async getProduct(handle: string) {
    const data = await this.request<{product:ApiProduct|null}>(`query Product($handle:String!) { product(handle:$handle) { ${productFields} } }`, { handle });
    return data.product ? this.completeVariants(data.product) : null;
  }
  async getCollections(): Promise<Collection[]> {
    const all: Collection[] = []; let after: string | null = null;
    do {
      const data: {collections:Connection<Collection>} = await this.request<{collections:Connection<Collection>}>('query Collections($after:String) { collections(first:100, after:$after) { nodes { handle title description } pageInfo { hasNextPage endCursor } } }', { after });
      all.push(...nodes(data.collections));
      const next: string | null = data.collections.pageInfo?.hasNextPage ? data.collections.pageInfo.endCursor ?? null : null;
      if (next && next === after) throw new Error('Shopify collection pagination did not advance.');
      after = next;
    } while (after);
    return all;
  }
  private async mutate(name: string, declarations: string, args: string, variables: Record<string, unknown>): Promise<Cart> {
    const data = await this.request<Record<string,{cart:ApiCart|null;userErrors?:{message:string}[];warnings?:{message:string}[]}>>(`mutation Change(${declarations}) { ${name}(${args}) { cart { ${cartFields} } userErrors { message } warnings { message } } }`, variables);
    const payload = data[name];
    if (payload?.userErrors?.length) throw new Error(payload.userErrors.map((e) => e.message).join(' '));
    const cart = normalizeCart(payload?.cart);
    cart.warnings = (payload.warnings ?? []).map((w) => w.message);
    return cart;
  }
  async createCart() { return this.mutate('cartCreate', '$input:CartInput!', 'input:$input', { input: {} }); }
  async getCart(id: string) {
    const data = await this.request<{cart:ApiCart|null}>(`query Cart($id:ID!) { cart(id:$id) { ${cartFields} } }`, { id });
    return data.cart ? normalizeCart(data.cart) : null;
  }
  async addCartLine(cartId: string, merchandiseId: string, count: number) {
    return this.mutate('cartLinesAdd', '$cartId:ID!, $lines:[CartLineInput!]!', 'cartId:$cartId, lines:$lines', { cartId, lines: [{ merchandiseId, quantity: quantity(count) }] });
  }
  async updateCartLine(cartId: string, id: string, count: number) {
    return this.mutate('cartLinesUpdate', '$cartId:ID!, $lines:[CartLineUpdateInput!]!', 'cartId:$cartId, lines:$lines', { cartId, lines: [{ id, quantity: quantity(count) }] });
  }
  async removeCartLine(cartId: string, id: string) {
    return this.mutate('cartLinesRemove', '$cartId:ID!, $lineIds:[ID!]!', 'cartId:$cartId, lineIds:$lineIds', { cartId, lineIds: [id] });
  }
  async getCheckoutUrl(id: string) {
    const cart = await this.getCart(id);
    if (!cart?.lines.length || !cart.checkoutUrl) throw new Error('Your loadout is empty or expired. Add an item before checkout.');
    return validateCheckoutUrl(cart.checkoutUrl, this.checkoutDomains);
  }
}

export type Money = { amount: number; currency: string };
export type ProductImage = { src: string; alt: string; label: string; width?: number; height?: number };
export type Variant = { id: string; title: string; size: string; color: string; available: boolean; price: Money };
export type Product = {
  id: string; handle: string; title: string; subtitle: string; description: string;
  price: Money; compareAtPrice: Money | null; productType: string; collection: string;
  collections: string[]; tags: string[]; images: ProductImage[]; model: string | null;
  video: string | null; colors: string[]; sizes: string[]; variants: Variant[];
  inventory: number | null; materials: string; fabricWeight: string; finish: string;
  careInstructions: string; shippingMessage: string; returnMessage: string;
  featured: boolean; digital: boolean; preorder: boolean; demo: boolean;
  characterAssociation: string; seo: { title: string; description: string };
};
export type Collection = { handle: string; title: string; description: string };
export type CartLine = { id: string; variantId: string; productHandle: string; title: string;
  image: ProductImage | null; size: string; color: string; quantity: number; price: Money; total: Money };
export type Cart = { id: string; lines: CartLine[]; subtotal: Money; totalQuantity: number;
  checkoutUrl: string | null; demo: boolean; warnings: string[] };
export interface CommerceProvider {
  getProducts(): Promise<Product[]>;
  getProduct(handle: string): Promise<Product | null>;
  getCollections(): Promise<Collection[]>;
  createCart(): Promise<Cart>;
  getCart(cartId: string): Promise<Cart | null>;
  addCartLine(cartId: string, variantId: string, quantity: number): Promise<Cart>;
  updateCartLine(cartId: string, lineId: string, quantity: number): Promise<Cart>;
  removeCartLine(cartId: string, lineId: string): Promise<Cart>;
  getCheckoutUrl(cartId: string): Promise<string>;
}
export type StoragePort = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

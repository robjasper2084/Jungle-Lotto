export type Money = { amount: number; currency: string };
export type MediaKind = 'SUPPLIED PRODUCT REFERENCE' | 'CAMPAIGN CONCEPT' | 'DETAIL REFERENCE' | 'SCALE REFERENCE' | '2.5D DISPLAY' | 'VERIFIED PRODUCT PHOTOGRAPHY';
export type ProductImage = { src: string; alt: string; label: string; kind?: MediaKind; width?: number; height?: number };
export type ProductInformation = {
  materials: string | null; fabricWeight: string | null; construction: string | null;
  finish: string | null; measurements: string | null; sizeGuide: string | null;
  modelMeasurements: string | null; careInstructions: string | null;
  countryOfManufacture: string | null; sku: string | null; inventory: number | null;
  processingTime: string | null; shippingMessage: string | null; returnMessage: string | null;
  includedItems: string | null; digitalContents: string | null; fileFormats: string | null;
  deliveryMethod: string | null; licenseInformation: string | null; refundLimitations: string | null;
  productionStatus: 'concept' | 'sampling' | 'approved';
  photographyStatus: 'reference' | 'approved'; priceApproved: boolean;
};
export type Variant = { id: string; title: string; size: string; color: string; available: boolean; price: Money };
export type Product = {
  id: string; handle: string; title: string; subtitle: string; description: string;
  price: Money; compareAtPrice: Money | null; productType: string; collection: string;
  collections: string[]; tags: string[]; images: ProductImage[]; cardImage?: ProductImage; model: string | null;
  video: string | null; colors: string[]; sizes: string[]; variants: Variant[];
  information: ProductInformation;
  inventory: number | null; materials: string | null; fabricWeight: string | null; finish: string | null;
  careInstructions: string | null; shippingMessage: string | null; returnMessage: string | null;
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

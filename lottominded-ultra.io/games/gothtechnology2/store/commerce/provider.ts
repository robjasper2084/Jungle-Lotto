import { DemoProvider } from './demo.ts';
import { ShopifyProvider } from './shopify.ts';
import { config } from '../config.ts';
import type { StoragePort, CommerceProvider } from './types.ts';
export function createProvider(storage: StoragePort | null = null): CommerceProvider {
  return config.commerceMode === 'shopify' ? new ShopifyProvider(config.shopify) : new DemoProvider(storage);
}
// Share read-only build fetches across static routes without sharing shopper carts.
const source = createProvider();
let productRequest: ReturnType<CommerceProvider['getProducts']> | undefined;
let collectionRequest: ReturnType<CommerceProvider['getCollections']> | undefined;
export const buildProvider = {
  getProducts: () => productRequest ??= source.getProducts(),
  getCollections: () => collectionRequest ??= source.getCollections(),
};

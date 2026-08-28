import { DemoProvider } from './demo.ts';
import { ShopifyProvider } from './shopify.ts';
import { config } from '../config.ts';
import type { StoragePort, CommerceProvider, Product } from './types.ts';
import { conversionMode, launchReadiness } from './mode.ts';
import { demoProducts } from '../content/catalog.ts';
export function createProvider(storage: StoragePort | null = null, products: Product[] = demoProducts): CommerceProvider {
  return conversionMode(products) === 'commerce' ? new ShopifyProvider(config.shopify) : new DemoProvider(storage, products);
}
// Share read-only build fetches across static routes without sharing shopper carts.
const source = config.commerceMode === 'shopify' ? new ShopifyProvider(config.shopify) : new DemoProvider();
let productRequest: ReturnType<CommerceProvider['getProducts']> | undefined;
let collectionRequest: ReturnType<CommerceProvider['getCollections']> | undefined;
export const buildProvider = {
  getProducts: () => productRequest ??= source.getProducts().then(products => {
    if (config.commerceMode === 'shopify' && config.launchApproved) {
      const readiness = launchReadiness(products);
      if (!readiness.ready) throw new Error('Launch blocked:\n' + readiness.issues.join('\n'));
    }
    return products;
  }),
  getCollections: () => collectionRequest ??= source.getCollections(),
};

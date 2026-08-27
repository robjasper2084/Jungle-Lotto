export const features = Object.freeze({ enable3DHero: true, enableProductModels: true,
  enableStoreAudio: true, enableCommercialTransmissions: true, enableGameRewards: true,
  enableMonetaryGameRewards: false, enableWishlist: false, enableCustomerAccounts: false });
export function createConfig(env: Record<string, string | undefined> = {}) {
  const mode = env.PUBLIC_COMMERCE_MODE || 'demo';
  if (!['demo', 'shopify'].includes(mode)) throw new Error('PUBLIC_COMMERCE_MODE must be demo or shopify.');
  return { commerceMode: mode as 'demo' | 'shopify', features,
    shopify: { domain: env.PUBLIC_SHOPIFY_STORE_DOMAIN || '', token: env.PUBLIC_SHOPIFY_STOREFRONT_TOKEN || '',
      version: env.PUBLIC_SHOPIFY_API_VERSION || '2026-07', checkoutDomain: env.PUBLIC_SHOPIFY_CHECKOUT_DOMAIN || '' },
    newsletterEndpoint: env.PUBLIC_NEWSLETTER_ENDPOINT || '', contactEmail: env.PUBLIC_CONTACT_EMAIL || '',
    launchApproved: env.PUBLIC_LAUNCH_APPROVED === 'true',
  };
}
export const config = createConfig(import.meta.env ?? {});

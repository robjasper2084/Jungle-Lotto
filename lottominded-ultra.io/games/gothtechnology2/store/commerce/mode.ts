import { config } from '../config.ts';
import { launchOwner, type LaunchOwner } from '../content/launch.ts';
import type { Product, ProductInformation } from './types.ts';

export type ConversionMode = 'interest' | 'commerce';
export function productReadiness(product: Product): string[] {
  const issues: string[] = [];
  const info = product.information;
  if (product.demo) issues.push('concept product');
  if (!product.title.trim() || !product.description.trim()) issues.push('title and description');
  if (!info.priceApproved || !Number.isSafeInteger(product.price.amount) || product.price.amount <= 0) issues.push('approved price');
  if (info.photographyStatus !== 'approved' || !product.images.length || product.images.some(im => !im.src || !im.alt)) issues.push('approved product imagery');
  if (!product.variants.length || product.variants.some(v => !v.id || !v.size || !v.color || typeof v.available !== 'boolean' || !Number.isSafeInteger(v.price.amount) || v.price.amount <= 0 || v.price.currency !== product.price.currency)) issues.push('variants and availability');
  if (info.productionStatus !== 'approved') issues.push('production approval');
  if (!info.sku && !product.id.startsWith('gid://shopify/Product/')) issues.push('SKU or provider ID');
  const required: (keyof ProductInformation)[] = product.digital
    ? ['digitalContents', 'fileFormats', 'deliveryMethod', 'licenseInformation', 'refundLimitations']
    : ['materials', 'careInstructions', 'processingTime', 'shippingMessage', 'returnMessage'];
  if (!product.digital && product.sizes.some(size => size !== 'One size')) required.push('sizeGuide', 'measurements');
  if (product.productType === 'Bundles') required.push('includedItems');
  for (const field of required) if (typeof info[field] !== 'string' || !(info[field] as string).trim()) issues.push(field);
  return issues;
}
export function launchReadiness(products: Product[], settings = config, owner: LaunchOwner = launchOwner) {
  const issues: string[] = [];
  if (settings.commerceMode !== 'shopify') issues.push('Shopify mode is not configured');
  if (!settings.launchApproved) issues.push('Owner launch approval is absent');
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(settings.shopify.domain) ||
      !/^[a-f0-9]{32}$/i.test(settings.shopify.token) ||
      !/^\d{4}-(01|04|07|10)$/.test(settings.shopify.version)) issues.push('Valid public Shopify configuration');
  const required: (keyof LaunchOwner)[] = ['sellingIdentity', 'businessContact', 'supportEmail', 'accessibilityEmail',
    'privacyPolicy', 'privacyController', 'privacyProcessors', 'retentionPeriod', 'jurisdiction', 'consumerRights', 'terms', 'accessibilityStatement'];
  if (products.some(p => !p.digital)) required.push('processingTime', 'deliveryEstimates', 'shippingPolicy', 'returnPolicy', 'returnWindow', 'refundProcess', 'returnAddress');
  for (const field of required) if (typeof owner[field] !== 'string' || !(owner[field] as string).trim()) issues.push('Owner: ' + field);
  if (products.some(p => !p.digital) && !owner.shippingRegions.length) issues.push('Owner: shipping regions');
  for (const field of ['supportEmail', 'accessibilityEmail'] as const) if (owner[field] && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(owner[field])) issues.push('Owner: valid ' + field);
  if (!owner.policiesApproved) issues.push('Owner-approved policies');
  if (!owner.checkoutTested) issues.push('Verified Shopify checkout test');
  if (!products.length) issues.push('Catalog is empty');
  for (const product of products) for (const issue of productReadiness(product)) issues.push(product.handle + ': ' + issue);
  return { ready: issues.length === 0, issues };
}
export function conversionMode(products: Product[], settings = config, owner: LaunchOwner = launchOwner): ConversionMode {
  return launchReadiness(products, settings, owner).ready ? 'commerce' : 'interest';
}
export const labelsFor = (mode: ConversionMode) => mode === 'commerce' ? {
  status: 'Shop the collection', price: 'Price', save: 'Add to Loadout', title: 'Your Loadout',
  action: 'Proceed to Checkout', subtotal: 'Subtotal', added: 'Added to your loadout.',
} : {
  status: 'Concept Preview', price: 'Preview Price', save: 'Save to Launch Loadout', title: 'Your Launch Loadout',
  action: 'Get Launch Alert', subtotal: 'Preview subtotal', added: 'Saved to your Launch Loadout.',
};

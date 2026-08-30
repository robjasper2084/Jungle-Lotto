import type { ProductInformation } from '../commerce/types.ts';

/** Owner-maintained public facts. Null means pending, never an inferred product claim. */
export const pendingInformation = (): ProductInformation => ({
  materials: null, fabricWeight: null, construction: null, finish: null, measurements: null,
  sizeGuide: null, modelMeasurements: null, careInstructions: null, countryOfManufacture: null,
  sku: null, inventory: null, processingTime: null, shippingMessage: null, returnMessage: null,
  includedItems: null, digitalContents: null, fileFormats: null, deliveryMethod: null,
  licenseInformation: null, refundLimitations: null, productionStatus: 'concept',
  photographyStatus: 'reference', priceApproved: false,
});

// Populate by product handle only after the owner verifies each fact and image.
export const approvedProductInformation: Record<string, Partial<ProductInformation>> = {
  'night-protocol-hoodie': {
    includedItems: 'Hoodie only. The LottoMind charm shown in some supplied reference imagery is not included with the hoodie.',
  },
};
export function productInformation(handle: string): ProductInformation {
  return { ...pendingInformation(), ...approvedProductInformation[handle] };
}
export const launchOwner = {
  sellingIdentity: null as string | null,
  businessContact: null as string | null,
  supportEmail: null as string | null,
  accessibilityEmail: null as string | null,
  shippingRegions: [] as string[],
  processingTime: null as string | null,
  deliveryEstimates: null as string | null,
  shippingPolicy: null as string | null,
  returnPolicy: null as string | null,
  returnWindow: null as string | null,
  refundProcess: null as string | null,
  returnAddress: null as string | null,
  privacyPolicy: null as string | null,
  privacyController: null as string | null,
  privacyProcessors: null as string | null,
  retentionPeriod: null as string | null,
  jurisdiction: null as string | null,
  consumerRights: null as string | null,
  terms: null as string | null,
  accessibilityStatement: null as string | null,
  policiesApproved: false,
  checkoutTested: false,
  subscriptionApproved: false,
  indexingApproved: false,
};
export type LaunchOwner = typeof launchOwner;

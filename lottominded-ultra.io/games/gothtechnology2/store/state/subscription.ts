export type LaunchInterest = { handle: string; variantId: string; size: string; color: string; quantity: number };
export type SubscriptionRequest = {
  email: string; consent: boolean; source: string; interests: LaunchInterest[];
  collection?: string; character?: string;
};
export type SubscriptionResult = { ok: boolean; message: string };
export const disconnectedMessage = 'Launch alerts are not connected yet. Your email was not saved or sent.';
export const subscriptionVersion = 'gothtechnology-launch-v2';

export function secureEndpoint(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.hash ? url.href : null;
  } catch { return null; }
}
export function createSubscription(endpoint: string, ownerApproved = false, fetcher: typeof fetch = fetch) {
  return {
    async subscribe(input: SubscriptionRequest): Promise<SubscriptionResult> {
      if (!input.consent) return { ok: false, message: 'Please agree to receive launch emails before submitting.' };
      const email = input.email.trim();
      if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, message: 'Enter a valid email address.' };
      if (!endpoint || !ownerApproved) return { ok: false, message: disconnectedMessage };
      const url = secureEndpoint(endpoint);
      if (!url) return { ok: false, message: 'Launch alerts are not configured securely. Your email was not sent.' };
      if (!/^\/[a-zA-Z0-9_./-]{0,240}$/.test(input.source)) return { ok: false, message: 'This page could not be verified. Reload and try again.' };
      if (input.interests.length > 100 || input.interests.some(item =>
        !/^[a-z0-9][a-z0-9-]{0,100}$/.test(item.handle) ||
        !/^[a-zA-Z0-9:/_-]{1,200}$/.test(item.variantId) ||
        !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 99 ||
        !item.size || item.size.length > 80 || !item.color || item.color.length > 80)) {
        return { ok: false, message: 'Some saved options are invalid. Review your Launch Loadout.' };
      }
      const context = (value?: string) => value && /^[a-zA-Z0-9_-]{1,100}$/.test(value) ? value : undefined;
      const payload = {
        email, consent: true, version: subscriptionVersion, source: input.source,
        productHandles: [...new Set(input.interests.map(item => item.handle))],
        interests: input.interests.map(({handle, variantId, size, color, quantity}) => ({handle, variantId, size, color, quantity})),
        collection: context(input.collection), character: context(input.character),
      };
      try {
        const response = await fetcher(url, {
          method: 'POST', credentials: 'omit', redirect: 'error',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload), signal: AbortSignal.timeout(12000),
        });
        if (!response.ok) throw new Error('unconfirmed');
        const result: unknown = await response.json();
        if (!result || typeof result !== 'object' || !('status' in result) ||
          !['accepted', 'pending_confirmation'].includes(String(result.status))) throw new Error('unconfirmed');
        return { ok: true, message: 'Launch alert request received. Check your inbox for confirmation from the mailing service.' };
      } catch {
        return { ok: false, message: 'We could not confirm your launch alert request. Please try again later.' };
      }
    },
  };
}

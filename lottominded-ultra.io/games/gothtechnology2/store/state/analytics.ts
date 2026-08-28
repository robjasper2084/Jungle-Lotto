const events = new Set(['page_view', 'view_collection', 'view_item', 'select_variant', 'add_to_cart', 'remove_from_cart', 'view_cart', 'begin_checkout', 'search', 'play_game', 'character_selected', 'match_completed', 'digital_reward_unlocked', 'newsletter_signup', 'watch_transmission']);
const allowedProperties = new Set(['handle', 'collection', 'variant', 'quantity', 'mode', 'character', 'result', 'duration', 'count']);
type Properties = Record<string, string | number | boolean>;
export function createAnalytics(send: (name: string, props: Properties) => void = () => {}, consent = false) {
  return { setConsent(value: boolean) { consent = value === true; },
    trackEvent(name: string, properties: Properties = {}) {
      if (!consent || !events.has(name)) return;
      const clean = Object.fromEntries(Object.entries(properties).filter(([key, value]) => allowedProperties.has(key)
        && (typeof value === 'number' ? Number.isFinite(value) : typeof value === 'boolean' || /^[a-zA-Z0-9_\- /]{1,100}$/.test(value))));
      try { send(name, clean); } catch { /* Analytics must never interrupt shopping. */ }
    } };
}
export const analytics = createAnalytics();

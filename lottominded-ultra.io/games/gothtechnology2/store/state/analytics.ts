export const eventNames = ['view_home', 'view_collection', 'view_item', 'search', 'apply_filter', 'select_item', 'choose_options',
  'save_to_loadout', 'remove_from_loadout', 'launch_alert_open', 'launch_alert_submit', 'launch_alert_error',
  'watch_campaign', 'launch_game', 'game_match_complete', 'product_to_game', 'game_to_collection',
  'page_view', 'select_variant', 'add_to_cart', 'remove_from_cart', 'view_cart', 'begin_checkout',
  'play_game', 'character_selected', 'match_completed', 'digital_reward_unlocked', 'newsletter_signup', 'watch_transmission'] as const;
export type AnalyticsEvent = typeof eventNames[number];
const events = new Set<string>(eventNames);
const allowedProperties = new Set(['handle', 'collection', 'variant', 'quantity', 'mode', 'character', 'result', 'duration', 'count', 'filter']);
type Properties = Record<string, string | number | boolean>;
export function createAnalytics(send: (name: AnalyticsEvent, props: Properties) => void = () => {}, consent = false) {
  return { setConsent(value: boolean) { consent = value === true; },
    trackEvent(name: AnalyticsEvent, properties: Properties = {}) {
      if (!consent || !events.has(name)) return;
      const clean = Object.fromEntries(Object.entries(properties).filter(([key, value]) => allowedProperties.has(key)
        && (typeof value === 'number' ? Number.isFinite(value) : typeof value === 'boolean' || /^[a-zA-Z0-9_\- /]{1,100}$/.test(value))));
      try { send(name, clean); } catch { /* Analytics must never interrupt shopping. */ }
    } };
}
export const analytics = createAnalytics();

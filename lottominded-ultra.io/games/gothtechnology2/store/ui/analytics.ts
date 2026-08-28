import { analytics } from '../state/analytics';
export function initAnalytics() {
  const detail = document.querySelector<HTMLElement>('[data-product-detail]');
  const collection = document.querySelector<HTMLElement>('[data-collection-page]');
  if (detail) analytics.trackEvent('view_item', { handle: detail.dataset.productDetail! });
  else if (collection) analytics.trackEvent('view_collection', { collection: collection.dataset.collectionPage! });
  else if (document.querySelector('#arrival')) analytics.trackEvent('view_home');
  document.addEventListener('click', event => {
    const link = (event.target as Element).closest<HTMLAnchorElement>('a[href]');
    if (!link) return;
    const url = new URL(link.href);
    if (url.origin !== location.origin) return;
    const product = url.pathname.match(/\/products\/([a-z0-9-]+)\//);
    if (product) analytics.trackEvent('select_item', { handle: product[1] });
    if (detail && /\/play\/$/.test(url.pathname)) analytics.trackEvent('product_to_game', { handle: detail.dataset.productDetail! });
    if (link.id === 'game-collection-link') analytics.trackEvent('game_to_collection', { collection: url.pathname.split('/').filter(Boolean).pop()! });
  });
  document.addEventListener('store:game-launch', () => analytics.trackEvent('launch_game'));
}

import type { Product } from '../commerce/types';
import { initDialogs } from './dom';
import { initCart } from './cart';
import { initCatalog } from './catalog';
import { initExperience } from './experience';
import { initInlineFilms } from './inline-film';
import { initSubscriptions } from './subscriptions';
import { initAnalytics } from './analytics';
import { initGamePricePreviews } from './game-price';
import { initTransmissions } from './transmissions';
const isHome = Boolean(document.querySelector('.cathedral-hero'));
if (isHome && location.hash === '#current-drop') {
  history.replaceState(null, '', location.pathname + location.search);
  scrollTo({ top: 0, left: 0, behavior: 'instant' });
  requestAnimationFrame(() => scrollTo({ top: 0, left: 0, behavior: 'instant' }));
}
const data=JSON.parse(document.getElementById('store-data')?.textContent??'{"products":[]}') as {products:Product[]};
initDialogs();initSubscriptions(data.products);initAnalytics();initCart(data.products);initCatalog(data.products);initExperience();initInlineFilms();
initGamePricePreviews();
initTransmissions(data.products);
if(isHome) import('./story').then(m=>m.initStory());
if(document.querySelector('.signal-card')) import('./cinematic').then(m=>m.initCinematic());
if(document.querySelector('[data-game-host]')) import('../game/play').then(m=>m.initPlay());
if(document.querySelector('[data-load-viewer]')) import('../three/viewer-entry').then(m=>m.initViewers(data.products));

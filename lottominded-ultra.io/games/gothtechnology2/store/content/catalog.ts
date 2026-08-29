import type { Collection, Product } from '../commerce/types.ts';
import { fromDecimal } from '../commerce/money.ts';
import { productInformation } from './launch.ts';

export const collections: Collection[] = [
  ['night-protocol', 'Knight Protocol', 'The first transmission. Apparel for the hours you make your own.'],
  ['detroit-2084', 'Detroit 2084', 'A love letter to the city, stitched into a new world.'],
  ['static-saints', 'Static Saints', 'Small symbols. A signal that stays with you.'],
  ['cyber-cathedral', 'Cyber Cathedral', 'Architecture, shadow, and objects for your personal sanctuary.'],
  ['black-signal', 'Black Signal', 'Quiet essentials with a distinct frequency.'],
  ['founder-transmission', 'Founder Transmission', 'An introduction to the world of GOTHTECHNOLOGY.'],
  ['combat-systems', 'Combat Systems', 'From the character vault to your everyday equipment.'],
].map(([handle, title, description]) => ({ handle, title, description }));

export const characters = [
  { id: 'MASTER_EZRA', name: 'Master Ezra', collection: 'night-protocol', image: 'master-ezra-headshot.webp', signal: 'Discipline / Light' },
  { id: 'KALYX', name: 'Kalyx', collection: 'black-signal', image: 'kalyx-headshot.webp', signal: 'Shadow / Precision' },
  { id: 'DETROIT_LENS_NOIR', name: 'Detroit Lens Noir', collection: 'detroit-2084', image: 'detroit-lens-noir-headshot.webp', signal: 'Guardian / Detroit' },
  { id: 'AMARA_VALENTINE', name: 'Amara Valentine', collection: 'static-saints', image: 'amara-valentine-headshot.webp', signal: 'Heart / Devotion' },
];
export const categories = ['Apparel', 'Accessories', 'Collectibles', 'Digital', 'Bundles'];
const reference = (name: string, alt: string, label = 'Reference') => ({ src: `media/${name}.webp`, alt, label, width: 1376, height: 768 });
const seeds = [
  { handle: 'night-protocol-hoodie', title: 'Knight Protocol Embroidered Hoodie', subtitle: '313 / Detroit embroidery reference', dollars: 79, type: 'Apparel', collection: 'night-protocol', character: 'MASTER_EZRA', images: [reference('hoodie', 'Black 313 hoodie with multicolor Detroit embroidery and attached LottoMind charm', 'Front reference'), reference('embroidery', 'Close view of the multicolor Detroit skyline and heart embroidery', 'Embroidery reference'), reference('apparel', 'Detroit sweatshirt and hoodie with a LottoMind charm on a brown bag', 'Styling reference')], sizes: ['S', 'M', 'L', 'XL', '2XL'] },
  { handle: 'detroit-2084-shirt', title: 'Detroit 2084 Graphic T-Shirt', subtitle: 'Detroit skyline-heart graphic / supplied product reference', dollars: 36, type: 'Apparel', collection: 'detroit-2084', character: 'DETROIT_LENS_NOIR', images: [{ ...reference('detroit-2084-tee-reference', 'Black Detroit 2084 graphic T-shirt with skyline lettering and a heart emblem on a gray pedestal', 'Front reference'), width: 768, height: 768 }], sizes: ['S', 'M', 'L', 'XL', '2XL'] },
  { handle: 'black-signal-beanie', title: 'Detroit Skyline Embroidered Beanie', subtitle: 'Black / Detroit skyline embroidery reference', dollars: 32, type: 'Apparel', collection: 'detroit-2084', character: 'DETROIT_LENS_NOIR', images: [{ ...reference('detroit-skyline-beanie-reference', 'Black cuffed Detroit skyline beanie with multicolor city lettering on a dark pedestal', 'Front reference'), width: 768, height: 768 }], colors: ['Black'] },
  { handle: 'gothtechnology-luggage-charm', title: 'GOTHTECHNOLOGY Luggage Charm', subtitle: 'LottoMind character / gold hardware reference', dollars: 19.99, type: 'Accessories', collection: 'detroit-2084', character: 'DETROIT_LENS_NOIR', images: [reference('charm', 'Purple LottoMind mascot key charm with gold clasp and black circuit-pattern strap', 'Product reference'), reference('charm-bags', 'LottoMind charm and gold clasp attached to a brown backpack', 'Scale reference'), reference('sling-bag', 'LottoMind charm attached to a black Detroit sling bag', 'Placement reference')] },
  { handle: 'static-saints-patch-set', title: 'Static Saints Embroidered Patch Set', subtitle: 'Wear your signal / proposed patch set', dollars: 18, type: 'Accessories', collection: 'static-saints', character: 'AMARA_VALENTINE', images: [reference('patch', 'Round Detroit embroidered patch with a gold edge, skyline, red heart, and sunrise; set contents are unconfirmed', 'Patch reference')] },
  { handle: 'cyber-cathedral-art-print', title: 'I Love Detroit Ashtray', subtitle: 'Detroit mascot / leaf-shaped ashtray concept', dollars: 28, type: 'Collectibles', collection: 'cyber-cathedral', character: 'MASTER_EZRA', images: [{ ...reference('mascot-leaf-collectible', 'LottoMind mascot wearing a Detroit cap and hoodie, holding a sculpted gray leaf-shaped ashtray against a dark background', 'Product reference'), width: 1200, height: 1604 }] },
  { handle: 'mobster-luggage-charm', title: 'Mobster Luggage Charm', subtitle: 'Gold hardware / Mobster character reference', dollars: 19.99, type: 'Accessories', collection: 'cyber-cathedral', character: 'KALYX', images: [{ ...reference('mobster-luggage-charm-reference', 'Mobster-themed LottoMind luggage charm in a pinstripe suit, fedora and sunglasses with gold hardware and a black circuit strap', 'Product reference'), width: 768, height: 768 }] },
  { handle: 'black-signal-digital-pack', title: 'Black Signal Digital Transmission Pack', subtitle: 'Digital artifacts / proposed download pack', dollars: 12, type: 'Digital', collection: 'black-signal', character: 'KALYX', images: [] },
  { handle: 'founder-loadout-bundle', title: 'Founder Loadout Bundle', subtitle: 'Your first transmission / contents awaiting confirmation', dollars: 129, type: 'Bundles', collection: 'founder-transmission', character: 'MASTER_EZRA', images: [reference('apparel', 'Detroit apparel and charm styling reference; proposed bundle contents are unconfirmed', 'Styling reference')] },
  { handle: 'detroit-skyline-cap', title: 'Detroit Skyline Embroidered Cap', subtitle: 'Black / Detroit skyline embroidery reference', dollars: 32, type: 'Apparel', collection: 'detroit-2084', character: 'DETROIT_LENS_NOIR', images: [{ ...reference('detroit-skyline-cap-reference', 'Black Detroit skyline embroidered baseball cap on a dark marble pedestal', 'Front reference'), width: 768, height: 768 }], colors: ['Black'] },
];

export const demoProducts: Product[] = seeds.map((seed, index) => {
  const sizes = seed.sizes ?? ['One size'];
  const colors = seed.colors ?? ['Obsidian'];
  const price = fromDecimal(String(seed.dollars), 'USD');
  return { id: `demo-${seed.handle}`, handle: seed.handle, title: seed.title, subtitle: seed.subtitle,
    description: `${seed.subtitle}. Part of the ${collections.find(c => c.handle === seed.collection)?.title} collection. A concept from the GOTHTECHNOLOGY fighting-game world.`,
    price, compareAtPrice: null, productType: seed.type, collection: seed.collection, collections: [seed.collection, 'combat-systems'], tags: [seed.type, seed.collection],
    images: seed.images.map(image => ({...image, kind: /scale|placement/i.test(image.label) ? 'SCALE REFERENCE' as const : /embroidery/i.test(image.label) ? 'DETAIL REFERENCE' as const : 'SUPPLIED PRODUCT REFERENCE' as const})), model: null, video: null, colors, sizes,
    information: productInformation(seed.handle),
    variants: colors.flatMap(color => sizes.map(size => ({ id: `demo-${seed.handle}-${color.toLowerCase()}-${size.toLowerCase().replaceAll(' ', '-')}`, title: `${size} / ${color}`, size, color, available: true, price }))),
    inventory: null, materials: null, fabricWeight: null, finish: null, careInstructions: null, shippingMessage: null, returnMessage: null,
    featured: index < 6, digital: seed.type === 'Digital', preorder: false, demo: true, characterAssociation: seed.character,
    seo: { title: seed.title, description: `${seed.title} — a GOTHTECHNOLOGY demo catalog concept.` },
  };
});

export function selectVariant(product: Product, size: string, color: string) {
  return product.variants.find(v => v.size === size && v.color === color) ?? null;
}
export function filterProducts(products: Product[], filters: { search?: string; category?: string; collection?: string; size?: string; color?: string; availability?: string; sort?: string } = {}) {
  const term = (filters.search ?? '').trim().toLocaleLowerCase();
  const items = products.filter(p => (!term || `${p.title} ${p.description} ${p.tags.join(' ')}`.toLowerCase().includes(term))
    && (!filters.category || p.productType === filters.category)
    && (!filters.collection || p.collections.includes(filters.collection))
    && p.variants.some(v => (!filters.size || v.size === filters.size) && (!filters.color || v.color === filters.color)
      && (!filters.availability || (filters.availability === 'available' ? v.available : !v.available))));
  return items.sort((a, b) => filters.sort === 'price-low' ? a.price.amount - b.price.amount
    : filters.sort === 'price-high' ? b.price.amount - a.price.amount
    : filters.sort === 'name' ? a.title.localeCompare(b.title)
    : filters.sort === 'newest' ? products.indexOf(b) - products.indexOf(a)
    : Number(b.featured) - Number(a.featured));
}

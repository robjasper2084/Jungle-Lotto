import type { Collection, Product } from '../commerce/types.ts';

export const collections: Collection[] = [
  ['night-protocol', 'Night Protocol', 'The first transmission. Apparel for the hours you make your own.'],
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
  { handle: 'night-protocol-hoodie', title: 'Night Protocol Heavyweight Embroidered Hoodie', subtitle: '313 / Detroit embroidery reference', dollars: 79, type: 'Apparel', collection: 'night-protocol', character: 'MASTER_EZRA', images: [reference('hoodie', 'Black 313 hoodie with multicolor Detroit embroidery and attached LottoMind charm', 'Front reference'), reference('embroidery', 'Close view of the multicolor Detroit skyline and heart embroidery', 'Embroidery reference'), reference('apparel', 'Detroit sweatshirt and hoodie with a LottoMind charm on a brown bag', 'Styling reference')], sizes: ['S', 'M', 'L', 'XL', '2XL'] },
  { handle: 'detroit-2084-shirt', title: 'Detroit 2084 Heavyweight Graphic T-Shirt', subtitle: 'City signals / proposed apparel', dollars: 36, type: 'Apparel', collection: 'detroit-2084', character: 'DETROIT_LENS_NOIR', images: [], sizes: ['S', 'M', 'L', 'XL', '2XL'] },
  { handle: 'black-signal-beanie', title: 'Black Signal Embroidered Beanie', subtitle: 'After-hours / proposed headwear', dollars: 32, type: 'Apparel', collection: 'black-signal', character: 'KALYX', images: [] },
  { handle: 'gothtechnology-luggage-charm', title: 'GOTHTECHNOLOGY Luggage Charm', subtitle: 'LottoMind character / gold hardware reference', dollars: 16, type: 'Accessories', collection: 'detroit-2084', character: 'DETROIT_LENS_NOIR', images: [reference('charm', 'Purple LottoMind mascot key charm with gold clasp and black circuit-pattern strap', 'Product reference'), reference('charm-bags', 'LottoMind charm and gold clasp attached to a brown backpack', 'Scale reference'), reference('sling-bag', 'LottoMind charm attached to a black Detroit sling bag', 'Placement reference')] },
  { handle: 'static-saints-patch-set', title: 'Static Saints Embroidered Patch Set', subtitle: 'Wear your signal / proposed patch set', dollars: 18, type: 'Accessories', collection: 'static-saints', character: 'AMARA_VALENTINE', images: [reference('patch', 'Round Detroit embroidered patch with a gold edge, skyline, red heart, and sunrise; set contents are unconfirmed', 'Patch reference')] },
  { handle: 'cyber-cathedral-art-print', title: 'Cyber Cathedral Art Print', subtitle: 'Architecture after midnight / proposed print', dollars: 28, type: 'Collectibles', collection: 'cyber-cathedral', character: 'MASTER_EZRA', images: [] },
  { handle: 'combat-grid-desk-mat', title: 'Combat Grid Extended Gaming Desk Mat', subtitle: 'A place for your next move / proposed desk mat', dollars: 42, type: 'Accessories', collection: 'combat-systems', character: 'KALYX', images: [] },
  { handle: 'black-signal-digital-pack', title: 'Black Signal Digital Transmission Pack', subtitle: 'Digital artifacts / proposed download pack', dollars: 12, type: 'Digital', collection: 'black-signal', character: 'KALYX', images: [] },
  { handle: 'founder-loadout-bundle', title: 'Founder Loadout Bundle', subtitle: 'Your first transmission / contents awaiting confirmation', dollars: 129, type: 'Bundles', collection: 'founder-transmission', character: 'MASTER_EZRA', images: [reference('apparel', 'Detroit apparel and charm styling reference; proposed bundle contents are unconfirmed', 'Styling reference')] },
];

export const demoProducts: Product[] = seeds.map((seed, index) => {
  const sizes = seed.sizes ?? ['One size'];
  const colors = ['Obsidian'];
  const price = { amount: seed.dollars * 100, currency: 'USD' };
  return { id: `demo-${seed.handle}`, handle: seed.handle, title: seed.title, subtitle: seed.subtitle,
    description: `${seed.subtitle}. Part of the ${collections.find(c => c.handle === seed.collection)?.title} collection. This is a demo catalog concept, not an offer of available stock. Product specifications and final imagery require owner confirmation.`,
    price, compareAtPrice: null, productType: seed.type, collection: seed.collection, collections: [seed.collection, 'combat-systems'], tags: [seed.type, seed.collection],
    images: seed.images, model: null, video: null, colors, sizes,
    variants: colors.flatMap(color => sizes.map(size => ({ id: `demo-${seed.handle}-${color.toLowerCase()}-${size.toLowerCase().replaceAll(' ', '-')}`, title: `${size} / ${color}`, size, color, available: true, price }))),
    inventory: null, materials: 'Material composition requires owner confirmation.', fabricWeight: 'Fabric weight is not yet confirmed.', finish: seed.handle.includes('hoodie') ? 'Embroidery appearance follows the supplied reference; final construction is unconfirmed.' : 'Final production details require owner confirmation.',
    careInstructions: 'Follow the final garment label. Care instructions will be confirmed before sales open.',
    shippingMessage: 'Demo catalog. No items ship and no payment is collected.', returnMessage: 'The owner must approve a return policy before checkout is enabled.',
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

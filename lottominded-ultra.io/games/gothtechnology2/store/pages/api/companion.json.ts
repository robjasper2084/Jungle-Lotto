import type { APIRoute } from 'astro';
import { buildProvider } from '../../commerce/provider';
import { href, media } from '../../utilities/paths';
import { creativeBriefs, companionCopy, publicDropUrl } from '../../content/companion';
import { REWARD_GAMES } from '../../public/arcade/games.js';
import { productArtwork, artworkFraming } from '../../content/product-artwork';

// A build-time view of the same catalog used by the storefront, never a second price list.
export const GET: APIRoute = async () => {
  const [products, collections] = await Promise.all([
    buildProvider.getProducts(), buildProvider.getCollections(),
  ]);
  const collectionTitles = new Map(collections.map(collection => [collection.handle, collection.title]));
  return new Response(JSON.stringify({
    version: 1, brand: 'GOTHTECHNOLOGY', copy: companionCopy,
    drop: { title: 'Knight Protocol', url: href('#current-drop'), publicUrl: publicDropUrl,
      collectionUrl: href('collections/night-protocol/'), qr: href('media/knight-protocol-qr.svg') },
    shopUrl: href('shop/'), rewardsUrl: href('#underground-rewards'),
    soundtrack: { title: 'LottoMind Vault 174', description: 'The sound of the Armory. From the existing LottoMind audio library.', src: href('media/lottomind-vault-174hz-background.mp3') },
    games: REWARD_GAMES.map(game => ({ id: game.id, title: game.title, rule: game.rule,
      url: href(`?arcade=${encodeURIComponent(game.id)}#underground-rewards`) })),
    briefs: creativeBriefs.map(brief => ({ ...brief, image: media(brief.image) })),
    products: products.map(product => {
      const profile = product.demo ? productArtwork[product.handle] : undefined;
      const image = profile?.image || product.cardImage || product.images[0];
      return { handle: product.handle, title: product.title, category: product.productType,
        collection: product.collection, collectionTitle: collectionTitles.get(product.collection) || 'GOTHTECHNOLOGY',
        price: product.price, description: product.subtitle,
        colors: product.colors, featured: product.featured, preview: product.demo,
        url: href(`products/${product.handle}/`),
        image: image ? { src: media(image.src), alt: image.alt, framing: artworkFraming(profile, image) } : null };
    }),
  }), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
};

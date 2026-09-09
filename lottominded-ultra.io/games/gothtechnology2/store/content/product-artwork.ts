import type { ProductImage } from '../commerce/types';

type ArtworkProfile = {
  // Product bounds within the source image, as fractions of its width/height.
  // Used for display framing only; gallery references remain untouched.
  bounds: [number, number, number, number];
  image?: ProductImage;
};

const campaign = (name: string, alt: string): ProductImage => ({
  src: `media/${name}.webp`, alt, width: 1254, height: 1254,
  label: 'Armory catalog campaign concept', kind: 'CAMPAIGN CONCEPT',
});

export const productArtwork: Record<string, ArtworkProfile> = {
  'night-protocol-hoodie': {
    bounds: [.13, .06, .73, .82],
    image: campaign('night-protocol-hoodie-armory-card-v1', 'Black 313 Knight Protocol hoodie with Detroit embroidery, displayed without accessories on a black stone plinth in a gold-lit Gothic armory; campaign concept'),
  },
  'boogeyman-graphic-hoodie': { bounds: [.25, .08, .51, .79] },
  'detroit-2084-shirt': { bounds: [.07, .10, .86, .77] },
  'armory-fragrance-roller-collection': { bounds: [.045, .02, .915, .82] },
  'black-signal-beanie': { bounds: [.22, .12, .57, .57] },
  'detroit-skull-cap-alt': { bounds: [.16, .13, .70, .57] },
  'gothtechnology-luggage-charm': { bounds: [.265, .035, .325, .84] },
  'static-saints-patch-set': { bounds: [.10, .30, .82, .43] },
  'static-saints-detroit-rug': {
    bounds: [.02, .41, .955, .30],
    image: campaign('static-saints-detroit-rug-armory-card-v1', 'Blue Detroit skyline cutout rug on a dark stone floor in a softly gold-lit Gothic armory; campaign concept based on the supplied rug reference'),
  },
  'cyber-cathedral-art-print': { bounds: [.30, .055, .40, .81] },
  'mobster-luggage-charm': { bounds: [.21, .05, .59, .77] },
  'key-knife-keychain': { bounds: [.212, .390, .510, .198] },
  'black-signal-digital-pack': { bounds: [.155, .08, .70, .86] },
  'mobster-charm-key-knife-bundle': { bounds: [.115, .06, .76, .76] },
  'key-knife-gun-attachment-bundle': { bounds: [.22, .075, .68, .855] },
  'founder-loadout-bundle': {
    bounds: [.03, .145, .95, .645],
    image: campaign('founder-loadout-armory-card-v1', 'Detroit sweatshirt, hoodie and brown 313 backpack with LottoMind charm in a gold-lit Gothic armory; styling campaign concept, proposed bundle contents unconfirmed'),
  },
  'detroit-skyline-cap': { bounds: [.24, .20, .54, .50] },
  'detroit-riverfront-sunset-artwork': { bounds: [.30, .21, .40, .48] },
  'detroit-winter-sunset-artwork': { bounds: [.22, .188, .565, .598] },
};

export function artworkFraming(profile: ArtworkProfile | undefined, image: ProductImage) {
  if (!profile) return {};
  const [x, y, width, height] = profile.bounds;
  const ratio = (image.width || 1) / (image.height || 1);
  // The longest side of each product occupies 80% of the square display.
  const displayWidth = 80 / Math.max(width, height / ratio);
  const displayHeight = displayWidth / ratio;
  return {
    '--art-width': `${displayWidth.toFixed(3)}%`,
    '--art-left': `${(50 + (.5 - x - width / 2) * displayWidth).toFixed(3)}%`,
    '--art-top': `${(48 + (.5 - y - height / 2) * displayHeight).toFixed(3)}%`,
  };
}

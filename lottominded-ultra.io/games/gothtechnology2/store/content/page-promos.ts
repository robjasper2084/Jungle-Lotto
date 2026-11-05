export type PagePromo = {
  id: string; delayMs: number; title: string; kicker: string;
  description: string; image: string; alt: string;
  width: number; height: number; url: string; action: string;
};

export const pagePromos: Record<string, PagePromo> = {
  'play/': {
    id: 'swoop-detroit', delayMs: 5_000, title: 'Swoop Detroit',
    kicker: 'DIGITAL STATIC / DETROIT RIDING',
    description: 'Take your electric unicycle into Detroit. Explore the city and find your next ride.',
    image: 'media/swoop-detroit-startup.webp',
    alt: 'Swoop Detroit startup artwork with electric-unicycle riders, LottoMind characters and a dog in the Dequindre Cut',
    width: 1920, height: 1074, url: 'arcade/swoop-detroit/', action: 'Play Swoop Detroit',
  },
  'lookbook/': {
    id: 'static-royale', delayMs: 20_000, title: 'Static Royale',
    kicker: 'DIGITAL STATIC / DETROIT ARENA',
    description: 'Stay on your wheel. Find cover. Beat the Static Field. Open Static Royale when you are ready.',
    image: 'media/static-royale-startup.webp',
    alt: 'Static Royale startup artwork with a helmeted electric-unicycle rider and the illuminated Detroit skyline',
    width: 2688, height: 1520, url: 'arcade/swoop-detroit/royale.html', action: 'Play Static Royale',
  },
  'lottomind/': {
    id: 'lottomind-companion', delayMs: 40_000, title: 'Follow the signal.',
    kicker: 'GOTHTECHNOLOGY × LOTTOMIND',
    description: 'Open the LottoMind companion to explore the connected games and creative world.',
    image: 'media/armory-city.webp',
    alt: 'Dark futuristic Detroit city artwork from the GOTHTECHNOLOGY Armory',
    width: 1680, height: 672,
    url: 'https://robjasper2084.github.io/Jungle-Lotto/lotto%20mind%20refined/?route=companion',
    action: 'Open LottoMind companion',
  },
};

import { href, canonical } from '../utilities/paths';

export const companionCopy = 'The digital companion to GOTHTECHNOLOGY. Create. Play. Carry your signal.';
export function appHref(route = 'companion') {
  const root = href().split('/lottominded-ultra.io/')[0];
  return `${root}/lotto%20mind%20refined/?route=${encodeURIComponent(route)}`;
}
export const publicDropUrl = canonical('#current-drop');
export const creativeBriefs = [
  { id: 'knight-protocol', title: 'Knight Protocol', caption: 'A first transmission from Detroit.',
    image: 'media/night-protocol-hoodie-armory-card-v1.webp',
    prompt: 'GOTHTECHNOLOGY / Knight Protocol. A 15-second campaign concept in four shots: a quiet Detroit street after midnight; a close view of the black 313 hoodie and its gold details; the LottoMind companion charm moving on a bag; a final black-and-gold title card reading Bloom Through Gloom. Use restrained cyan light and cinematic shadows. Create. Play. Carry your signal. Product imagery is a concept, not final merchandise.' },
  { id: 'underground', title: 'RAHBE Underground', caption: 'Follow the signal beneath the city.',
    image: 'media/underground-armory-campaign-v1.webp',
    prompt: 'GOTHTECHNOLOGY / Robot RAHBE Underground. Four campaign scenes: Detroit at midnight, a gold-lit underground entrance, RAHBE following a cyan signal through the vault, and a quiet end card inviting the viewer to play. Black, antique gold, and small cyan accents. No flashing effects. The game is free entertainment; no purchase is required.' },
  { id: 'detroit-2084', title: 'Detroit 2084', caption: 'Turn the skyline into a transmission.',
    image: 'media/armory-city.webp',
    prompt: 'GOTHTECHNOLOGY / Detroit 2084. Four scenes for a creative storyboard: the Detroit skyline at dusk, rain reflecting an amber streetlight, a close-up of the LottoMind character with cyan circuit details, and the words Carry your signal on a black background. Connect music, streetwear, and arcade culture. Keep the lighting cinematic and the motion calm.' },
];

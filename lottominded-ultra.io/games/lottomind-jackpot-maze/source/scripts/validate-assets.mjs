import { access, stat } from 'node:fs/promises';
import { resolve } from 'node:path';

const required = [
  '.generated-public/assets/mascot/mascot-atlas.webp',
  '.generated-public/assets/heroes/player2-dog-atlas.webp',
  '.generated-public/assets/heroes/player2-dog-reference.webp',
  '.generated-public/assets/villains/villains-atlas.webp',
  '.generated-public/assets/villains/envy-crew-strip.webp',
  '.generated-public/assets/villains/jackpot-patrol-strip.webp',
  '.generated-public/assets/environments/world-1-detroit-city.webp',
  '.generated-public/assets/environments/world-2-dream-oracle-temple.webp',
  '.generated-public/assets/environments/world-3-jackpot-vault.webp',
  '.generated-public/assets/ui/icons/number-orb.png',
  '.generated-public/assets/ui/icons/mind-coin.png',
  '.generated-public/assets/ui/icons/clarity-heart.png',
  '.generated-public/assets/ui/icons/vault-key.png',
  '.generated-public/assets/ui/detroit-street-sign-blank.webp',
  '.generated-public/assets/ui/icon-192.png',
  '.generated-public/assets/ui/icon-512.png',
  '.generated-public/assets/bonuses/cash-bonus.webp',
  '.generated-public/assets/bonuses/lottery-ticket-bonus.webp',
  '.generated-public/assets/bonuses/scratch-off-bonus.webp',
  '.generated-public/assets/video/detroit-commercial-01.mp4',
  '.generated-public/assets/video/detroit-commercial-01-poster.webp',
  '.generated-public/assets/video/detroit-commercial-02.mp4',
  '.generated-public/assets/video/detroit-commercial-02-poster.webp'
];

for (const item of required) {
  const path = resolve(item); await access(path); const info = await stat(path);
  if (info.size < 1024) throw new Error(`${item} is unexpectedly small`);
}
console.log(`Validated ${required.length} production assets.`);

/** Source-authored storefront references, animated by Higgsfield Seedance 2.5. */
export const ENTRANCE_FILMS={
 gallery:{title:'Serengeti Galleries',url:'./art/entrances/serengeti.mp4',poster:'./art/entrances/serengeti.webp',seconds:8},
 lotto:{title:'LottoMind App Store',url:'./art/entrances/lottomind.mp4',poster:'./art/entrances/lottomind.webp',seconds:8},
 penny:{title:'Penny Auction',url:'./art/entrances/penny-auction.mp4',poster:'./art/entrances/penny-auction.webp',seconds:8},
} as const;
export type StoreEntrance=keyof typeof ENTRANCE_FILMS;

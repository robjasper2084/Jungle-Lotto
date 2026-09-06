/** Creative scent directions only: not formulas, ingredients, or sellable bundles. */
export type ScentDirection = {
  id: string;
  name: string;
  family: string;
  notes: string;
  mood: string;
  story: string;
  kind: 'Character' | 'Artwork' | 'World';
  composition: { opening: string; heart: string; trail: string };
  inspiration?: { detail: string; impression: string }[];
};

export const scentConceptNotice = 'Creative scent studies only. Notes describe imagined impressions, not confirmed ingredients, formulas or available variants. The opening, heart and trail are a proposed composition, not tested wear or longevity. Final formulas, safety information, sizes and availability require approval.';

export const scentDirections: ScentDirection[] = [
  {
    id: 'the-analog', name: 'The Analog', kind: 'Character',
    family: 'Citrus / mineral / dry woods', mood: 'Bright. Precise. Electric.',
    notes: 'Bergamot / mineral air / dry cedar',
    story: 'Cyan circuitry and cold glass become a bright citrus edge over cool mineral air. Dry cedar keeps the idea crisp, with very little sweetness.',
    composition: { opening: 'Bergamot peel: a sharp flash of light.', heart: 'Mineral air: cool and transparent, like glass lit in cyan.', trail: 'Dry cedar: a clean, spare wooden structure.' },
  },
  {
    id: 'the-champ', name: 'The Champ', kind: 'Character',
    family: 'Fresh spice / green woods', mood: 'Spirited. Steady. Golden.',
    notes: 'Fresh ginger / bergamot / vetiver',
    story: 'The gold guardian gets the liveliest opening: fresh ginger and citrus, grounded by the root-like green dryness of vetiver. Brushed gold, translated into scent.',
    composition: { opening: 'Fresh ginger and bergamot: bright, zesty movement.', heart: 'A green ginger impression: fresh rather than sweet spice.', trail: 'Dry vetiver: earthy structure beneath the gold.' },
  },
  {
    id: 'the-mobster', name: 'The Mobster', kind: 'Character',
    family: 'Black tea / amber / soft woods', mood: 'Tailored. Warm. Composed.',
    notes: 'Black tea / cedar / amber / dark vanilla',
    story: 'Pinstripes, polished gold hardware and a room after dark. Dry black tea gives the warm amber and restrained vanilla a tailored edge, without turning sugary.',
    composition: { opening: 'Black tea: dry, dark and quietly bitter.', heart: 'Cedar: the structure of a well-cut suit.', trail: 'Amber and dark vanilla: a soft glow, with sweetness kept in the background.' },
  },
  {
    id: 'the-observer', name: 'The Observer', kind: 'Character',
    family: 'Cool aromatic / airy musk', mood: 'Quiet. Clear. Watchful.',
    notes: 'Juniper / sage / clean musk',
    story: 'A cap pulled low and a city watched in silence. Juniper and sage suggest cool night air; an airy musk impression leaves the palette open and understated.',
    composition: { opening: 'Juniper: a cool, green snap.', heart: 'Sage: dry herbs and a still, open space.', trail: 'Clean musk: a soft, airy impression without amber warmth.' },
  },
  {
    id: 'knight-protocol', name: 'Knight Protocol', kind: 'World',
    family: 'Pepper / dry woods / amber', mood: 'Dark fabric. Gold light.',
    notes: 'Black pepper / cedar / amber',
    story: 'The black 313 hoodie under an Armory spotlight. Pepper brings texture, cedar brings structure and amber echoes the gold light. Drier and more angular than The Mobster.',
    composition: { opening: 'Black pepper: a textured, dry spark.', heart: 'Cedar: dark wood against woven black fabric.', trail: 'Amber: a narrow band of warmth, with no vanilla direction.' },
  },
  {
    id: 'detroit-2084', name: 'Detroit 2084', kind: 'Artwork',
    family: 'Bitter citrus / mineral air / amber woods', mood: 'A warm horizon. A cold river.',
    notes: 'Bitter orange / mineral air / cedar / amber',
    story: 'Detroit Winter Sunset becomes a study in temperature: a glowing orange horizon above an icy river, framed by bare branches. The scent interprets the photograph’s color and texture, not literal ingredients in the scene.',
    composition: { opening: 'Bitter orange: the sharp orange edge of the setting sun.', heart: 'Mineral air and dry cedar: frozen water beside bare branches.', trail: 'Amber: the last warm light held against the cold.' },
    inspiration: [
      { detail: 'Orange horizon', impression: 'Bitter orange and amber for the sunset glow.' },
      { detail: 'Icy river', impression: 'Mineral air for the open, cold surface.' },
      { detail: 'Bare branches', impression: 'Dry cedar for the silhouetted wood.' },
    ],
  },
  {
    id: 'static-saints', name: 'Static Saints', kind: 'World',
    family: 'White tea / soft floral / musk', mood: 'Pale light in the dark.',
    notes: 'White tea / jasmine / soft musk',
    story: 'The quietest floral in the collection: white tea and a sheer jasmine impression against soft musk. A pale thread of light through the city’s darker palette.',
    composition: { opening: 'White tea: a delicate, dry brightness.', heart: 'Sheer jasmine: a small bloom, with no incense direction.', trail: 'Soft musk: a muted, fabric-like impression.' },
  },
  {
    id: 'black-signal', name: 'Black Signal', kind: 'World',
    family: 'Smoked woods / dark resin', mood: 'Low light. Dark resin.',
    notes: 'Black pepper / smoked woods / resin',
    story: 'Black hardware and a signal almost lost in shadow. A dry pepper edge leads into smoked wood and dark resin: the most austere direction, with no floral or vanilla accent.',
    composition: { opening: 'Black pepper: sharp and spare.', heart: 'Smoked woods: a charred-wood impression, not a literal smoke ingredient.', trail: 'Dark resin: dense warmth beneath the shadow.' },
  },
  {
    id: 'cyber-cathedral', name: 'Cyber Cathedral', kind: 'World',
    family: 'Incense / jasmine / sandalwood', mood: 'Stone arches. Candlelit bloom.',
    notes: 'Incense / jasmine / sandalwood',
    story: 'Gold light under stone arches, with jasmine emerging through an incense impression. Sandalwood rounds the composition, making it warmer and more ceremonial than Static Saints.',
    composition: { opening: 'Incense: a dry veil beneath the arches.', heart: 'Jasmine: a luminous floral center.', trail: 'Sandalwood: rounded wood and candlelight warmth.' },
  },
];

export const fragranceBundles = [
  { name: 'Winter Afterglow', scentId: 'detroit-2084', product: 'Detroit Winter Sunset Artwork', handle: 'detroit-winter-sunset-artwork', story: 'The artwork supplies the scene; the proposed roller echoes its warm horizon, cold river and bare branches. A visual and scent pairing built around the same winter evening.' },
  { name: 'The Mobster Set', scentId: 'the-mobster', product: 'Mobster Luggage Charm', handle: 'mobster-luggage-charm', story: 'The charm’s pinstripe suit and gold hardware meet black tea, cedar and amber. One character expressed as a collectible and a proposed fragrance.' },
  { name: 'Knight After Midnight', scentId: 'knight-protocol', product: 'Knight Protocol Embroidered Hoodie', handle: 'night-protocol-hoodie', story: 'The black 313 hoodie meets a dry pepper-and-cedar direction, with amber echoing its gold accents. An outfit and scent concept from the same Armory world.' },
  { name: 'The Observer Set', scentId: 'the-observer', product: 'GOTHTECHNOLOGY Luggage Charm', handle: 'gothtechnology-luggage-charm', story: 'The everyday character charm meets cool juniper, dry sage and airy musk. A quieter companion pairing for the Observer persona.' },
];

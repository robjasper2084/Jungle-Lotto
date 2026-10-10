export const DETROIT_SCENES = ['detroit-street','detroit-transit','detroit-station','detroit-tunnels','detroit-vault','detroit-chamber','detroit-boss'];
export const DETROIT_PROPS = ['platform','ladder','wall','elevator','train','cart','coin','chest','gate','spikes','drone','guard','warden','fire'];
export const DETROIT_ART = Object.fromEntries([
  ...DETROIT_SCENES.map(name => [name, `assets/environment/detroit/${name}.webp`]),
  ...DETROIT_PROPS.map(name => [`art-${name}`, `assets/environment/detroit/${name}.png`])
]);

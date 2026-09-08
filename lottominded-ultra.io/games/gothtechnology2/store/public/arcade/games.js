export const REWARD_GAMES = Object.freeze([
  {id:'underground',title:'Underground',path:'arcade/robot-rahbe-underground/',help:'A/D move · Space jump · J fire · E interact · P pause. Saves at access beacons.',rule:'Collect relics, defeat enemies, and explore the vaults.'},
  {id:'static-wars',title:'Robot RAHBE / Shadow Ops',path:'arcade/shadow-ops-canvas/?arcade=1',help:'Use the game’s Controls screen for keyboard, touch, and controller layouts.',rule:'Campaign score from enemies, pickups, and missions.'},
  {id:'vault-rush',title:'Vault Rush',path:'arcade/robot-rahbe-vault-rush/?arcade=1',help:'Space jump · S slide · J shoot · K dash · P pause. Bank & Extract ends your run.',rule:'Build score through distance, collectibles, and combos.'},
  {id:'gothtechnology',title:'GOTHTECHNOLOGY Fighter',path:'legacy-game/',help:'Choose your fighter and mode. Keyboard, touch, and controller controls are available in Settings.',rule:'Finish an active 30-second match: 2,500 points, or 5,000 for a win. Training and replays do not count.'},
].map(game=>Object.freeze(game)));

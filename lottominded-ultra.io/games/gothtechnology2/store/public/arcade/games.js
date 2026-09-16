export const REWARD_GAMES = Object.freeze([
  {id:'underground',title:'Underground',path:'arcade/robot-rahbe-underground/',help:'A/D move · Space jump · J fire · E interact · P pause. Saves at access beacons.',rule:'Collect relics, defeat enemies, and explore the vaults.'},
  {id:'static-wars',title:'Robot RAHBE / Shadow Ops',path:'arcade/shadow-ops-canvas/?arcade=1',help:'Use the game’s Controls screen for keyboard, touch, and controller layouts.',rule:'Campaign score from enemies, pickups, and missions.'},
  {id:'vault-rush',title:'Vault Rush',path:'arcade/robot-rahbe-vault-rush/?arcade=1',help:'Space jump · S slide · J shoot · K dash · P pause. Bank & Extract ends your run.',rule:'Build score through distance, collectibles, and combos.'},
  {id:'gothtechnology',title:'GOTHTECHNOLOGY Fighter',path:'legacy-game/',help:'Choose your fighter and mode. Keyboard, touch, and controller controls are available in Settings.',rule:'Finish an active 30-second match: 2,500 points, or 5,000 for a win. Training and replays do not count.'},
  {id:'static-wave',title:'2084 Static WAV',path:'../opengw-levels/?arcade=1',help:'WASD or arrows move · Mouse, touch, or IJKL fire · Space bombs · P pauses. Select 1–4 pilots before starting.',rule:'Earn points from enemies, pickups, and cleared sectors. New runs add to your total.'},
  {id:'ride-the-cut',title:'Digital Static / Ride the Cut',path:'arcade/ride-the-cut/',help:'A/D or arrows steer · Space brakes · Shift dodges · P pauses · R restarts. Touch controls are available.',rule:'Earn 10 points per meter and 1,000 bonus points for completing the 250 m ride.'},
  {id:'swoop-detroit',title:'Swoop Detroit',path:'arcade/swoop-detroit/',help:'WASD / arrows ride · Space hops · 1–7 tricks · P pauses · R recovers. Touch and gamepad supported.',rule:'Clean hops and successful tricks contribute their earned game points. Idle time earns nothing; new rides add to your total.'},
].map(game=>Object.freeze(game)));

export function rewardGameForURL(value,storeBase){
  try{
    const base=new URL(storeBase),url=new URL(value,base);
    if(url.origin!==base.origin)return undefined;
    const normalize=path=>path.replace(/index\.html$/,'').replace(/\/?$/,'/');
    return REWARD_GAMES.find(game=>normalize(new URL(game.path,base).pathname)===normalize(url.pathname));
  }catch{return undefined;}
}

export function rewardGameForNavigation(event,source,storeBase){
  if(!source||event.source!==source||event.origin!==new URL(storeBase).origin||event.data?.type!=='GOTHTECH_GAME_NAVIGATION')return undefined;
  return REWARD_GAMES.find(game=>game.id===event.data.gameId);
}

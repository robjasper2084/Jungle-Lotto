const art='../robot-rahbe-underground/assets/environment/detroit/';
export const GAMES=[
 {id:'underground',title:'Underground',tag:'VERTICAL EXPLORATION',status:'playable',path:'../robot-rahbe-underground/',art:'../robot-rahbe-underground/assets/environment/underground.png',accent:'#9fe4d7',description:'Descend beneath Detroit. Swing over forgotten tracks, recover three number seals, and face the Warden in the city’s deepest vault.',players:'1 PLAYER',length:'20–35 MIN',feature:'7 DEPTHS',controls:'A / D move · Space jump · W / S climb · J fire · E grab / use · M map. Controller: left stick, A, X / RT, Y. Touch controls included.',locations:['woodward','financial','central','michigan','guardian','penobscot','riverfront']},
 {id:'static-wars',title:'ROBOT RAHBE',tag:'RUN & GUN CAMPAIGN',status:'playable',path:'../shadow-ops-canvas/',art:'../shadow-ops-canvas/assets/backgrounds/higgsfield-soul-location-backplate.png',accent:'#c5a1ff',description:'Break the signal. Clear three number vaults, battle their guardians, and shut down Midas Heartcore. The original RAHBE campaign returns.',players:'1–2 PLAYERS',length:'15–25 MIN',feature:'3 SECTORS',controls:'Use the game’s Controls screen for both players. Keyboard, pointer, touch and gamepad supported. Solo, co-op and two-player modes stay available.',locations:[]},
 {id:'vault-rush',title:'Vault Rush',tag:'ACTION RUNNER',status:'playable',path:'../robot-rahbe-vault-rush/',art:'../robot-rahbe-vault-rush/assets/environment/detroit-riverwalk.webp',accent:'#c4e7c3',description:'Run 2.4 km along the downtown Detroit Riverwalk, then 2.4 km through the Dequindre Cut, with six distinct scenery views. Jump, slide, shoot and dash as the original Robot RAHBE. Build combos, collect shards and number chips, break distance records and unlock entertainment-based LottoMind Vault Drops.',players:'1 PLAYER',length:'QUICK RUNS',feature:'RUN / GUN / DASH',controls:'Space / W: jump (hold higher). S / Down: slide. J: shoot. K: dash. Shift: Overdrive. E: bank vault. P / Escape: pause. Gamepad: A jump, X / RT shoot, B dash, Down slide, Y Overdrive, LT bank, Start pause. Touch buttons included.',locations:['riverfront']},
 ...[
 ['neon-siege','Neon Siege','SURVIVAL','Hold the line against a citywide machine swarm.','detroit-transit'],
 ['boss-circuit','Boss Circuit','BOSS RUSH','One arena. Every guardian.','detroit-boss'],
 ['bounty-run','Bounty Run','MISSION ACTION','Track rogue signals across the city.','detroit-street'],
 ['number-heist','Number Heist','STEALTH & PUZZLES','Crack the code. Get out with the sequence.','detroit-vault'],
 ['cyber-arena','Cyber Arena','ARENA COMBAT','Master a new kind of combat circuit.','detroit-chamber'],
 ['vault-defense','Vault Defense','STRATEGY','Build a defense around the heart of LottoMind.','detroit-vault'],
 ['escape2084','Escape2084','ESCAPE ADVENTURE','Find a way home before the last signal fades.','detroit-station']
 ].map(([id,title,tag,description,bg])=>({id,title,tag,description,art:art+bg+'.webp',accent:'#ad99d2',status:'coming-soon',players:'IN DEVELOPMENT',feature:'COMING SOON',length:'—',controls:'This game is planned. A playable build is not yet available.',locations:[]}))
];
export const gameById=id=>GAMES.find(game=>game.id===id);
export const PLAYABLE_IDS=GAMES.filter(game=>game.status==='playable').map(game=>game.id);

export const CONFIG=Object.freeze({step:1/60,unitsPerMeter:10,baseSpeed:300,maxSpeed:460,dashSpeed:760,gravity:1600,jumpVelocity:700,jumpCutVelocity:380,coyoteTime:.14,jumpBuffer:.16,slideDuration:.28,dashCooldown:1.4,dashDuration:.22,overdriveDuration:7,health:6,viewAhead:3600,sceneryLength:8000,segmentLength:2100,recovery:850,maxGap:130,checkpoint:500,keyInterval:350,comboTimeout:7,projectileLimit:72,particleLimit:140});
export const TIERS=[{distance:0,speed:300,label:'NORMAL',difficulty:1},{distance:500,speed:350,label:'FAST',difficulty:2},{distance:1500,speed:410,label:'VERY FAST',difficulty:3},{distance:3000,speed:460,label:'EXTREME',difficulty:3}];
// Three 800-meter views per location; repeat the waterfront route after 4.8 km.
export const ZONES=[
 {name:'DETROIT RIVERWALK',sub:'DOWNTOWN / RENAISSANCE CENTER',region:'riverwalk',art:'riverwalk',portraitFocus:.24},
 {name:'DETROIT RIVERWALK',sub:'CULLEN PLAZA / ATWATER STREET',region:'riverwalk',art:'cullen',portraitFocus:.44},
 {name:'DETROIT RIVERWALK',sub:'MILLIKEN STATE PARK / HARBOR',region:'riverwalk',art:'milliken',portraitFocus:.5},
 {name:'DEQUINDRE CUT',sub:'ATWATER ENTRANCE / MURAL TRAIL',region:'dequindre',art:'dequindre',portraitFocus:.52},
 {name:'DEQUINDRE CUT',sub:'LAFAYETTE / CAMPBELL TERRACE',region:'dequindre',art:'campbell',portraitFocus:.5},
 {name:'DEQUINDRE CUT',sub:'FREIGHT YARD / EASTERN MARKET',region:'dequindre',art:'freight',portraitFocus:.5}
];
export const POWERUPS={magnet:{label:'SHARD MAGNET',icon:'◎',duration:12},shield:{label:'SHIELD',icon:'⬡',duration:20},double:{label:'2X DOUBLE SHOT',icon:'2X',duration:12},spread:{label:'3X TRIPLE SHOT',icon:'3X',duration:12},slow:{label:'SLOW TIME',icon:'◷',duration:7},boost:{label:'OVERDRIVE BOOST',icon:'OD',duration:0},doubleScore:{label:'DOUBLE SCORE',icon:'×2',duration:12},companion:{label:'DRONE COMPANION',icon:'◇',duration:12},doubleJump:{label:'DOUBLE JUMP',icon:'↑↑',duration:12},health:{label:'REPAIR',icon:'+',duration:0}};
export const ENEMIES={scout:{kind:'drone',hp:2,y:35,fire:0,size:94},gun:{kind:'drone',hp:3,y:80,fire:2.8,size:105},runner:{kind:'guard',hp:2,y:0,fire:0,size:116},guard:{kind:'guard',hp:4,y:0,fire:3.2,size:126},turret:{kind:'guard',hp:3,y:0,fire:2.5,size:100},mine:{kind:'drone',hp:1,y:66,fire:0,size:75},heavy:{kind:'warden',hp:7,y:0,fire:3.8,size:145},hunter:{kind:'drone',hp:35,y:60,fire:1.3,size:190}};

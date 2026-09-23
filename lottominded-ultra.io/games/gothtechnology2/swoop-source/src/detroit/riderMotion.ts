import type {RidePose} from './controller.ts';
const unit=(n:number)=>Math.max(0,Math.min(1,n));
/** Joint-space stance authored for the custom suit mesh and its measured leg reach. */
export function stanceTargets(p:RidePose){
  const live=1-unit(p.crashBlend);
  const landing=unit(p.landingCompression)*live,anticipate=unit(p.landingAnticipation)*live;
  const extension=unit(p.takeoffExtension)*live;
  const preload=unit(p.hopPreload)*(1-unit(p.airBlend))*live;
  const crouch=unit(Math.max(p.crouch,p.tuck)-extension*.65)*live;
  const forward=unit(p.riderPitch/.5)*live,back=unit(-p.riderPitch/.5)*live;
  const carve=unit(Math.abs(p.rollAngle)/.58)*live,air=unit(p.airBlend)*live;
  const technical=unit(1-Math.abs(p.speed)/5)*unit(Math.abs(p.turnIntent))*live;
  // Compact road posture grows with forward speed; a slow balance turn keeps its reach.
  const compact=unit((p.speed-5)/10)*(1-back)*live;
  const race=unit((p.speed-10)/8)*(1-back)*(1-air)*(1-crouch)*live;
  const reachPulse=unit(p.balanceReach)*live;
  const pitch=Math.max(-.3,Math.min(.93,.10+.52*p.riderPitch-p.wheelPitch+.64*crouch+.13*landing+.05*p.attack+.055*compact+.10*race));
  const drop=.08+Math.max(-.025,Math.min(.31,.27*crouch+.03*forward+.075*back+.035*carve+.012*p.tractionUsage+.035*air+.15*landing+.03*anticipate-.045*extension+p.terrainBend+.02*compact+.035*race));
  const hands=[1,-1].map(side=>{
    const outside=side!==Math.sign(p.rollAngle),reach=carve*(outside?1:-.3);
    return {x:side*(.018+.025*(forward+back)+.10*air+.065*carve*(outside?1:.15)*(1-.35*compact)+.04*landing+.04*reachPulse+.08*technical),
      y:.045+.025*carve*(outside?1:-.25)+.13*air+.14*crouch+.08*compact+.045*race+.055*landing+.14*extension+.045*reachPulse+technical*(outside?.34:.12),
      z:.055+.06*back-.035*forward+.22*crouch+.05*compact+.04*race+.10*reach+technical*(outside?.30:-.10)-.09*preload+.16*extension+.06*anticipate,
      wrist:Math.max(-.18,Math.min(.18,-p.riderPitch*.13+side*p.rollVelocity*.025-.09*air-.06*extension))};
  });
  return {drop,shift:.105*forward-.17*back-.09*crouch-.035*landing-.025*compact,pitch,neck:-pitch*.78,
    lateral:(-p.turnIntent*.025*technical+p.weightShift*.8-p.hipSway)*live,
    hipTilt:Math.sign(p.rollAngle)*carve*.07,hipYaw:-p.turnIntent*(.055+.08*technical)*live,
    chestRoll:p.rollAngle*.12*live,headRoll:p.rollAngle*.46*live,
    armBank:0,armSwing:0,shoulders:[0,0],
    chestYaw:p.riderTurnTwist+.22*p.reverseBlend,headYaw:p.riderLookYaw+.55*p.reverseBlend,carve,technical,hands};
}

/** The render adapter reads fixed-step body motion; hand-authored and crash poses still work. */
export function riderMotion(p:RidePose){
  const target=stanceTargets(p),mix=unit(p.naturalMotion)*(p.crashMotion?1:1-unit(p.crashBlend));
  const blend=(a:number,b:number)=>a+(b-a)*mix;
  const pitch=blend(target.pitch,p.bodyPitch);
  return {...target,drop:blend(target.drop,p.bodyDrop),shift:blend(target.shift,p.bodyShift),pitch,neck:-pitch*.78,
    lateral:blend(target.lateral,p.bodyLateral),hipTilt:blend(target.hipTilt,p.bodyHipTilt),hipYaw:blend(target.hipYaw,p.bodyHipYaw),
    armBank:blend(0,p.armBank),armSwing:blend(0,p.armSwing),shoulders:[blend(0,p.shoulderL),blend(0,p.shoulderR)],
    chestRoll:blend(target.chestRoll,p.bodyChestRoll),headRoll:blend(target.headRoll,p.bodyHeadRoll),
    chestYaw:blend(target.chestYaw,p.bodyTwist),headYaw:blend(target.headYaw,p.bodyLook),
    hands:target.hands.map((hand,i)=>({x:blend(hand.x,i===0?p.handLX:p.handRX),y:blend(hand.y,i===0?p.handLY:p.handRY),
      z:blend(hand.z,i===0?p.handLZ:p.handRZ),wrist:blend(hand.wrist,i===0?p.wristL:p.wristR)}))};
}

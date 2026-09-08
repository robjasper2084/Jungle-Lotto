import {launchJump,beginDash,beginOverdrive,takeDamage} from './core.js';
export function createPlayer(config){return {x:0,y:0,vy:0,grounded:true,coyote:config.coyoteTime,jumpBuffer:0,jumps:0,hp:config.health,maxHp:config.health,invuln:0,slideTime:0,sliding:false,dashCd:0,dashTime:0,overdrive:0,overdriveTime:0,fireCd:0,weapon:'rapid',weaponTime:0,shield:0,powers:{},action:'run',actionTime:0,landing:0};}
export function stepPlayer(p,a,dt,c,support){
 const events=[];p.actionTime+=dt;for(const key of ['invuln','dashCd','dashTime','overdriveTime','fireCd','weaponTime','landing'])p[key]=Math.max(0,p[key]-dt);for(const k of Object.keys(p.powers)){p.powers[k]=Math.max(0,p.powers[k]-dt);if(!p.powers[k])delete p.powers[k];}if(!p.weaponTime)p.weapon='rapid';
 p.jumpBuffer=Math.max(0,p.jumpBuffer-dt);if(a.jumpPressed)p.jumpBuffer=c.jumpBuffer;
 if(p.grounded&&(support===null||Math.abs(p.y-support)>2))p.grounded=false;p.coyote=p.grounded?c.coyoteTime:Math.max(0,p.coyote-dt);
 p.slideTime=Math.max(0,p.slideTime-dt);if(a.down&&p.grounded)p.slideTime=Math.max(p.slideTime,c.slideDuration);p.sliding=p.grounded&&p.slideTime>0;
 if(a.overdrivePressed&&p.overdrive>=100){beginOverdrive(p,c.overdriveDuration);events.push('overdrive');}
 if(a.dashPressed&&(p.dashCd===0||p.overdriveTime>0)){beginDash(p,{dashCooldown:c.dashCooldown,dashDuration:c.dashDuration});p.sliding=false;p.slideTime=0;events.push('dash');}
 if(p.jumpBuffer>0&&(p.grounded||p.coyote>0||p.powers.doubleJump&&p.jumps<2)&&(!p.sliding||p.slideTime<c.slideDuration*.6)){const air=!p.grounded&&p.coyote===0;launchJump(p,c.jumpVelocity);p.jumps=air?p.jumps+1:1;p.sliding=false;p.slideTime=0;events.push('jump');}
 if(a.jumpReleased&&p.vy>c.jumpCutVelocity)p.vy=c.jumpCutVelocity;
 const previousY=p.y;if(!p.grounded||p.vy>0){p.y+=p.vy*dt;p.vy-=c.gravity*dt*(p.dashTime>0?.18:1);p.grounded=false;}
 if(support!==null&&p.vy<=0&&previousY>=support-2&&p.y<=support){if(!p.grounded){p.landing=.13;events.push('land');}p.y=support;p.vy=0;p.grounded=true;p.jumps=0;}
 const action=p.hp<=0?'death':p.invuln>.85?'hurt':p.dashTime>0?'dash':p.overdriveTime>0&&a.shoot?'overdrive':a.shoot?'shoot-running':!p.grounded?(p.vy>0?'jump':'fall'):p.sliding?'slide':p.landing>0?'land':'run';if(action!==p.action){p.action=action;p.actionTime=0;}return events;
}
export function damagePlayer(p,amount){if(p.invuln>0||p.dashTime>0)return false;if(p.shield){p.shield=0;p.invuln=1;return 'shield';}return takeDamage(p,amount,1.2);}

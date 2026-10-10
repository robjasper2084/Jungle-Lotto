type Actions={throttle:number;steer:number};
/** Optional free-ride assistance. Braking stays immediate, and races keep their rules. */
export function easyRide<A extends Actions>(actions:A,speed:number,enabled:boolean,freeRide=true):A{
 if(!enabled||!freeRide)return actions;
 const maxSpeed=6.8,forward=Math.max(0,Math.min(.65,actions.throttle));
 const throttle=actions.throttle<0?actions.throttle:Math.min(forward,Math.max(-.4,(maxSpeed-speed)*.38));
 return {...actions,throttle,steer:actions.steer*(1-Math.min(.28,Math.abs(speed)*.025))};
}

/** Enclosed rooms live inside the persistent Mack shell. Their furniture and
 * visitors need not render through opaque walls from hundreds of metres away. */
export function interiorVisibility(distance:number,previous:boolean,active=false){
 return active||distance<(previous?100:85);
}
export function interiorVisitorsVisible(distance:number,previous:boolean,active=false){
 return active||distance<(previous?55:45);
}

/** Move the existing radio, never duplicate controls or touch audio state.
 * During a time trial it lives in the scrollable Tools dialog, out of the
 * Restart/Leave-race hit regions. Explicit cockpit library access is retained.
 */
export function syncRaceRadioDock(root:HTMLElement,menu:HTMLElement|null,racing:boolean,libraryOpen:boolean):boolean{
 const docked=!!(racing&&!libraryOpen&&menu?.isConnected);
 const parent=docked?menu!:root.ownerDocument.body;
 if(root.parentElement!==parent)parent.append(root);
 root.classList.toggle('race-menu-radio',docked);
 return docked;
}

/** Embedded radio buttons are not navigation; keep the Tools dialog open. */
export function closesRideMenu(target:Element):boolean{
 return !!target.closest('button')&&!target.closest('#ride-radio');
}

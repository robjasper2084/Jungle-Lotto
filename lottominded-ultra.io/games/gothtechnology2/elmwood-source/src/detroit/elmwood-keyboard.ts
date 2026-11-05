/** HUD buttons may keep focus after a tap; only editing/modal UI owns movement keys. */
export function elmwoodKeyboardBlocked(target:EventTarget|null,code:string){
 const node=target as Element|null;
 if(!node?.closest)return false;
 if(node.closest('input,select,textarea,[contenteditable],dialog[open],#elmwood-settings, #elmwood-layout-editor:not([hidden]),#duo-editor:not([hidden])'))return true;
 return !!node.closest('button,a,summary')&&['Enter','Space'].includes(code);
}

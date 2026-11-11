/** The LOVE TAG Node backend is hosted separately from the static Pages site.
 * Keep its test fixtures/source in Git; do not ship them to browser clients.
 * This does not affect the actual playable maps under store/swoop-source.
 */
export const serverOnlySourceRoot='lottominded-ultra.io/games/gothtechnology2/love-tag-server/';
export function isServerOnlySource(file){
 return typeof file==='string'&&file.startsWith(serverOnlySourceRoot);
}

// These are editable authoring files, source-public duplicates and QA captures.
// Publish their built game equivalents, not their development workspaces.
export const developmentOnlySourceRoots = Object.freeze([
  'lottominded-ultra.io/games/lottomind-jackpot-maze/source/',
  'lottominded-ultra.io/games/shadow-ops-canvas/docs/',
  'lottominded-ultra.io/games/lottomind-313-fortune-grid/docs/',
]);
export function isDevelopmentOnlySource(file){
 return typeof file==='string' && developmentOnlySourceRoots.some(root=>file.startsWith(root));
}

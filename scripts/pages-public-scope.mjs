/** The LOVE TAG Node backend is hosted separately from the static Pages site.
 * Keep its test fixtures/source in Git; do not ship them to browser clients.
 * This does not affect the actual playable maps under store/swoop-source.
 */
export const serverOnlySourceRoot='lottominded-ultra.io/games/gothtechnology2/love-tag-server/';
export function isServerOnlySource(file){
 return typeof file==='string'&&file.startsWith(serverOnlySourceRoot);
}

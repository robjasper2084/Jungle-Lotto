/** Only deployment configuration selects the server; invitation links cannot override it. */
export function onlineService(serverUrl: unknown, hostname: string) {
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(hostname);
  const value = typeof serverUrl === 'string' ? serverUrl.trim() : '';
  if (!value && !local) return {endpoint: '', message: 'Online rooms are not available in this build yet. Play offline with bots.'};
  try {
    const url = new URL(value || `http://${hostname}:8211`);
    if (url.username || url.password || !['http:', 'https:', 'ws:', 'wss:'].includes(url.protocol) || (!local && !['https:', 'wss:'].includes(url.protocol))) {
      return {endpoint: '', message: 'The online service needs a valid HTTPS / WSS address. Offline play is available.'};
    }
    return {endpoint: url.href.replace(/\/$/, ''), message: 'Online rooms connect to the game server. Each player controls their own rider.'};
  } catch {
    return {endpoint: '', message: 'The online service address is invalid. Offline play is available.'};
  }
}

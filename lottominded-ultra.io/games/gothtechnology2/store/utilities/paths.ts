export const base = (import.meta.env?.BASE_URL || '/').replace(/\/?$/, '/');
export function href(path = '') { return base + path.replace(/^\//, ''); }
export function media(src: string) { return /^https:\/\//.test(src) ? src : href(src); }
export function canonical(path = '') { return new URL(href(path), import.meta.env.PUBLIC_SITE_ORIGIN || 'https://robjasper2084.github.io').href; }

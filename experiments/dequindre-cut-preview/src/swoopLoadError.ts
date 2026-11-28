/** Three's image loader rejects with a DOM Event rather than an Error. Keep the
 * original request URL and preparation stage instead of reporting [object Event].
 */
export function describeSwoopLoadError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (!error || typeof error !== 'object') return String(error);
  const event = error as { message?: unknown; type?: unknown; target?: unknown; currentTarget?: unknown };
  const target = (event.target ?? event.currentTarget) as { currentSrc?: unknown; src?: unknown; responseURL?: unknown; href?: unknown } | undefined;
  const candidates = [target?.currentSrc, target?.src, target?.responseURL, target?.href];
  const url = candidates.find(value => typeof value === 'string' && value.length) as string | undefined;
  const message = typeof event.message === 'string' && event.message ? event.message : 'Asset load ' + (typeof event.type === 'string' && event.type ? event.type : 'failed');
  return message + (url ? ': ' + url : '');
}

export class SwoopStageError extends Error {
  readonly stage: string;
  constructor(stage: string, cause: unknown) {
    super('Source stage "' + stage + '" failed: ' + describeSwoopLoadError(cause), { cause });
    this.name = 'SwoopStageError';
    this.stage = stage;
  }
}

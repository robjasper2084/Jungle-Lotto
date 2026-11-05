import { describe, expect, it } from 'vitest';
import { buildShareMessage, buildSocialShareUrl } from '../services/socialShare';

describe('social sharing', () => {
  const message = buildShareMessage('Mega Millions', [4, 39, 49, 53, 70, 20], 14350);
  it('includes the score and number result', () => {
    expect(message).toContain('14,350 points');
    expect(message).toContain('4 • 39 • 49 • 53 • 70 • 20');
  });
  it('builds official Facebook and X composer URLs', () => {
    expect(new URL(buildSocialShareUrl('facebook', message, 'https://example.com')).hostname).toBe('www.facebook.com');
    expect(new URL(buildSocialShareUrl('x', message, 'https://example.com')).hostname).toBe('twitter.com');
  });
});

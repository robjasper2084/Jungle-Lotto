import { characters, collections } from '../content/catalog.ts';
export type GameStoreMessage =
  | { type: 'GOTHTECH_GAME_READY'; version: string }
  | { type: 'GOTHTECH_CHARACTER_SELECTED'; characterId: string }
  | { type: 'GOTHTECH_MATCH_COMPLETED'; characterId: string; result: 'win' | 'loss'; durationSeconds: number }
  | { type: 'GOTHTECH_OPEN_COLLECTION'; collectionHandle: string };
export function validGameMessage(data: unknown): data is GameStoreMessage {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
  const d = data as Record<string, unknown>;
  const keys = Object.keys(d).sort().join(',');
  if (d.type === 'GOTHTECH_GAME_READY') return keys === 'type,version' && d.version === '1';
  if (d.type === 'GOTHTECH_CHARACTER_SELECTED') return keys === 'characterId,type' && characters.some(c => c.id === d.characterId);
  if (d.type === 'GOTHTECH_OPEN_COLLECTION') return keys === 'collectionHandle,type' && collections.some(c => c.handle === d.collectionHandle);
  if (d.type === 'GOTHTECH_MATCH_COMPLETED') return keys === 'characterId,durationSeconds,result,type'
    && characters.some(c => c.id === d.characterId) && ['win', 'loss'].includes(String(d.result))
    && typeof d.durationSeconds === 'number' && Number.isFinite(d.durationSeconds) && d.durationSeconds >= 1 && d.durationSeconds <= 7200;
  return false;
}
export function acceptGameMessage(event: Pick<MessageEvent, 'origin' | 'source' | 'data'>, origin: string, source: MessageEventSource | null) {
  return source !== null && event.origin === origin && event.source === source && validGameMessage(event.data);
}
export interface RewardService {
  issueSession(): Promise<{ token: string; expiresAt: number }>;
  claim(sessionToken: string): Promise<{ eligible: boolean; reason: string }>;
}
export const monetaryRewards: RewardService = {
  async issueSession() { throw new Error('Monetary rewards are disabled until a verified server reward service is configured.'); },
  async claim() { return { eligible: false, reason: 'Client-side game messages never authorize monetary rewards.' }; },
};
export function cosmeticReward(message: GameStoreMessage) {
  return message.type === 'GOTHTECH_MATCH_COMPLETED' && message.durationSeconds >= 30
    ? { id: `signal-${message.characterId}`, label: 'Local signal badge', monetaryValue: 0, serverVerified: false } : null;
}

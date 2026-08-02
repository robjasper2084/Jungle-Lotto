export const RULESET_VERSION = "1.0.0-beta.1";
export type GameMode = "quick313" | "standard" | "daily";
export type Personality = "Builder" | "Visionary" | "Analyst" | "Creator";
export type Phase = "setup" | "roll" | "route" | "moving" | "action" | "ended";
export type NodeKind = "venture" | "hub" | "transit" | "pulse" | "signal" | "oracle" | "lab" | "studio" | "grant";

export interface Player {
  id: string;
  name: string;
  cpu: boolean;
  personality?: Personality;
  color: string;
  nodeId: number;
  previousNodeId: number | null;
  dollars: number;
  legacy: number;
  focus: number;
  signals: number[];
  ventures: Record<number, number>;
  rebuild: boolean;
  savedSequences: number[][];
}

export interface MatchEvent { id: number; type: string; message: string; playerId?: string; payload?: Record<string, unknown> }
export interface PendingRoll { movement: number; signal: number; routes: number[][] }
export interface GameSettings { reducedMotion: boolean; particles: boolean; highContrast: boolean; textScale: number; muted: boolean }

export interface GameState {
  rulesetVersion: string;
  matchId: string;
  seed: number;
  rngState: number;
  actionLog: string[];
  mode: GameMode;
  maxRounds: number;
  round: number;
  currentPlayer: number;
  phase: Phase;
  players: Player[];
  pendingRoll: PendingRoll | null;
  activeCard: { type: "pulse" | "oracle"; id: string } | null;
  eventLog: MatchEvent[];
  settings: GameSettings;
  startedAt: number;
  completedAt?: number;
}

export interface SetupInput { mode: GameMode; playerCount: number; localPlayers: number; seed: number; names?: string[] }

export function createInitialState(input: SetupInput): GameState {
  const personalities: Personality[] = ["Builder", "Visionary", "Analyst", "Creator"];
  const colors = ["#f5c451", "#61e7ff", "#be70ff", "#ff8d68"];
  const players = Array.from({ length: input.playerCount }, (_, index): Player => ({
    id: `p${index + 1}`,
    name: input.names?.[index] || (index < input.localPlayers ? `Player ${index + 1}` : personalities[index % personalities.length]),
    cpu: index >= input.localPlayers,
    personality: index >= input.localPlayers ? personalities[index % personalities.length] : undefined,
    color: colors[index], nodeId: 0, previousNodeId: null, dollars: 1313, legacy: 0, focus: 3,
    signals: [], ventures: {}, rebuild: false, savedSequences: []
  }));
  return {
    rulesetVersion: RULESET_VERSION,
    matchId: `fg-${input.seed.toString(36)}-${input.mode}`,
    seed: input.seed >>> 0,
    rngState: input.seed >>> 0,
    actionLog: [], mode: input.mode, maxRounds: input.mode === "standard" ? 13 : 3,
    round: 1, currentPlayer: 0, phase: "roll", players, pendingRoll: null, activeCard: null,
    eventLog: [{ id: 1, type: "match", message: `Fortune Grid ${input.mode} match started.` }],
    settings: { reducedMotion: false, particles: true, highContrast: false, textScale: 1, muted: true },
    startedAt: Date.now()
  };
}

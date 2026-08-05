import type { GameMode, GameSettings } from "./state";
export type GameAction =
  | { type:"ROLL" }
  | { type:"CHOOSE_ROUTE"; route:number[] }
  | { type:"COMPLETE_MOVEMENT"; route:number[] }
  | { type:"LAUNCH_VENTURE" }
  | { type:"UPGRADE_VENTURE"; ventureId:number }
  | { type:"SELL_VENTURE"; ventureId:number }
  | { type:"SPONSOR_VENTURE"; ventureId:number }
  | { type:"PARTNER_VENTURE"; ventureId:number }
  | { type:"TRADE_VENTURE"; ventureId:number; targetPlayer:number }
  | { type:"SIGNAL_REORDER"; from:number; to:number }
  | { type:"SIGNAL_LOCK"; index:number }
  | { type:"SIGNAL_REPLACE"; index:number; digit:number }
  | { type:"SIGNAL_SORT" }
  | { type:"SAVE_SEQUENCE" }
  | { type:"MANUAL_SAVE" }
  | { type:"BEAT_RESULT"; hits:number }
  | { type:"DISMISS_CARD" }
  | { type:"END_TURN" }
  | { type:"SETTINGS"; patch:Partial<GameSettings> }
  | { type:"RESTART"; mode?:GameMode };

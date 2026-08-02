export function appendSignal(signals: number[], digit: number, size = 4): number[] { return [...signals, digit].slice(-size); }
export function reorderSignal(signals: number[], from: number, to: number): number[] { const next=[...signals]; const [digit]=next.splice(from,1); next.splice(to,0,digit); return next; }
export function replaceSignal(signals: number[], index: number, digit: number): number[] { return signals.map((value,i)=>i===index?digit:value); }
export function sortSignal(signals: number[]): number[] { return [...signals].sort((a,b)=>a-b); }
export function signalMatches(signals: number[], draw: number[]): number { return signals.filter((digit,index)=>digit===draw[index]).length; }

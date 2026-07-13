export const resolveRoundOutcome = (p1Health, p2Health, roundTimer) => {
  const p1KO = p1Health <= 0;
  const p2KO = p2Health <= 0;
  const timedOut = roundTimer <= 0;
  if (!p1KO && !p2KO && !timedOut) return null;

  if (p1KO && p2KO) {
    return { draw: true, winnerIndex: null, reason: "double_KO" };
  }
  if (p1KO) return { draw: false, winnerIndex: 1, reason: "KO" };
  if (p2KO) return { draw: false, winnerIndex: 0, reason: "KO" };
  if (p1Health === p2Health) {
    return { draw: true, winnerIndex: null, reason: "timeout" };
  }
  return { draw: false, winnerIndex: p1Health > p2Health ? 0 : 1, reason: "timeout" };
};

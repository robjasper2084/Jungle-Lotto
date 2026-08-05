import { boardNodes } from "../content/board";

export function findRoutes(start: number, previous: number | null, steps: number, limit = 8): number[][] {
  const routes: number[][] = [];
  function walk(path: number[], remaining: number) {
    if (routes.length >= limit) return;
    if (remaining === 0) { routes.push(path); return; }
    const current = path[path.length - 1];
    const prior = path.length > 1 ? path[path.length - 2] : previous;
    const candidates = boardNodes[current].edges.filter((id) => id !== prior);
    const next = candidates.length ? candidates : boardNodes[current].edges;
    next.forEach((id) => walk([...path, id], remaining - 1));
  }
  walk([start], steps);
  const unique = new Map(routes.map((route) => [route.join("-"), route]));
  return [...unique.values()];
}

export function isLegalRoute(route: number[], steps: number): boolean {
  if (route.length !== steps + 1) return false;
  return route.every((node, index) => index === 0 || boardNodes[route[index - 1]]?.edges.includes(node));
}

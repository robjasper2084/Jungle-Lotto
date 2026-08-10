import { boardNodes } from "../content/board";

export function clockwiseRoute(start: number, steps: number): number[] {
  return Array.from({ length: steps + 1 }, (_, offset) => (start + offset) % boardNodes.length);
}

export function findRoutes(start: number, _previous: number | null, steps: number, _limit = 8): number[][] {
  return [clockwiseRoute(start, steps)];
}

export function isLegalRoute(route: number[], steps: number): boolean {
  if (route.length !== steps + 1) return false;
  return route.every((node, index) => index === 0 || node === (route[index - 1] + 1) % boardNodes.length);
}

export function crossesHub(route: number[]): boolean {
  return route.slice(1).some((node, index) => node === 0 && route[index] !== 0);
}

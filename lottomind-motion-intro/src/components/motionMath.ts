import { Easing, interpolate } from "remotion";

export const COLORS = {
  background: "#03040b",
  panel: "#08111f",
  cyan: "#00f5ff",
  violet: "#8b5cf6",
  magenta: "#ff2bd6",
  gold: "#ffd166",
  green: "#3dff9f",
  white: "#f8fbff",
};

export const clamp = (value: number, min = 0, max = 1) => Math.max(min, Math.min(max, value));

export const ease = (frame: number, input: [number, number], output: [number, number]) =>
  interpolate(frame, input, output, {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

export const pulse = (frame: number, period = 18, min = 0.35, max = 1) => {
  const wave = (Math.sin((frame / period) * Math.PI * 2) + 1) / 2;
  return min + wave * (max - min);
};

export const hashRandom = (seed: number) => {
  let t = seed + 0x6d2b79f5;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

export const beatCurve = (frame: number, bpm = 142, fps = 30) => {
  const beat = (frame / fps) * (bpm / 60);
  const phase = beat % 1;
  return Math.pow(1 - phase, 5);
};

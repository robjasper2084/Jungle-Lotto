import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, pulse } from "./motionMath";

export const NeonBackground = ({ intensity = 1 }: { intensity?: number }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const push = interpolate(frame, [0, 360], [1.04, 1.12], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const glow = pulse(frame, 42, 0.35, 0.82) * intensity;

  return (
    <AbsoluteFill className="neon-background" style={{ backgroundColor: COLORS.background }}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="background-svg" style={{ transform: `scale(${push})` }}>
        <defs>
          <radialGradient id="bgCyan" cx="50%" cy="35%" r="60%">
            <stop offset="0%" stopColor={COLORS.cyan} stopOpacity={0.22 * glow} />
            <stop offset="48%" stopColor={COLORS.violet} stopOpacity={0.08 * glow} />
            <stop offset="100%" stopColor={COLORS.background} stopOpacity="0" />
          </radialGradient>
          <linearGradient id="gridLine" x1="0" x2="1">
            <stop stopColor={COLORS.cyan} stopOpacity=".06" />
            <stop offset=".5" stopColor={COLORS.magenta} stopOpacity=".12" />
            <stop offset="1" stopColor={COLORS.gold} stopOpacity=".05" />
          </linearGradient>
        </defs>
        <rect width={width} height={height} fill="url(#bgCyan)" />
        {Array.from({ length: 16 }).map((_, i) => (
          <line key={`h-${i}`} x1={0} x2={width} y1={(height / 16) * i} y2={(height / 16) * i} stroke="url(#gridLine)" strokeWidth={1} />
        ))}
        {Array.from({ length: 22 }).map((_, i) => (
          <line key={`v-${i}`} y1={0} y2={height} x1={(width / 22) * i} x2={(width / 22) * i} stroke={COLORS.cyan} strokeOpacity=".045" strokeWidth={1} />
        ))}
        <ellipse cx={width * 0.52} cy={height * 0.55} rx={width * 0.32} ry={height * 0.18} fill="none" stroke={COLORS.cyan} strokeOpacity=".12" strokeWidth="3" />
        <ellipse cx={width * 0.54} cy={height * 0.52} rx={width * 0.2} ry={height * 0.1} fill="none" stroke={COLORS.magenta} strokeOpacity=".12" strokeWidth="3" />
      </svg>
    </AbsoluteFill>
  );
};

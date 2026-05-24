import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { beatCurve, COLORS } from "./motionMath";

type AudioDnaHelixProps = {
  label?: string;
  subtitle?: string;
  compact?: boolean;
  vertical?: boolean;
};

export const AudioDnaHelix = ({ label, subtitle, compact = false, vertical = false }: AudioDnaHelixProps) => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 18, stiffness: 80 } });
  const beat = beatCurve(frame, 142, fps);
  const cx = width / 2;
  const cy = vertical ? height * 0.38 : height * 0.48;
  const w = compact ? width * 0.28 : vertical ? width * 0.72 : width * 0.48;
  const h = compact ? height * 0.34 : vertical ? height * 0.3 : height * 0.38;
  const samples = 72;
  const left = Array.from({ length: samples }).map((_, index) => {
    const t = index / (samples - 1);
    const x = cx - w / 2 + t * w;
    const y = cy + Math.sin(t * Math.PI * 4 + frame * 0.05) * h * 0.32;
    return `${x},${y}`;
  });
  const right = Array.from({ length: samples }).map((_, index) => {
    const t = index / (samples - 1);
    const x = cx - w / 2 + t * w;
    const y = cy + Math.sin(t * Math.PI * 4 + Math.PI + frame * 0.05) * h * 0.32;
    return `${x},${y}`;
  });

  return (
    <div className={compact ? "dna-shell compact" : "dna-shell"} style={{ opacity: enter, transform: `scale(${0.86 + enter * 0.14})` }}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <polyline points={left.join(" ")} fill="none" stroke={COLORS.cyan} strokeWidth={compact ? 5 : 8} strokeLinecap="round" />
        <polyline points={right.join(" ")} fill="none" stroke={COLORS.green} strokeWidth={compact ? 4 : 6} strokeLinecap="round" opacity=".9" />
        {Array.from({ length: 16 }).map((_, index) => {
          const t = index / 15;
          const x = cx - w / 2 + t * w;
          const y1 = cy + Math.sin(t * Math.PI * 4 + frame * 0.05) * h * 0.32;
          const y2 = cy + Math.sin(t * Math.PI * 4 + Math.PI + frame * 0.05) * h * 0.32;
          const r = 5 + beat * 9 + (index % 3) * 2;
          return (
            <g key={index}>
              <line x1={x} y1={y1} x2={x} y2={y2} stroke={COLORS.violet} strokeOpacity=".42" strokeWidth="3" />
              <circle cx={x} cy={y1} r={r} fill={index % 2 ? COLORS.gold : COLORS.magenta} opacity=".86" />
            </g>
          );
        })}
        {!compact &&
          Array.from({ length: 10 }).map((_, index) => {
            const x = cx - w * 0.45 + index * (w / 10);
            const y = cy + h * 0.34 + ((index % 4) - 1.5) * 18;
            const noteOpacity = interpolate(frame, [10 + index * 3, 26 + index * 3], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            return <rect key={index} x={x} y={y} width={38} height={12} rx={4} fill={COLORS.gold} opacity={noteOpacity} />;
          })}
      </svg>
      {label && (
        <div className={vertical ? "dna-label vertical" : "dna-label"}>
          <h2>{label}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
      )}
    </div>
  );
};

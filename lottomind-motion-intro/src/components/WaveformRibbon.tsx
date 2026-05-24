import { useCurrentFrame, useVideoConfig } from "remotion";
import { beatCurve, COLORS } from "./motionMath";

type WaveformRibbonProps = {
  top?: number;
  opacity?: number;
};

export const WaveformRibbon = ({ top, opacity = 1 }: WaveformRibbonProps) => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const y = top ?? height * 0.5;
  const beat = beatCurve(frame, 142, fps);
  const points = Array.from({ length: 80 }).map((_, index) => {
    const x = (index / 79) * width;
    const amp = 30 + ((index * 17) % 46) + beat * 60;
    const wave = Math.sin(index * 0.72 + frame * 0.16) * amp;
    return `${x.toFixed(1)},${(y + wave).toFixed(1)}`;
  });

  return (
    <svg className="waveform-ribbon" width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ opacity }}>
      <polyline points={points.join(" ")} fill="none" stroke={COLORS.cyan} strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" />
      <polyline points={points.join(" ")} fill="none" stroke={COLORS.magenta} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" opacity=".7" />
    </svg>
  );
};

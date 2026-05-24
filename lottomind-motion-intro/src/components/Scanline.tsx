import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS } from "./motionMath";

export const Scanline = ({ vertical = false }: { vertical?: boolean }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const pos = interpolate(frame, [0, 44], vertical ? [-120, width + 120] : [-90, height + 90], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill>
      <div
        className="scanline"
        style={{
          width: vertical ? 5 : "100%",
          height: vertical ? "100%" : 5,
          transform: vertical ? `translateX(${pos}px)` : `translateY(${pos}px)`,
          boxShadow: `0 0 42px ${COLORS.cyan}, 0 0 120px ${COLORS.violet}`,
        }}
      />
    </AbsoluteFill>
  );
};

import { interpolate, useCurrentFrame } from "remotion";
import { COLORS } from "./motionMath";

export const PianoRollFlash = () => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 20], [0, 0.9], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <div className="piano-roll-flash" style={{ opacity }}>
      {Array.from({ length: 24 }).map((_, index) => (
        <div
          key={index}
          className="piano-note"
          style={{
            left: `${(index % 8) * 12 + 4}%`,
            top: `${Math.floor(index / 8) * 24 + 14}%`,
            width: `${8 + (index % 3) * 6}%`,
            background: [COLORS.cyan, COLORS.violet, COLORS.gold, COLORS.green][index % 4],
            opacity: 0.24 + (((frame + index * 5) % 28) / 28) * 0.7,
          }}
        />
      ))}
    </div>
  );
};

import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { beatCurve, COLORS } from "./motionMath";

const labels = ["Pick 3", "Pick 4", "Powerball", "State Games"];

export const NumberOrbs = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const beat = beatCurve(frame, 142, fps);

  return (
    <div className="number-orbs">
      <div className="lane-label">LOTTERY NUMBERS</div>
      {labels.map((label, index) => {
        const enter = spring({ frame: frame - index * 5, fps, config: { damping: 18, stiffness: 120 } });
        return (
          <div key={label} className="number-orb-card" style={{ opacity: enter, transform: `translateX(${(1 - enter) * 70}px)` }}>
            <span className="orb" style={{ boxShadow: `0 0 ${18 + beat * 40}px ${index % 2 ? COLORS.gold : COLORS.cyan}` }} />
            <strong>{label}</strong>
          </div>
        );
      })}
    </div>
  );
};

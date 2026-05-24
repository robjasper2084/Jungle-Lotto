import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { beatCurve, COLORS } from "./motionMath";

export const PadGridReveal = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 16, stiffness: 100 } });
  const beat = beatCurve(frame, 142, fps);
  const active = Math.floor(frame / 8) % 16;

  return (
    <div className="pad-grid-reveal" style={{ opacity: enter, transform: `translateX(${(1 - enter) * -90}px) scale(${0.92 + enter * 0.08})` }}>
      {Array.from({ length: 16 }).map((_, index) => {
        const lit = index === active || index % 5 === Math.floor(frame / 14) % 5;
        return (
          <div
            key={index}
            className="motion-pad"
            style={{
              borderColor: lit ? COLORS.green : "rgba(255,255,255,.14)",
              boxShadow: lit ? `0 0 ${24 + beat * 30}px ${index % 2 ? COLORS.magenta : COLORS.cyan}` : "none",
              transform: `scale(${lit ? 1.06 + beat * 0.05 : 1})`,
            }}
          >
            <span>{index + 1}</span>
          </div>
        );
      })}
    </div>
  );
};

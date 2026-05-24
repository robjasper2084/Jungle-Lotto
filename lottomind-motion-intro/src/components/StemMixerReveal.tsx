import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { beatCurve, COLORS } from "./motionMath";

export const StemMixerReveal = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame: frame - 4, fps, config: { damping: 20, stiffness: 92 } });
  const beat = beatCurve(frame, 142, fps);

  return (
    <div className="stem-mixer-reveal" style={{ opacity: enter, transform: `translateY(${(1 - enter) * 100}px)` }}>
      {Array.from({ length: 8 }).map((_, index) => {
        const level = 42 + ((index * 13 + frame * 2) % 48) + beat * 32;
        const fader = 34 + ((index * 11) % 54);
        return (
          <div key={index} className="mixer-strip">
            <div className="meter-track">
              <span style={{ height: `${Math.min(96, level)}%`, background: index % 2 ? COLORS.magenta : COLORS.green }} />
            </div>
            <div className="fader-track">
              <span style={{ bottom: `${fader}%`, background: index % 3 ? COLORS.cyan : COLORS.gold }} />
            </div>
            <div className="mixer-dot" />
          </div>
        );
      })}
    </div>
  );
};

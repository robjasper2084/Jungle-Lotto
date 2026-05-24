import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS } from "./motionMath";

export const DjDeckRings = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame: frame - 8, fps, config: { damping: 18, stiffness: 90 } });

  return (
    <div className="dj-rings" style={{ opacity: enter, transform: `translateX(${(1 - enter) * 100}px)` }}>
      {[0, 1].map((deck) => {
        const rotate = frame * (deck ? -1.8 : 1.8);
        return (
          <svg key={deck} viewBox="0 0 220 220" className="deck-ring" style={{ transform: `rotate(${rotate}deg)` }}>
            <circle cx="110" cy="110" r="92" fill="rgba(8,17,31,.72)" stroke={deck ? COLORS.magenta : COLORS.cyan} strokeWidth="5" />
            <circle cx="110" cy="110" r="64" fill="none" stroke={COLORS.gold} strokeOpacity=".72" strokeWidth="4" strokeDasharray="14 10" />
            <circle cx="110" cy="110" r="24" fill={deck ? COLORS.violet : COLORS.green} opacity=".78" />
            <path d="M110 18v42" stroke={COLORS.white} strokeWidth="6" strokeLinecap="round" />
          </svg>
        );
      })}
    </div>
  );
};

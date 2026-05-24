import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, pulse } from "./motionMath";

type LogoOrbProps = {
  compact?: boolean;
  hold?: boolean;
  transparent?: boolean;
};

export const LogoOrb = ({ compact = false, hold = false, transparent = false }: LogoOrbProps) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = hold ? 1 : spring({ frame, fps, config: { damping: 16, stiffness: 80 } });
  const glow = pulse(frame, 40, 0.5, 1);
  const size = compact ? 210 : 330;

  return (
    <div className={compact ? "logo-orb compact" : "logo-orb"} style={{ transform: `scale(${0.72 + enter * 0.28})`, opacity: enter }}>
      <svg width={size} height={size} viewBox="0 0 330 330">
        <defs>
          <radialGradient id="logoGlow" cx="35%" cy="25%" r="76%">
            <stop stopColor={COLORS.white} stopOpacity=".86" />
            <stop offset=".22" stopColor={COLORS.cyan} />
            <stop offset=".62" stopColor={COLORS.violet} />
            <stop offset="1" stopColor={transparent ? "transparent" : COLORS.background} />
          </radialGradient>
        </defs>
        <circle cx="165" cy="165" r="126" fill="url(#logoGlow)" opacity=".92" />
        <circle cx="165" cy="165" r={142 + glow * 12} fill="none" stroke={COLORS.gold} strokeWidth="5" opacity=".68" />
        <path d="M94 205V116h26v66h42v23H94Zm82 0v-89h26l26 42 26-42h26v89h-25v-47l-24 38h-4l-24-38v47h-23Z" fill={COLORS.white} />
        <path d="M72 166c36-30 56-30 92 0s56 30 92 0" fill="none" stroke={COLORS.green} strokeWidth="7" strokeLinecap="round" opacity=".76" />
      </svg>
    </div>
  );
};

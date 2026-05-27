import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";

const COLORS = ["#00f5ff", "#8b5cf6", "#ff2bd6", "#ffd166", "#3dff9f"];

const seeded = (index: number) => {
  const value = Math.sin(index * 129.9898) * 43758.5453;
  return value - Math.floor(value);
};

export const FuturisticLogoSting = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const logoIn = spring({ frame, fps, config: { damping: 18, stiffness: 92, mass: 0.8 } });
  const titleIn = spring({ frame: frame - 68, fps, config: { damping: 20, stiffness: 80 } });
  const finalGlow = interpolate(frame, [96, 118, 150], [0, 1, 0.45], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const scan = interpolate(frame, [0, 130], [-height * 0.2, height * 1.05], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const pulse = 1 + Math.sin(frame * 0.28) * 0.035 + finalGlow * 0.04;
  const logoSize = Math.min(width, height) * 0.42;

  return (
    <AbsoluteFill className="future-sting">
      <svg className="future-circuit-bg" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        <defs>
          <radialGradient id="futureCore" cx="50%" cy="42%" r="58%">
            <stop offset="0%" stopColor="#00f5ff" stopOpacity="0.26" />
            <stop offset="42%" stopColor="#8b5cf6" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#02040a" stopOpacity="0.98" />
          </radialGradient>
          <linearGradient id="futureLine" x1="0" x2="1">
            <stop stopColor="#00f5ff" />
            <stop offset="0.52" stopColor="#ffd166" />
            <stop offset="1" stopColor="#8b5cf6" />
          </linearGradient>
        </defs>
        <rect width={width} height={height} fill="url(#futureCore)" />
        {Array.from({ length: 22 }).map((_, index) => {
          const y = 70 + seeded(index) * (height - 140);
          const side = index % 2 === 0 ? 0 : width;
          const mid = width * (0.24 + seeded(index + 40) * 0.52);
          const color = COLORS[index % COLORS.length];
          const dash = interpolate(frame, [0, 70, 135], [420, 0, -160], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          return (
            <path
              key={index}
              d={`M ${side} ${y} H ${mid - 90} L ${mid - 28} ${y + (seeded(index + 2) - 0.5) * 96} H ${width / 2}`}
              fill="none"
              stroke={color}
              strokeOpacity={0.18 + seeded(index + 7) * 0.28}
              strokeWidth={2 + seeded(index + 3) * 2.5}
              strokeDasharray="14 18"
              strokeDashoffset={dash + index * 18}
            />
          );
        })}
        {Array.from({ length: 7 }).map((_, index) => {
          const radius = logoSize * (0.62 + index * 0.14);
          const opacity = interpolate(frame, [index * 7, 75 + index * 6, 150], [0, 0.35, 0.08], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          return (
            <ellipse
              key={index}
              cx={width / 2}
              cy={height * 0.42}
              rx={radius}
              ry={radius * 0.28}
              fill="none"
              stroke="url(#futureLine)"
              strokeOpacity={opacity}
              strokeWidth="2"
              transform={`rotate(${frame * (0.12 + index * 0.035)} ${width / 2} ${height * 0.42})`}
            />
          );
        })}
      </svg>

      <div className="future-particles">
        {Array.from({ length: 95 }).map((_, index) => {
          const x = `${seeded(index + 300) * 100}%`;
          const y = `${seeded(index + 800) * 100}%`;
          const size = 2 + seeded(index + 1100) * 6;
          const opacity = interpolate(frame, [0, 38, 130], [0, 0.75, 0.18], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          return (
            <span
              key={index}
              style={{
                left: x,
                top: y,
                width: size,
                height: size,
                opacity: opacity * (0.4 + seeded(index + 1300) * 0.6),
                background: COLORS[index % COLORS.length],
                transform: `translateY(${Math.sin((frame + index) * 0.08) * 18}px)`,
              }}
            />
          );
        })}
      </div>

      <div className="future-scanline" style={{ transform: `translateY(${scan}px)` }} />

      <div
        className="future-logo-stage"
        style={{
          width: logoSize,
          height: logoSize,
          transform: `translate(-50%, -50%) scale(${interpolate(logoIn, [0, 1], [0.62, pulse])}) rotate(${interpolate(
            frame,
            [0, 50],
            [-10, 0],
            { extrapolateRight: "clamp" },
          )}deg)`,
          filter: `drop-shadow(0 0 ${42 + finalGlow * 70}px rgba(0,245,255,${0.32 + finalGlow * 0.34}))`,
        }}
      >
        <div className="future-logo-halo" />
        <Img src={staticFile("assets/lottominded-ultra-logo.webp")} className="future-logo-image" />
      </div>

      <div
        className="future-title-lockup"
        style={{
          opacity: titleIn,
          transform: `translateX(-50%) translateY(${interpolate(titleIn, [0, 1], [38, 0])}px)`,
        }}
      >
        <div className="future-eyebrow">Signal Boot Complete</div>
        <h1>Lottominded ULTRA</h1>
        <p>Make beats. Build prompts. Generate creative signals.</p>
      </div>
    </AbsoluteFill>
  );
};

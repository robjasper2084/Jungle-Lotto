import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, hashRandom, pulse } from "./motionMath";

type ParticleFieldProps = {
  count?: number;
  seed?: number;
};

export const ParticleField = ({ count = 120, seed = 1 }: ParticleFieldProps) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const particles = Array.from({ length: count }).map((_, index) => {
    const x = hashRandom(seed + index * 11) * width;
    const y = hashRandom(seed + index * 19) * height;
    const r = 1.4 + hashRandom(seed + index * 29) * 3.8;
    const drift = (hashRandom(seed + index * 43) - 0.5) * 32;
    const p = pulse(frame + index * 2, 24 + (index % 5) * 7, 0.2, 1);
    const colors = [COLORS.cyan, COLORS.violet, COLORS.magenta, COLORS.gold, COLORS.green];
    return { x: x + Math.sin(frame / 28 + index) * drift, y: y + Math.cos(frame / 34 + index) * drift, r, p, color: colors[index % colors.length] };
  });

  return (
    <AbsoluteFill className="particle-layer">
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        {particles.map((particle, index) => (
          <circle
            key={index}
            cx={particle.x}
            cy={particle.y}
            r={particle.r}
            fill={particle.color}
            opacity={0.12 + particle.p * 0.34}
          />
        ))}
      </svg>
    </AbsoluteFill>
  );
};

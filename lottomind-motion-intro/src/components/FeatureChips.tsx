import { spring, useCurrentFrame, useVideoConfig } from "remotion";

type FeatureChipsProps = {
  chips: string[];
  vertical?: boolean;
};

export const FeatureChips = ({ chips, vertical = false }: FeatureChipsProps) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <div className={vertical ? "feature-chips vertical" : "feature-chips"}>
      {chips.map((chip, index) => {
        const enter = spring({ frame: frame - index * 4, fps, config: { damping: 18, stiffness: 120 } });
        return (
          <div
            key={chip}
            className="feature-chip"
            style={{
              opacity: Math.min(1, enter),
              transform: `translateY(${(1 - enter) * 34}px) scale(${0.92 + enter * 0.08})`,
            }}
          >
            {chip}
          </div>
        );
      })}
    </div>
  );
};

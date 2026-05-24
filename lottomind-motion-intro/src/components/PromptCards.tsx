import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS } from "./motionMath";

const cards = ["Genre", "Mood", "Lyrics", "Arrangement"];

export const PromptCards = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <div className="prompt-cards">
      <div className="lane-label">SUNO PROMPT</div>
      {cards.map((card, index) => {
        const enter = spring({ frame: frame - index * 5, fps, config: { damping: 18, stiffness: 120 } });
        return (
          <div key={card} className="prompt-card" style={{ opacity: enter, transform: `translateX(${(1 - enter) * -70}px)` }}>
            <span>{card}</span>
            <div style={{ background: index % 2 ? COLORS.magenta : COLORS.cyan }} />
          </div>
        );
      })}
    </div>
  );
};

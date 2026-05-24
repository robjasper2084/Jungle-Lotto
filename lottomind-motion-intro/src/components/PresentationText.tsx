import { spring, useCurrentFrame, useVideoConfig } from "remotion";

type PresentationTextProps = {
  title: string;
  subtitle?: string;
  align?: "left" | "center";
  vertical?: boolean;
};

export const PresentationText = ({ title, subtitle, align = "center", vertical = false }: PresentationTextProps) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame: frame - 4, fps, config: { damping: 18, stiffness: 120 } });
  const centerOffset = align === "center" ? "translateX(-50%) " : "";

  return (
    <div
      className={`presentation-text ${align} ${vertical ? "vertical" : ""}`}
      style={{
        opacity: enter,
        transform: `${centerOffset}translateY(${(1 - enter) * 36}px)`,
      }}
    >
      <h1>{title}</h1>
      {subtitle && <p>{subtitle}</p>}
    </div>
  );
};

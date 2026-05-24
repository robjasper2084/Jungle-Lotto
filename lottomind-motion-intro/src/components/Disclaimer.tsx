import { interpolate, useCurrentFrame } from "remotion";

export const Disclaimer = ({ children }: { children: string }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [8, 24], [0, 0.82], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <div className="disclaimer" style={{ opacity }}>
      {children}
    </div>
  );
};

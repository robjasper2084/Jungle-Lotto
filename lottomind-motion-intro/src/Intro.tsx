import { AbsoluteFill, Sequence, useVideoConfig } from "remotion";
import { AudioDnaHelix } from "./components/AudioDnaHelix";
import { Disclaimer } from "./components/Disclaimer";
import { DjDeckRings } from "./components/DjDeckRings";
import { FeatureChips } from "./components/FeatureChips";
import { LogoOrb } from "./components/LogoOrb";
import { NeonBackground } from "./components/NeonBackground";
import { NumberOrbs } from "./components/NumberOrbs";
import { PadGridReveal } from "./components/PadGridReveal";
import { ParticleField } from "./components/ParticleField";
import { PianoRollFlash } from "./components/PianoRollFlash";
import { PresentationText } from "./components/PresentationText";
import { PromptCards } from "./components/PromptCards";
import { Scanline } from "./components/Scanline";
import { StemMixerReveal } from "./components/StemMixerReveal";
import { WaveformRibbon } from "./components/WaveformRibbon";

export type IntroVariant = "main" | "presentation" | "logo" | "vertical" | "transparent";

export type IntroProps = {
  variant: IntroVariant;
};

export const Intro = ({ variant }: IntroProps) => {
  const { width, height } = useVideoConfig();
  const vertical = variant === "vertical" || height > width;
  const transparent = variant === "transparent";

  if (variant === "logo" || variant === "transparent") {
    return (
      <AbsoluteFill className={`intro-root ${transparent ? "transparent-root" : ""}`}>
        {!transparent && <NeonBackground intensity={0.65} />}
        <ParticleField count={transparent ? 70 : 120} seed={44} />
        <Sequence from={0} durationInFrames={110}>
          <WaveformRibbon top={height * 0.52} opacity={0.8} />
          <LogoOrb compact={false} transparent={transparent} />
        </Sequence>
        <Sequence from={54} durationInFrames={96}>
          <PresentationText
            title="LottoMind Stem Studio"
            subtitle="Make Beats. Build Prompts. Generate Creative Signals."
            align="center"
          />
        </Sequence>
      </AbsoluteFill>
    );
  }

  if (variant === "presentation") {
    return (
      <AbsoluteFill className="intro-root">
        <NeonBackground intensity={0.82} />
        <ParticleField count={150} seed={12} />
        <Sequence from={0} durationInFrames={50}>
          <Scanline />
          <FeatureChips chips={["STEM STUDIO", "BEAT DNA", "DAW ENGINE", "PROMPT MODE"]} />
        </Sequence>
        <Sequence from={36} durationInFrames={78}>
          <AudioDnaHelix label="BEAT DNA ENGINE" subtitle="Rhythm | Stems | Pads | Motion" />
        </Sequence>
        <Sequence from={96} durationInFrames={74}>
          <StudioHardware vertical={false} />
          <PresentationText title="CREATE THE BEAT" subtitle="Stems | Pads | Decks | Piano Roll | Automation" align="left" />
        </Sequence>
        <Sequence from={164} durationInFrames={76}>
          <LogoOrb compact={false} />
          <PresentationText
            title="LottoMind Stem Studio"
            subtitle="Make Beats. Build Prompts. Generate Creative Signals."
            align="center"
          />
        </Sequence>
      </AbsoluteFill>
    );
  }

  if (vertical) {
    return (
      <AbsoluteFill className="intro-root vertical-root">
        <NeonBackground intensity={0.9} />
        <ParticleField count={160} seed={86} />
        <Sequence from={0} durationInFrames={60}>
          <Scanline vertical />
          <FeatureChips chips={["STEM STUDIO", "BEAT DNA", "SUNO PROMPT", "LOTTERY MODE"]} vertical />
        </Sequence>
        <Sequence from={42} durationInFrames={86}>
          <AudioDnaHelix label="BEAT DNA ENGINE" subtitle="Stems | Pads | Patterns | MIDI" vertical />
        </Sequence>
        <Sequence from={122} durationInFrames={86}>
          <StudioHardware vertical />
        </Sequence>
        <Sequence from={196} durationInFrames={74}>
          <OutputSplit vertical />
        </Sequence>
        <Sequence from={248} durationInFrames={52}>
          <LogoOrb compact />
          <PresentationText
            title="LottoMind Stem Studio"
            subtitle="Make Beats. Build Prompts. Generate Creative Signals."
            align="center"
            vertical
          />
        </Sequence>
      </AbsoluteFill>
    );
  }

  return (
    <AbsoluteFill className="intro-root">
      <NeonBackground intensity={1} />
      <ParticleField count={180} seed={24} />
      <Sequence from={0} durationInFrames={45}>
        <Scanline />
        <FeatureChips chips={["STEM STUDIO", "BEAT DNA", "DAW ENGINE", "PROMPT MODE", "LOTTERY MODE"]} />
      </Sequence>
      <Sequence from={45} durationInFrames={60}>
        <WaveformRibbon top={height * 0.48} opacity={0.9} />
        <AudioDnaHelix label="BEAT DNA ENGINE" subtitle="Rhythm | Stems | Pads | Patterns | Motion" />
      </Sequence>
      <Sequence from={105} durationInFrames={70}>
        <StudioHardware vertical={false} />
        <PresentationText title="CREATE THE BEAT" subtitle="Stems | Pads | Decks | Piano Roll | Automation" align="left" />
      </Sequence>
      <Sequence from={175} durationInFrames={80}>
        <OutputSplit vertical={false} />
        <PresentationText title="TURN MUSIC INTO IDEAS" subtitle="Prompts | Creative Signals | Presentation-ready motion" align="center" />
        <Disclaimer>Entertainment-only number generation</Disclaimer>
      </Sequence>
      <Sequence from={255} durationInFrames={75}>
        <LogoOrb compact={false} />
        <PresentationText
          title="LottoMind Stem Studio"
          subtitle="Make Beats. Build Prompts. Generate Creative Signals."
          align="center"
        />
      </Sequence>
      <Sequence from={330} durationInFrames={30}>
        <LogoOrb compact={false} hold />
      </Sequence>
    </AbsoluteFill>
  );
};

const StudioHardware = ({ vertical }: { vertical: boolean }) => (
  <div className={vertical ? "hardware-stack vertical" : "hardware-stack"}>
    <PadGridReveal />
    <StemMixerReveal />
    <DjDeckRings />
    <PianoRollFlash />
  </div>
);

const OutputSplit = ({ vertical = false }: { vertical?: boolean }) => (
  <div className={vertical ? "output-split vertical" : "output-split"}>
    <PromptCards />
    <AudioDnaHelix compact />
    <NumberOrbs />
  </div>
);

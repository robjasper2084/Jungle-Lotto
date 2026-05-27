# LottoMind Stem Studio Motion Intro

Standalone Remotion motion-graphic intro package for the **LottoMind Stem Studio** brand.

The package creates futuristic presentation-ready intro videos for product demos, YouTube videos, app walkthroughs, pitch decks, and social posts. All artwork is original code/SVG/CSS. No third-party logos, copyrighted assets, external paid APIs, backend calls, or bundled music are required.

## Compositions

- `MainIntro` - 1920x1080, 30fps, 12 seconds, 360 frames
- `PresentationIntro` - 1920x1080, 30fps, 8 seconds, 240 frames
- `LogoSting` - 1920x1080, 30fps, 5 seconds, 150 frames
- `FuturisticLogoSting` - 1920x1080, 30fps, 5 seconds, 150 frames, uploaded LM logo with circuit/waveform motion
- `VerticalSocialIntro` - 1080x1920, 30fps, 10 seconds, 300 frames
- `TransparentLogoSting` - 1920x1080, 30fps, 5 seconds, alpha-friendly design

## Install

```bash
npm install
```

## Preview

```bash
npm run dev
```

## Render

```bash
npm run render:main
npm run render:presentation
npm run render:logo
npm run render:futuristic-logo
npm run render:vertical
npm run render:transparent
```

## Type Check

```bash
npm run typecheck
```

## Optional Audio

No audio is bundled. If you own or have permission to use an intro sting, place it at:

```text
public/audio/intro-sting.wav
```

Then wire it into `src/Intro.tsx` with Remotion's `<Audio />` component. Keep any audio local and rights-cleared.

## Visual System

The intro uses a dark cyber-studio visual language with neon cyan, violet, magenta, gold, and electric green. Brand modules are introduced through code-native motion graphics:

- Stem Studio
- Beat DNA Engine
- Beat -> Suno Prompt
- Beat -> Lottery Numbers
- DAW Composer Suite
- Touch-reactive pads
- DJ decks
- Stem mixer
- Piano roll
- Pattern editor
- Automation
- MIDI

Lottery visuals are presented as audio-reactive number orbs and clearly framed as entertainment-only creative signals, not casino or gambling imagery.

## Asset Prompts

Optional ChatGPT Image 2 prompts live in:

```text
assets/prompts/chatgpt-image-2-motion-assets.md
```

Generated images should remain original to LottoMind Stem Studio and must not include third-party logos, copyrighted characters, or copied UI.

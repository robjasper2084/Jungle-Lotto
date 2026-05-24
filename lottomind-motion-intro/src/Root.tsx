import { Composition } from "remotion";
import { Intro } from "./Intro";
import "./styles.css";

export const RemotionRoot = () => (
  <>
    <Composition
      id="MainIntro"
      component={Intro}
      durationInFrames={360}
      fps={30}
      width={1920}
      height={1080}
      defaultProps={{ variant: "main" }}
    />
    <Composition
      id="PresentationIntro"
      component={Intro}
      durationInFrames={240}
      fps={30}
      width={1920}
      height={1080}
      defaultProps={{ variant: "presentation" }}
    />
    <Composition
      id="LogoSting"
      component={Intro}
      durationInFrames={150}
      fps={30}
      width={1920}
      height={1080}
      defaultProps={{ variant: "logo" }}
    />
    <Composition
      id="VerticalSocialIntro"
      component={Intro}
      durationInFrames={300}
      fps={30}
      width={1080}
      height={1920}
      defaultProps={{ variant: "vertical" }}
    />
    <Composition
      id="TransparentLogoSting"
      component={Intro}
      durationInFrames={150}
      fps={30}
      width={1920}
      height={1080}
      defaultProps={{ variant: "transparent" }}
    />
  </>
);

import { AbsoluteFill, Sequence } from "remotion";

import { Scene1Problem } from "./scenes/Scene1Problem";
import { Scene2Qr } from "./scenes/Scene2Qr";
import { Scene3Redline } from "./scenes/Scene3Redline";
import { Scene4Diff } from "./scenes/Scene4Diff";
import { Scene5Finale } from "./scenes/Scene5Finale";
import { COLORS, SCENES } from "./theme";

/**
 * Produktové video Eldock (45 s, 1920 × 1080, 30 fps): problém → sken QR štítku → červenka se
 * zákresem → Visual Diff a schválení → revize, PDF protokol a CTA eldock.cz. Scény se prolínají.
 */
export function EldockPromoVideo() {
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg }}>
      <Sequence from={SCENES.problem.from} durationInFrames={SCENES.problem.duration} name="1 · Problém a příchod Eldocku">
        <Scene1Problem />
      </Sequence>
      <Sequence from={SCENES.qr.from} durationInFrames={SCENES.qr.duration} name="2 · QR štítek a karta zařízení">
        <Scene2Qr />
      </Sequence>
      <Sequence from={SCENES.redline.from} durationInFrames={SCENES.redline.duration} name="3 · Červenka se zákresem">
        <Scene3Redline />
      </Sequence>
      <Sequence from={SCENES.diff.from} durationInFrames={SCENES.diff.duration} name="4 · Visual Diff">
        <Scene4Diff />
      </Sequence>
      <Sequence from={SCENES.finale.from} durationInFrames={SCENES.finale.duration} name="5 · Revize a CTA">
        <Scene5Finale />
      </Sequence>
    </AbsoluteFill>
  );
}

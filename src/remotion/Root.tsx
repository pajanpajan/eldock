import { Composition } from "remotion";

import { EldockPromoVideo } from "./EldockPromoVideo";
import { DURATION, FPS, HEIGHT, WIDTH } from "./theme";

/** Kompozice pro Remotion Studio a render (`npm run video:preview` / `npm run video:render`). */
export function RemotionRoot() {
  return <Composition id="EldockPromo" component={EldockPromoVideo} durationInFrames={DURATION} fps={FPS} width={WIDTH} height={HEIGHT} />;
}

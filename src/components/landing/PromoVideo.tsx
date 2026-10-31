"use client";

// Produktové video na úvodní stránce – Remotion kompozice přehrávaná přímo v prohlížeči
// (žádný MP4 soubor). Načítá se líně přes LazyPromoVideo, aby nezatěžovala první vykreslení.

import { Player } from "@remotion/player";

import { EldockPromoVideo } from "@/remotion/EldockPromoVideo";
import { DURATION, FPS, HEIGHT, WIDTH } from "@/remotion/theme";

export function PromoVideo() {
  return (
    <Player
      component={EldockPromoVideo}
      durationInFrames={DURATION}
      fps={FPS}
      compositionWidth={WIDTH}
      compositionHeight={HEIGHT}
      autoPlay
      loop
      initiallyMuted
      controls
      showVolumeControls
      allowFullscreen
      clickToPlay
      acknowledgeRemotionLicense
      style={{ width: "100%", aspectRatio: `${WIDTH} / ${HEIGHT}` }}
    />
  );
}

// Vygenerováno skriptem `npm run tutorials:generate` (scripts/generate-tutorials.mjs) – ručně neupravovat.
// Časy kapitol (s od začátku videa), délka, velikost a stopy MP4 v public/tutorials.

import type { TutorialId } from "./tutorials";

export interface TutorialMedia {
  id: TutorialId;
  durationSec: number;
  sizeBytes: number;
  width: number;
  height: number;
  video: string;
  audio: string;
  chapters: readonly number[];
  voice: string;
}

export const TUTORIAL_GENERATED_AT = "2026-11-12T05:23:09.760Z";

export const TUTORIAL_MEDIA: Partial<Record<TutorialId, TutorialMedia>> = {
  "pudorys": {
    "id": "pudorys",
    "durationSec": 103.1,
    "sizeBytes": 11766607,
    "width": 1920,
    "height": 1080,
    "video": "h264",
    "audio": "aac",
    "chapters": [
      0.2,
      21,
      40,
      66.4,
      84.3
    ],
    "voice": "Edge TTS cs-CZ-AntoninNeural"
  },
  "panel-builder": {
    "id": "panel-builder",
    "durationSec": 120.5,
    "sizeBytes": 13236746,
    "width": 1920,
    "height": 1080,
    "video": "h264",
    "audio": "aac",
    "chapters": [
      0.2,
      24.8,
      54.6,
      76.3,
      96.3
    ],
    "voice": "Edge TTS cs-CZ-AntoninNeural"
  }
};

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

export const TUTORIAL_GENERATED_AT = "2026-11-10T20:34:43.049Z";

export const TUTORIAL_MEDIA: Partial<Record<TutorialId, TutorialMedia>> = {
  "pudorys": {
    "id": "pudorys",
    "durationSec": 101.6,
    "sizeBytes": 11379010,
    "width": 1920,
    "height": 1080,
    "video": "h264",
    "audio": "aac",
    "chapters": [
      0.2,
      21.1,
      40,
      65.5,
      83.4
    ],
    "voice": "Edge TTS cs-CZ-AntoninNeural"
  },
  "panel-builder": {
    "id": "panel-builder",
    "durationSec": 103.6,
    "sizeBytes": 11090482,
    "width": 1920,
    "height": 1080,
    "video": "h264",
    "audio": "aac",
    "chapters": [
      0.2,
      20,
      42.4,
      59.6,
      81.9
    ],
    "voice": "Edge TTS cs-CZ-AntoninNeural"
  }
};

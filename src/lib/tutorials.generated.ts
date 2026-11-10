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

export const TUTORIAL_GENERATED_AT = "2026-11-10T19:01:49.093Z";

export const TUTORIAL_MEDIA: Partial<Record<TutorialId, TutorialMedia>> = {
  "pudorys": {
    "id": "pudorys",
    "durationSec": 101.2,
    "sizeBytes": 12486767,
    "width": 1920,
    "height": 1080,
    "video": "h264",
    "audio": "aac",
    "chapters": [
      0.2,
      20.9,
      39.7,
      65.5,
      83.3
    ],
    "voice": "Edge TTS cs-CZ-AntoninNeural"
  },
  "panel-builder": {
    "id": "panel-builder",
    "durationSec": 103.1,
    "sizeBytes": 10664096,
    "width": 1920,
    "height": 1080,
    "video": "h264",
    "audio": "aac",
    "chapters": [
      0.2,
      19.9,
      42.1,
      59.3,
      81.4
    ],
    "voice": "Edge TTS cs-CZ-AntoninNeural"
  }
};

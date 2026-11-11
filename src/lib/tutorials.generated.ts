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

export const TUTORIAL_GENERATED_AT = "2026-11-11T09:13:35.274Z";

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

"use client";

import { Howl } from "howler";

/** Served from `public/sounds/completion.mp3` — drop your own file there. */
export const COMPLETION_SOUND_SRC = "/sounds/completion.mp3";

let completionHowl: Howl | null = null;
let loadFailed = false;

function getCompletionHowl(): Howl | null {
  if (typeof window === "undefined") return null;
  if (loadFailed) return null;
  if (completionHowl) return completionHowl;

  completionHowl = new Howl({
    src: [COMPLETION_SOUND_SRC],
    volume: 0.55,
    preload: true,
    html5: true,
    onloaderror: () => {
      loadFailed = true;
      completionHowl = null;
    },
  });
  return completionHowl;
}

/**
 * Play a short completion cue after AI flows (research / extract / generate / find jobs).
 * Never throws — missing file or autoplay blocks are silent no-ops.
 */
export function playCompletionSound(): void {
  try {
    const sound = getCompletionHowl();
    if (!sound) return;
    sound.stop();
    sound.play();
  } catch {
    // Ignore autoplay / decode errors
  }
}

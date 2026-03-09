/**
 * Global playback manager: ensures only one audio clip plays at a time.
 * When a new clip requests play, the previously playing clip is stopped.
 */

type StopCallback = () => void;

let currentStop: StopCallback | null = null;
let currentId: string | null = null;

export function requestPlay(id: string, stopOthers: StopCallback): void {
  if (currentId !== null && currentId !== id && currentStop) {
    currentStop();
    currentStop = null;
    currentId = null;
  }
  currentId = id;
  currentStop = stopOthers;
}

export function release(id: string): void {
  if (currentId === id) {
    currentStop = null;
    currentId = null;
  }
}

export function getCurrentId(): string | null {
  return currentId;
}

"use client";

import { useAudioPlayer } from "../hooks/useAudioPlayer";

export interface AudioPlayerProps {
  /** Audio source URL (e.g. data URL or blob URL). */
  src: string;
  /** Unique id for this clip (used for global single-playback). */
  id: string;
  /** Optional label for accessibility. */
  "aria-label"?: string;
  /** Optional class for the root container. */
  className?: string;
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function AudioPlayer({ src, id, "aria-label": ariaLabel, className = "" }: AudioPlayerProps) {
  const {
    audioRef,
    playing,
    currentTime,
    duration,
    progress,
    play,
    pause,
    resume,
    stop,
    ready,
  } = useAudioPlayer(src, { id });

  const handlePlayPause = () => {
    if (playing) pause();
    else play();
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = audioRef.current;
    if (!el || duration <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const p = Math.max(0, Math.min(1, x / rect.width));
    el.currentTime = p * duration;
  };

  return (
    <div
      className={`flex flex-col gap-2 ${className}`}
      role="region"
      aria-label={ariaLabel ?? "Audio player"}
    >
      <audio ref={audioRef} src={src} preload="metadata" className="hidden" />

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={playing ? pause : play}
          disabled={!src}
          aria-label={playing ? "Pause" : "Play"}
          className="flex-shrink-0 w-10 h-10 rounded-full bg-sky-500 text-white flex items-center justify-center hover:bg-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {playing ? (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
            </svg>
          ) : (
            <svg className="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path d="M8 5v14l11-7L8 5z" />
            </svg>
          )}
        </button>

        <div
          className={`flex items-center gap-1 h-5 ${
            playing ? "opacity-100" : "opacity-50"
          } transition-opacity`}
          aria-hidden
        >
          {([2, 4, 3, 4, 2] as const).map((h, i) => (
            <span
              key={i}
              className={`w-1 rounded-full bg-sky-400 flex-shrink-0 ${
                playing ? "animate-pulse" : ""
              }`}
              style={{ height: `${h * 4}px`, animationDelay: `${i * 0.1}s` }}
            />
          ))}
        </div>

        <div className="flex-1 min-w-0 flex items-center gap-2">
          <span className="text-xs text-slate-400 tabular-nums flex-shrink-0 w-8">
            {formatTime(currentTime)}
          </span>
          <div
            className="flex-1 h-1.5 rounded-full bg-slate-700 cursor-pointer overflow-hidden group"
            onClick={handleSeek}
            role="progressbar"
            aria-valuenow={progress * 100}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Playback progress"
          >
            <div
              className="h-full rounded-full bg-sky-500 transition-all duration-75 ease-linear group-hover:bg-sky-400"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
          <span className="text-xs text-slate-400 tabular-nums flex-shrink-0 w-8">
            {formatTime(duration)}
          </span>
        </div>
      </div>
    </div>
  );
}

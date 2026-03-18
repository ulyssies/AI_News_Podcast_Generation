"use client";

import { useEffect } from "react";
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
  /** Tighter layout for dock / chrome UI */
  compact?: boolean;
  onPlayStateChange?: (playing: boolean) => void;
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function AudioPlayer({
  src,
  id,
  "aria-label": ariaLabel,
  className = "",
  compact = false,
  onPlayStateChange,
}: AudioPlayerProps) {
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

  useEffect(() => {
    onPlayStateChange?.(playing);
  }, [playing, onPlayStateChange]);

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
      className={`flex flex-col ${compact ? "gap-1" : "gap-2"} ${className}`}
      role="region"
      aria-label={ariaLabel ?? "Audio player"}
    >
      <audio ref={audioRef} src={src} preload="metadata" className="hidden" />

      <div className={`flex items-center ${compact ? "gap-2" : "gap-3"}`}>
        <button
          type="button"
          onClick={playing ? pause : play}
          disabled={!src}
          aria-label={playing ? "Pause" : "Play"}
          className={`flex-shrink-0 rounded-full bg-white text-zinc-900 flex items-center justify-center hover:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-300 focus:ring-offset-2 focus:ring-offset-black disabled:opacity-50 disabled:cursor-not-allowed transition-all ${
            compact ? "w-8 h-8" : "w-10 h-10"
          }`}
        >
          {playing ? (
            <svg
              className={compact ? "w-3.5 h-3.5" : "w-5 h-5"}
              fill="currentColor"
              viewBox="0 0 24 24"
              aria-hidden
            >
              <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
            </svg>
          ) : (
            <svg
              className={`${compact ? "w-3.5 h-3.5" : "w-5 h-5"} ml-0.5`}
              fill="currentColor"
              viewBox="0 0 24 24"
              aria-hidden
            >
              <path d="M8 5v14l11-7L8 5z" />
            </svg>
          )}
        </button>

        <div className="flex-1 min-w-0 flex items-center gap-1.5">
          <span
            className={`text-slate-400 tabular-nums flex-shrink-0 w-7 ${
              compact ? "text-[10px]" : "text-xs w-8"
            }`}
          >
            {formatTime(currentTime)}
          </span>
          <div
            className={`flex-1 rounded-full bg-slate-800 cursor-pointer overflow-hidden group ${
              compact ? "h-1" : "h-1.5"
            }`}
            onClick={handleSeek}
            role="progressbar"
            aria-valuenow={progress * 100}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Playback progress"
          >
            <div
              className="h-full rounded-full bg-white transition-all duration-75 ease-linear group-hover:bg-zinc-200"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
          <span
            className={`text-slate-400 tabular-nums flex-shrink-0 w-7 ${
              compact ? "text-[10px]" : "text-xs w-8"
            }`}
          >
            {formatTime(duration)}
          </span>
        </div>
      </div>
    </div>
  );
}

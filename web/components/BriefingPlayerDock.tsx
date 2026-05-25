"use client";

import { AudioPlayer } from "./AudioPlayer";

type BriefingPlayerDockProps = {
  visible: boolean;
  loading: boolean;
  expectingMoreAudio?: boolean;
  progress: number;
  episodeTitle: string;
  audioUrls: string[];
  estimatedDurationSeconds?: number;
  autoPlayWhenReady?: boolean;
  playerId: string;
  onPlayStateChange?: (playing: boolean) => void;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onAudioLevels?: (levels: number[]) => void;
  loadingMessage: string;
};

export function BriefingPlayerDock({
  visible,
  loading,
  expectingMoreAudio,
  progress,
  episodeTitle,
  audioUrls,
  estimatedDurationSeconds,
  autoPlayWhenReady,
  playerId,
  onPlayStateChange,
  onTimeUpdate,
  onAudioLevels,
  loadingMessage,
}: BriefingPlayerDockProps) {
  if (!visible) return null;
  const hasAudio = audioUrls.length > 0;
  const loadingProgress = Math.min(Math.max(progress, 0), 99);
  const loadingText = progress >= 99 ? "Almost ready…" : loadingMessage;

  return (
    <div
      id="briefing-player-dock"
      className="max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:z-[100] border-t border-white/10 bg-[#07070a]/92 backdrop-blur-xl shadow-[0_-18px_50px_rgba(0,0,0,0.55)]"
      style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
    >
      <div className="max-w-6xl mx-auto px-3 py-2 sm:py-2.5">
        {loading && !hasAudio ? (
          <div className="mx-auto flex w-full max-w-sm flex-col gap-1.5 py-1">
            <div className="flex items-center justify-between gap-4 text-[11px] text-slate-400 tabular-nums">
              <span className="truncate">{loadingText}</span>
              <span className="shrink-0">{loadingProgress}%</span>
            </div>
            <div
              className="h-1.5 overflow-hidden rounded-full bg-white/10 ring-1 ring-white/10"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={loadingProgress}
              aria-label={loadingText}
            >
              <div
                className="h-full rounded-full bg-[linear-gradient(90deg,#6366f1,#22d3ee)] transition-all duration-300 ease-out"
                style={{ width: `${loadingProgress}%` }}
              />
            </div>
          </div>
        ) : hasAudio ? (
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
            <div className="flex shrink-0 items-center justify-between gap-3 sm:block sm:max-w-[10rem]">
              <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wide truncate leading-tight">
                {episodeTitle}
              </p>
              {loading && (
                <p className="mt-0.5 flex items-center gap-1.5 text-[10px] text-slate-500 tabular-nums sm:mt-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#6366f1] animate-pulse" />
                  <span>{loadingProgress}%</span>
                </p>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <AudioPlayer
                key={playerId}
                sources={audioUrls}
                expectingMore={expectingMoreAudio ?? loading}
                estimatedDurationSeconds={estimatedDurationSeconds}
                autoPlayWhenReady={autoPlayWhenReady ?? loading}
                id={playerId}
                aria-label="Briefing playback"
                compact
                onPlayStateChange={onPlayStateChange}
                onTimeUpdate={onTimeUpdate}
                onAudioLevels={onAudioLevels}
                className="rounded-lg bg-[#111111] border border-[#222222] px-2 py-1.5"
              />
            </div>
          </div>
        ) : (
          <p className="text-center text-[11px] text-slate-500 py-1">No audio for this briefing.</p>
        )}
      </div>
    </div>
  );
}

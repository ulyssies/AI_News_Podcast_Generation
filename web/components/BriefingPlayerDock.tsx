"use client";

import { AudioPlayer } from "./AudioPlayer";

type BriefingPlayerDockProps = {
  visible: boolean;
  loading: boolean;
  progress: number;
  episodeTitle: string;
  audioUrl: string | null;
  playerId: string;
  onPlayStateChange?: (playing: boolean) => void;
};

export function BriefingPlayerDock({
  visible,
  loading,
  progress,
  episodeTitle,
  audioUrl,
  playerId,
  onPlayStateChange,
}: BriefingPlayerDockProps) {
  if (!visible) return null;

  return (
    <div
      id="briefing-player-dock"
      className="fixed inset-x-0 bottom-0 z-[100] border-t border-slate-800/90 bg-[#070709]/95 backdrop-blur-md shadow-[0_-12px_40px_rgba(0,0,0,0.45)] safe-area-pb"
      style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
    >
      <div className="max-w-6xl mx-auto px-3 py-2 sm:py-2.5">
        {loading && !audioUrl ? (
          <div className="flex items-center justify-center gap-2 py-1">
            <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-600 border-t-indigo-400" />
            <span className="text-[11px] text-slate-400 tabular-nums">
              Generating briefing… {progress}%
            </span>
          </div>
        ) : audioUrl ? (
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
            <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wide truncate sm:max-w-[10rem] shrink-0 leading-tight">
              {episodeTitle}
            </p>
            <div className="flex-1 min-w-0">
              <AudioPlayer
                key={audioUrl.slice(0, 72)}
                src={audioUrl}
                id={playerId}
                aria-label="Briefing playback"
                compact
                onPlayStateChange={onPlayStateChange}
                className="rounded-lg bg-slate-900/40 border border-slate-800/80 px-2 py-1.5"
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

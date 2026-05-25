"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { useAudioPlayer } from "../hooks/useAudioPlayer";

export interface AudioPlayerProps {
  /** Audio source URL (e.g. data URL or blob URL). */
  src?: string;
  /** Progressive audio sources; each entry is one playable TTS chunk. */
  sources?: string[];
  /** True while more progressive chunks may still arrive. */
  expectingMore?: boolean;
  /** Unique id for this clip (used for global single-playback). */
  id: string;
  /** Optional label for accessibility. */
  "aria-label"?: string;
  /** Optional class for the root container. */
  className?: string;
  /** Tighter layout for dock / chrome UI */
  compact?: boolean;
  onPlayStateChange?: (playing: boolean) => void;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onAudioLevels?: (levels: number[]) => void;
}

type WindowWithWebAudio = Window &
  typeof globalThis & {
    webkitAudioContext?: typeof AudioContext;
  };

const HERO_WAVEFORM_RESTING_LEVELS = [0.26, 0.5, 0.64, 0.36, 0.22, 0.19, 0.14];

function mapAudioLevels(data: Uint8Array<ArrayBuffer>, previous: number[]): number[] {
  const barCount = HERO_WAVEFORM_RESTING_LEVELS.length;
  const maxBin = Math.max(14, Math.floor(data.length * 0.42));

  return Array.from({ length: barCount }, (_, i) => {
    const start = Math.floor(Math.pow(i / barCount, 1.35) * maxBin);
    const end = Math.max(start + 1, Math.floor(Math.pow((i + 1) / barCount, 1.35) * maxBin));
    let total = 0;
    for (let bin = start; bin < end; bin += 1) total += data[bin] ?? 0;
    const average = total / (end - start);
    const signal = Math.pow(Math.min(1, average / 255), 0.62);
    const shaped = 0.14 + signal * 0.86;
    return previous[i] * 0.55 + shaped * 0.45;
  });
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function AudioPlayer({
  src,
  sources,
  expectingMore = false,
  id,
  "aria-label": ariaLabel,
  className = "",
  compact = false,
  onPlayStateChange,
  onTimeUpdate,
  onAudioLevels,
}: AudioPlayerProps) {
  const playlist = useMemo(
    () => (sources?.length ? sources : src ? [src] : []),
    [sources, src]
  );
  const [trackIndex, setTrackIndex] = useState(0);
  const resumeNextRef = useRef(false);
  const waitingForNextRef = useRef(false);
  const currentSrc = playlist[Math.min(trackIndex, Math.max(0, playlist.length - 1))] ?? "";

  useEffect(() => {
    setTrackIndex((prev) => {
      if (playlist.length === 0) return 0;
      return Math.min(prev, playlist.length - 1);
    });
  }, [playlist.length]);

  useEffect(() => {
    setTrackIndex(0);
    resumeNextRef.current = false;
    waitingForNextRef.current = false;
  }, [id]);

  const {
    audioRef,
    playing,
    currentTime,
    duration,
    progress,
    play,
    pause,
  } = useAudioPlayer(currentSrc, {
    id,
    onEnded: () => {
      if (trackIndex < playlist.length - 1) {
        resumeNextRef.current = true;
        setTrackIndex((idx) => idx + 1);
        return;
      }
      if (expectingMore) {
        waitingForNextRef.current = true;
      }
    },
  });
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const frequencyDataRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const levelFrameRef = useRef<number | null>(null);
  const lastLevelEmitRef = useRef(0);
  const levelsRef = useRef(HERO_WAVEFORM_RESTING_LEVELS);
  const onAudioLevelsRef = useRef(onAudioLevels);
  onAudioLevelsRef.current = onAudioLevels;

  const ensureAnalyser = () => {
    const el = audioRef.current;
    if (!el || typeof window === "undefined") return null;
    if (audioContextRef.current && analyserRef.current) {
      return { context: audioContextRef.current, analyser: analyserRef.current };
    }

    const AudioContextCtor =
      window.AudioContext ?? (window as WindowWithWebAudio).webkitAudioContext;
    if (!AudioContextCtor) return null;

    try {
      const context = new AudioContextCtor();
      const source = context.createMediaElementSource(el);
      const analyser = context.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.76;
      source.connect(analyser);
      analyser.connect(context.destination);

      audioContextRef.current = context;
      sourceRef.current = source;
      analyserRef.current = analyser;
      frequencyDataRef.current = new Uint8Array(analyser.frequencyBinCount);
      return { context, analyser };
    } catch {
      return null;
    }
  };

  useEffect(() => {
    onPlayStateChange?.(playing);
  }, [playing, onPlayStateChange]);

  // Use a ref so the effect only re-runs when time changes, not when parent re-renders.
  const onTimeUpdateRef = useRef(onTimeUpdate);
  onTimeUpdateRef.current = onTimeUpdate;
  useEffect(() => {
    onTimeUpdateRef.current?.(currentTime, duration);
  }, [currentTime, duration]);

  const handlePlayToggle = () => {
    if (playing) {
      pause();
      return;
    }
    const setup = ensureAnalyser();
    void setup?.context.resume();
    play();
  };

  useEffect(() => {
    if (!waitingForNextRef.current) return;
    if (trackIndex >= playlist.length - 1) return;
    waitingForNextRef.current = false;
    resumeNextRef.current = true;
    setTrackIndex((idx) => idx + 1);
  }, [playlist.length, trackIndex]);

  useEffect(() => {
    if (!resumeNextRef.current || !currentSrc) return;
    resumeNextRef.current = false;
    const setup = ensureAnalyser();
    void setup?.context.resume();
    window.setTimeout(() => play(), 0);
  }, [currentSrc, play]);

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = audioRef.current;
    if (!el || duration <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const p = Math.max(0, Math.min(1, x / rect.width));
    el.currentTime = p * duration;
  };

  useEffect(() => {
    if (levelFrameRef.current !== null) {
      cancelAnimationFrame(levelFrameRef.current);
      levelFrameRef.current = null;
    }

    if (!playing) {
      levelsRef.current = HERO_WAVEFORM_RESTING_LEVELS;
      onAudioLevelsRef.current?.(HERO_WAVEFORM_RESTING_LEVELS);
      return;
    }

    const setup = ensureAnalyser();
    const frequencyData = frequencyDataRef.current;
    if (!setup || !frequencyData) return;
    void setup.context.resume();

    const tick = (time: number) => {
      const analyser = analyserRef.current;
      const data = frequencyDataRef.current;
      if (!analyser || !data) return;

      if (time - lastLevelEmitRef.current >= 33) {
        analyser.getByteFrequencyData(data);
        levelsRef.current = mapAudioLevels(data, levelsRef.current);
        onAudioLevelsRef.current?.(levelsRef.current);
        lastLevelEmitRef.current = time;
      }

      levelFrameRef.current = requestAnimationFrame(tick);
    };

    levelFrameRef.current = requestAnimationFrame(tick);

    return () => {
      if (levelFrameRef.current !== null) {
        cancelAnimationFrame(levelFrameRef.current);
        levelFrameRef.current = null;
      }
    };
  }, [playing]);

  useEffect(
    () => () => {
      if (levelFrameRef.current !== null) cancelAnimationFrame(levelFrameRef.current);
      sourceRef.current?.disconnect();
      analyserRef.current?.disconnect();
      void audioContextRef.current?.close();
    },
    []
  );

  return (
    <div
      className={`flex flex-col ${compact ? "gap-1" : "gap-2"} ${className}`}
      role="region"
      aria-label={ariaLabel ?? "Audio player"}
    >
      <audio ref={audioRef} src={currentSrc} preload="metadata" className="hidden" />

      <div className={`flex items-center ${compact ? "gap-2" : "gap-3"}`}>
        <button
          type="button"
          onClick={handlePlayToggle}
          disabled={!currentSrc}
          aria-label={playing ? "Pause" : "Play"}
          className={`flex-shrink-0 rounded-full bg-[#6366f1] text-white flex items-center justify-center shadow-[0_0_20px_rgba(99,102,241,0.20)] hover:bg-[#7477ff] focus:outline-none focus:ring-2 focus:ring-[#6366f1] focus:ring-offset-2 focus:ring-offset-black disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150 ${
            compact ? "w-9 h-9" : "w-11 h-11"
          }`}
        >
          {playing ? (
            <Pause className={compact ? "h-3.5 w-3.5" : "h-5 w-5"} fill="currentColor" aria-hidden />
          ) : (
            <Play className={`${compact ? "h-3.5 w-3.5" : "h-5 w-5"} ml-0.5`} fill="currentColor" aria-hidden />
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
            className={`flex-1 rounded-full bg-[#222222] cursor-pointer overflow-hidden group ${
              compact ? "h-1.5" : "h-2"
            }`}
            onClick={handleSeek}
            role="progressbar"
            aria-valuenow={progress * 100}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Playback progress"
          >
            <div
              className="h-full rounded-full bg-[#6366f1] transition-all duration-75 ease-linear group-hover:bg-[#7c7ff5]"
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

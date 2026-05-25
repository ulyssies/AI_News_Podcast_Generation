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
  /** Estimated whole-episode duration used until every streamed chunk reports metadata. */
  estimatedDurationSeconds?: number;
  /** Try to start playback as soon as the first source is available. */
  autoPlayWhenReady?: boolean;
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
  estimatedDurationSeconds,
  autoPlayWhenReady = false,
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
  const [chunkDurations, setChunkDurations] = useState<number[]>([]);
  const resumeNextRef = useRef(false);
  const waitingForNextRef = useRef(false);
  const pendingSeekRef = useRef<number | null>(null);
  const autoPlayAttemptedRef = useRef(false);
  const manuallyPausedRef = useRef(false);
  const currentSrc = playlist[Math.min(trackIndex, Math.max(0, playlist.length - 1))] ?? "";

  useEffect(() => {
    setTrackIndex((prev) => {
      if (playlist.length === 0) return 0;
      return Math.min(prev, playlist.length - 1);
    });
  }, [playlist.length]);

  useEffect(() => {
    setTrackIndex(0);
    setChunkDurations([]);
    resumeNextRef.current = false;
    waitingForNextRef.current = false;
    pendingSeekRef.current = null;
    autoPlayAttemptedRef.current = false;
    manuallyPausedRef.current = false;
  }, [id]);

  useEffect(() => {
    if (!manuallyPausedRef.current) {
      autoPlayAttemptedRef.current = false;
    }
  }, [currentSrc]);

  const {
    audioRef,
    playing,
    currentTime,
    duration,
    play,
    pause,
    ready,
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

  const resetAnalyser = () => {
    sourceRef.current?.disconnect();
    analyserRef.current?.disconnect();
    sourceRef.current = null;
    analyserRef.current = null;
    frequencyDataRef.current = null;
    audioContextRef.current = null;
  };

  const ensureAnalyser = () => {
    const el = audioRef.current;
    if (!el || typeof window === "undefined") return null;
    if (audioContextRef.current?.state === "closed") {
      resetAnalyser();
    }
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
      resetAnalyser();
      return null;
    }
  };

  const resumeAnalyser = () => {
    const setup = ensureAnalyser();
    if (!setup || setup.context.state === "closed") return;
    setup.context.resume().catch(() => {
      resetAnalyser();
    });
  };

  useEffect(() => {
    onPlayStateChange?.(playing);
  }, [playing, onPlayStateChange]);

  // Use a ref so the effect only re-runs when time changes, not when parent re-renders.
  const onTimeUpdateRef = useRef(onTimeUpdate);
  onTimeUpdateRef.current = onTimeUpdate;

  useEffect(() => {
    setChunkDurations((prev) => {
      if (playlist.length === 0) return [];
      const next = Array.from({ length: playlist.length }, (_, i) => prev[i] ?? 0);
      if (duration > 0 && Number.isFinite(duration)) {
        next[trackIndex] = duration;
      }
      return next;
    });
  }, [duration, playlist.length, trackIndex]);

  useEffect(() => {
    if (playlist.length === 0) {
      setChunkDurations([]);
      return;
    }

    let cancelled = false;
    const pendingAudios: HTMLAudioElement[] = [];

    playlist.forEach((source, index) => {
      if (!source || chunkDurations[index] > 0) return;
      const probe = new Audio();
      pendingAudios.push(probe);
      probe.preload = "metadata";
      probe.src = source;

      const recordDuration = () => {
        if (cancelled) return;
        const nextDuration = probe.duration;
        if (!Number.isFinite(nextDuration) || nextDuration <= 0) return;
        setChunkDurations((prev) => {
          const next = Array.from({ length: playlist.length }, (_, i) => prev[i] ?? 0);
          next[index] = nextDuration;
          return next;
        });
      };

      probe.addEventListener("loadedmetadata", recordDuration, { once: true });
      probe.addEventListener("durationchange", recordDuration, { once: true });
      probe.load();
    });

    return () => {
      cancelled = true;
      pendingAudios.forEach((probe) => {
        probe.removeAttribute("src");
        probe.load();
      });
    };
  }, [chunkDurations, playlist]);

  const knownDurations = useMemo(
    () =>
      playlist.map((_, i) => {
        if (i === trackIndex && duration > 0 && Number.isFinite(duration)) return duration;
        const measured = chunkDurations[i] ?? 0;
        return Number.isFinite(measured) && measured > 0 ? measured : 0;
      }),
    [chunkDurations, duration, playlist, trackIndex]
  );
  const elapsedBeforeTrack = knownDurations
    .slice(0, trackIndex)
    .reduce((sum, next) => sum + next, 0);
  const loadedDuration = knownDurations.reduce((sum, next) => sum + next, 0);
  const episodeCurrentTime = Math.min(
    Math.max(0, elapsedBeforeTrack + currentTime),
    Math.max(loadedDuration, elapsedBeforeTrack + currentTime)
  );
  const measuredAllChunks =
    playlist.length > 0 && knownDurations.every((chunkDuration) => chunkDuration > 0);
  const estimatedTotal =
    estimatedDurationSeconds && Number.isFinite(estimatedDurationSeconds)
      ? estimatedDurationSeconds
      : 0;
  const episodeDuration =
    expectingMore || !measuredAllChunks
      ? Math.max(estimatedTotal, loadedDuration, episodeCurrentTime)
      : Math.max(loadedDuration, episodeCurrentTime);
  const episodeProgress =
    episodeDuration > 0 ? Math.min(1, episodeCurrentTime / episodeDuration) : 0;
  const bufferedProgress =
    episodeDuration > 0 ? Math.min(1, loadedDuration / episodeDuration) : 0;

  useEffect(() => {
    onTimeUpdateRef.current?.(episodeCurrentTime, episodeDuration);
  }, [episodeCurrentTime, episodeDuration]);

  const handlePlayToggle = () => {
    if (playing) {
      manuallyPausedRef.current = true;
      pause();
      return;
    }
    manuallyPausedRef.current = false;
    play();
  };

  useEffect(() => {
    if (!autoPlayWhenReady || !currentSrc || playing) return;
    if (autoPlayAttemptedRef.current || manuallyPausedRef.current) return;
    autoPlayAttemptedRef.current = true;
    window.setTimeout(() => play(), 0);
  }, [autoPlayWhenReady, currentSrc, play, playing]);

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
    window.setTimeout(() => play(), 0);
  }, [currentSrc, play]);

  useEffect(() => {
    const pendingSeek = pendingSeekRef.current;
    const el = audioRef.current;
    if (pendingSeek === null || !el) return;

    const applySeek = () => {
      const trackDuration = Number.isFinite(el.duration) && el.duration > 0 ? el.duration : pendingSeek;
      el.currentTime = Math.max(0, Math.min(pendingSeek, Math.max(0, trackDuration - 0.05)));
      pendingSeekRef.current = null;
    };

    if (ready || el.readyState >= 1) {
      applySeek();
      return;
    }

    el.addEventListener("loadedmetadata", applySeek, { once: true });
    return () => el.removeEventListener("loadedmetadata", applySeek);
  }, [currentSrc, ready]);

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = audioRef.current;
    if (!el || episodeDuration <= 0 || loadedDuration <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const p = Math.max(0, Math.min(1, x / rect.width));
    const requestedEpisodeTime = p * episodeDuration;
    const targetEpisodeTime = Math.min(requestedEpisodeTime, Math.max(0, loadedDuration - 0.05));

    let elapsed = 0;
    let nextTrackIndex = 0;
    let nextTrackOffset = 0;
    for (let i = 0; i < knownDurations.length; i += 1) {
      const chunkDuration = knownDurations[i] || 0;
      const nextElapsed = elapsed + chunkDuration;
      if (targetEpisodeTime <= nextElapsed || i === knownDurations.length - 1) {
        nextTrackIndex = i;
        nextTrackOffset = Math.max(0, targetEpisodeTime - elapsed);
        break;
      }
      elapsed = nextElapsed;
    }

    pendingSeekRef.current = nextTrackOffset;
    if (nextTrackIndex === trackIndex) {
      const trackDuration = knownDurations[trackIndex] || duration || nextTrackOffset;
      el.currentTime = Math.max(0, Math.min(nextTrackOffset, Math.max(0, trackDuration - 0.05)));
      pendingSeekRef.current = null;
    } else {
      setTrackIndex(nextTrackIndex);
    }
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
    resumeAnalyser();

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
      void audioContextRef.current?.close();
      resetAnalyser();
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
            {formatTime(episodeCurrentTime)}
          </span>
          <div
            className={`relative flex-1 rounded-full bg-[#222222] cursor-pointer overflow-hidden group ${
              compact ? "h-1.5" : "h-2"
            }`}
            onClick={handleSeek}
            role="progressbar"
            aria-valuenow={episodeProgress * 100}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Playback progress"
          >
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-white/10 transition-all duration-300 ease-out"
              style={{ width: `${bufferedProgress * 100}%` }}
            />
            <div
              className="relative h-full rounded-full bg-[#6366f1] transition-all duration-75 ease-linear group-hover:bg-[#7c7ff5]"
              style={{ width: `${episodeProgress * 100}%` }}
            />
          </div>
          <span
            className={`text-slate-400 tabular-nums flex-shrink-0 w-7 ${
              compact ? "text-[10px]" : "text-xs w-8"
            }`}
          >
            {formatTime(episodeDuration)}
          </span>
        </div>
      </div>
    </div>
  );
}

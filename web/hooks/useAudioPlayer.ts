"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { requestPlay, release } from "../lib/playbackManager";

export interface UseAudioPlayerOptions {
  /** Unique id for this clip (for global single-playback). */
  id: string;
  /** Called when this clip is stopped because another clip started. */
  onStoppedByAnother?: () => void;
}

export interface UseAudioPlayerReturn {
  /** Ref to attach to <audio>. */
  audioRef: React.RefObject<HTMLAudioElement | null>;
  /** Whether audio is currently playing. */
  playing: boolean;
  /** Current playback time in seconds. */
  currentTime: number;
  /** Total duration in seconds (0 until loaded). */
  duration: number;
  /** Progress 0..1 for progress bar. */
  progress: number;
  /** Start playback (stops any other playing clip). */
  play: () => void;
  /** Pause playback. */
  pause: () => void;
  /** Resume after pause. */
  resume: () => void;
  /** Stop and reset to start. */
  stop: () => void;
  /** Whether the source is loaded enough to play. */
  ready: boolean;
}

export function useAudioPlayer(
  src: string | undefined,
  options: UseAudioPlayerOptions
): UseAudioPlayerReturn {
  const { id, onStoppedByAnother } = options;
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [ready, setReady] = useState(false);
  const onStoppedRef = useRef(onStoppedByAnother);
  onStoppedRef.current = onStoppedByAnother;

  const stop = useCallback(() => {
    const el = audioRef.current;
    if (el) {
      el.pause();
      el.currentTime = 0;
    }
    setPlaying(false);
    setCurrentTime(0);
    release(id);
  }, [id]);

  const pause = useCallback(() => {
    audioRef.current?.pause();
    setPlaying(false);
  }, []);

  const resume = useCallback(() => {
    audioRef.current?.play();
    setPlaying(true);
  }, []);

  const play = useCallback(() => {
    if (!src) return;
    const el = audioRef.current;
    if (!el) return;

    const stopOthers = () => {
      el.pause();
      el.currentTime = 0;
      setPlaying(false);
      setCurrentTime(0);
      release(id);
      onStoppedRef.current?.();
    };

    requestPlay(id, stopOthers);
    el.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
  }, [id, src]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el || !src) return;

    const onTimeUpdate = () => setCurrentTime(el.currentTime);
    const onLoadedMetadata = () => {
      setDuration(el.duration);
      setReady(true);
    };
    const onDurationChange = () => setDuration(el.duration);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnded = () => {
      setPlaying(false);
      setCurrentTime(0);
      release(id);
    };

    el.addEventListener("timeupdate", onTimeUpdate);
    el.addEventListener("loadedmetadata", onLoadedMetadata);
    el.addEventListener("durationchange", onDurationChange);
    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);
    el.addEventListener("ended", onEnded);

    return () => {
      el.removeEventListener("timeupdate", onTimeUpdate);
      el.removeEventListener("loadedmetadata", onLoadedMetadata);
      el.removeEventListener("durationchange", onDurationChange);
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
      el.removeEventListener("ended", onEnded);
      release(id);
    };
  }, [id, src]);

  const progress = duration > 0 ? Math.min(1, currentTime / duration) : 0;

  return {
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
  };
}

"use client";

import { useEffect, useMemo, useRef } from "react";

type TranscriptHighlightProps = {
  transcript: string;
  currentTime: number;
  duration: number;
};

/**
 * Build a cumulative weight array for each word.
 * Weights are based on character length so longer words get proportionally
 * more time, plus extra weight for punctuation pauses.
 */
function buildCumulativeWeights(words: string[]): number[] {
  const result: number[] = [];
  let sum = 0;
  for (const word of words) {
    sum += word.length + 1; // +1 for the trailing space
    if (/[.!?]$/.test(word)) sum += 4; // sentence pause
    else if (/[,;:]$/.test(word)) sum += 1; // clause pause
    result.push(sum);
  }
  return result;
}

export function TranscriptHighlight({
  transcript,
  currentTime,
  duration,
}: TranscriptHighlightProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLSpanElement>(null);

  const words = useMemo(() => transcript.trim().split(/\s+/), [transcript]);
  const cumulative = useMemo(() => buildCumulativeWeights(words), [words]);
  const totalWeight = cumulative[cumulative.length - 1] ?? 0;

  const isPlaying = duration > 0 && currentTime > 0;
  const progress = duration > 0 ? Math.min(1, currentTime / duration) : 0;

  let activeWordIndex = -1;
  if (isPlaying && totalWeight > 0) {
    const targetWeight = progress * totalWeight;
    // Find the first word whose cumulative weight meets or exceeds our target
    activeWordIndex = cumulative.findIndex((w) => w >= targetWeight);
    if (activeWordIndex === -1) activeWordIndex = words.length - 1;
  }

  // Scroll the active word into the upper-third of the container
  useEffect(() => {
    if (!activeRef.current || !containerRef.current || activeWordIndex < 0) return;
    const container = containerRef.current;
    const active = activeRef.current;
    const containerRect = container.getBoundingClientRect();
    const activeRect = active.getBoundingClientRect();
    const relativeTop = activeRect.top - containerRect.top + container.scrollTop;
    const targetScroll = relativeTop - container.clientHeight / 3;
    container.scrollTo({ top: Math.max(0, targetScroll), behavior: "smooth" });
  }, [activeWordIndex]);

  return (
    <div
      ref={containerRef}
      className="overflow-y-auto h-48 sm:h-56 scroll-smooth px-1"
      style={{ scrollbarWidth: "none" }}
    >
      <p className="text-[11px] sm:text-xs leading-relaxed text-left">
        {words.map((word, i) => {
          const isPast = i < activeWordIndex;
          const isActive = i === activeWordIndex;

          return (
            <span
              key={i}
              ref={isActive ? activeRef : undefined}
              className={
                isPast
                  ? "text-white transition-colors duration-100"
                  : isActive
                  ? "text-white transition-colors duration-100"
                  : "text-slate-600 transition-colors duration-100"
              }
              style={
                isActive
                  ? {
                      background: "rgba(255,255,255,0.1)",
                      borderRadius: "4px",
                      padding: "1px 3px",
                      margin: "0 -1px",
                    }
                  : undefined
              }
            >
              {word}
              {i < words.length - 1 ? " " : ""}
            </span>
          );
        })}
      </p>
    </div>
  );
}

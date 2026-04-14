"use client";

import { useEffect, useState } from "react";
import { Github, X } from "lucide-react";

type InfoModalProps = {
  open: boolean;
  onClose: () => void;
};

export function InfoModal({ open, onClose }: InfoModalProps) {
  const [rendered, setRendered] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (open) {
      setRendered(true);
      const raf = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(raf);
    } else {
      setVisible(false);
      const timer = setTimeout(() => setRendered(false), 200);
      return () => clearTimeout(timer);
    }
  }, [open]);

  if (!rendered) return null;

  return (
    <div
      className={`fixed inset-0 z-[200] flex items-center justify-center p-4 transition-opacity duration-200 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
      style={{ backgroundColor: "rgba(0,0,0,0.72)" }}
      onClick={onClose}
    >
      <div
        className={`relative w-full max-w-lg bg-[#111111] border border-[#222222] rounded-xl p-6 transition-all duration-200 ${
          visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 text-[#555555] hover:text-[#f5f5f5] transition-colors duration-150"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Header */}
        <div className="mb-5 pr-6">
          <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-[#555555] leading-none mb-2">
            Curated Daily Audio
          </p>
          <h2 className="font-display font-bold text-xl sm:text-2xl text-[#f5f5f5] tracking-tight leading-tight">
            AI-powered audio news,<br />on demand.
          </h2>
        </div>

        <div className="h-px bg-[#222222] mb-5" />

        {/* What it is */}
        <div className="mb-5">
          <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-[#555555] mb-2.5">
            What it is
          </p>
          <p className="text-[13px] text-[#888888] leading-relaxed">
            Curated Daily Audio generates broadcast-quality news briefings on demand — no
            pre-recorded content, no editorial agenda. Pick a topic or get the full daily picture
            across 8 categories. Every episode is freshly scripted by Claude and read aloud via
            OpenAI TTS, streamed directly to your browser.
          </p>
        </div>

        {/* How it works */}
        <div className="mb-6">
          <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-[#555555] mb-2.5">
            How it works
          </p>
          <ul className="space-y-2.5">
            {[
              "Fetches live articles from NewsAPI and Google News RSS across 8 curated categories",
              "Claude reads the articles and writes a broadcast-style script — neutral, factual, no fluff",
              "OpenAI TTS converts the script to audio in parallel chunks for speed",
              "The episode streams to a sticky player with a live transcript and source links",
            ].map((item, i) => (
              <li key={i} className="flex items-start gap-2.5 text-[12px] text-[#888888] leading-snug">
                <span className="mt-[5px] h-1 w-1 flex-shrink-0 rounded-full bg-[#6366f1]" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* GitHub */}
        <a
          href="https://github.com/ulyssies/AI_News_Podcast_Generation"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 border border-[#222222] text-[#888888] hover:text-[#f5f5f5] hover:border-[#333333] rounded-lg px-4 py-2.5 text-[12px] font-medium transition-colors duration-150"
        >
          <Github className="h-3.5 w-3.5" />
          View on GitHub
        </a>
      </div>
    </div>
  );
}

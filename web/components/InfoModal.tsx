"use client";

import { useEffect, useState } from "react";
import { BrainCircuit, Github, Link2, Newspaper, Radio, ShieldCheck, Sparkles, X, Zap } from "lucide-react";

type InfoModalProps = {
  open: boolean;
  onClose: () => void;
};

const pipelineSteps = [
  {
    label: "01",
    title: "Gather",
    description: "Pulls fresh stories from NewsAPI and Google News RSS across curated beats.",
    icon: Newspaper,
  },
  {
    label: "02",
    title: "Write",
    description: "Claude turns source material into a tight, neutral briefing script.",
    icon: BrainCircuit,
  },
  {
    label: "03",
    title: "Speak",
    description: "OpenAI TTS creates sentence-safe audio chunks as the script forms.",
    icon: Radio,
  },
  {
    label: "04",
    title: "Stream",
    description: "Playback starts from the first chunk while later chunks keep loading in order.",
    icon: Zap,
  },
];

const trustNotes = [
  { label: "Source-linked", icon: Link2 },
  { label: "No filler intros", icon: Sparkles },
  { label: "Neutral by design", icon: ShieldCheck },
];

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
        className={`relative w-full max-w-2xl overflow-hidden rounded-2xl border border-white/10 bg-[#0d0d11] shadow-[0_24px_80px_rgba(0,0,0,0.55)] transition-all duration-200 ${
          visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-90"
          aria-hidden
          style={{
            background:
              "radial-gradient(circle at 18% 8%, rgba(99,102,241,0.22), transparent 34%), radial-gradient(circle at 88% 16%, rgba(34,211,238,0.10), transparent 30%), linear-gradient(180deg, rgba(255,255,255,0.04), transparent 38%)",
          }}
        />

        {/* Close */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 z-10 rounded-full border border-white/10 bg-black/20 p-2 text-slate-500 transition-colors duration-150 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="relative p-5 sm:p-7">
          {/* Header */}
          <div className="mb-6 max-w-xl pr-10">
            <p className="mb-2 text-[9px] font-semibold uppercase leading-none tracking-[0.26em] text-slate-500">
              How it works
            </p>
            <h2 className="font-display text-2xl font-bold leading-[0.98] tracking-tight text-white sm:text-3xl">
              A news briefing built while you listen.
            </h2>
            <p className="mt-3 max-w-lg text-[13px] leading-relaxed text-slate-400">
              Curated Daily Audio fetches current reporting, writes a grounded script, and streams
              ordered TTS chunks into the player instead of waiting on one finished file.
            </p>
          </div>

          {/* Pipeline */}
          <div className="grid gap-2.5 sm:grid-cols-4">
            {pipelineSteps.map((step) => {
              const Icon = step.icon;
              return (
                <div
                  key={step.label}
                  className="relative min-h-[8.5rem] overflow-hidden rounded-xl border border-white/10 bg-white/[0.045] p-3.5"
                >
                  <div className="mb-5 flex items-center justify-between gap-3">
                    <span className="text-[10px] font-semibold tabular-nums text-slate-500">
                      {step.label}
                    </span>
                    <Icon className="h-4 w-4 text-[#8da2ff]" aria-hidden />
                  </div>
                  <h3 className="font-display text-lg font-bold leading-none text-white">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-[11px] leading-snug text-slate-400">
                    {step.description}
                  </p>
                  <div
                    className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-[linear-gradient(90deg,#6366f1,#22d3ee,transparent)]"
                    aria-hidden
                  />
                </div>
              );
            })}
          </div>

          {/* Notes */}
          <div className="mt-4 grid gap-2.5 sm:grid-cols-[1fr_auto] sm:items-center">
            <div className="flex flex-wrap gap-2">
              {trustNotes.map((note) => {
                const Icon = note.icon;
                return (
                  <div
                    key={note.label}
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-2 text-[11px] font-medium text-slate-300"
                  >
                    <Icon className="h-3.5 w-3.5 text-[#7dd3fc]" aria-hidden />
                    {note.label}
                  </div>
                );
              })}
            </div>

            <a
              href="https://github.com/ulyssies/AI_News_Podcast_Generation"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-4 py-2.5 text-[12px] font-medium text-slate-300 transition-colors duration-150 hover:border-white/20 hover:text-white"
            >
              <Github className="h-3.5 w-3.5" />
              View on GitHub
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

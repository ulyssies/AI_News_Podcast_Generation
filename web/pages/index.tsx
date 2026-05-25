import Head from "next/head";
import { useCallback, useEffect, useState } from "react";
import { Info } from "lucide-react";
import { BriefingPlayerDock } from "../components/BriefingPlayerDock";
import { CategoryBriefingGrid } from "../components/CategoryBriefingGrid";
import { DailyBriefingHero } from "../components/DailyBriefingHero";
import { HeroGlobeBroadcast } from "../components/HeroGlobeBroadcast";
import { InfoModal } from "../components/InfoModal";
import { TranscriptHighlight } from "../components/TranscriptHighlight";

type GenerateResponse = {
  audio_url: string;
  transcript: string;
  sources: { title: string; url: string; publisher?: string | null }[];
};

type BriefingMode = "full_daily" | "category";
type AudioChunk = {
  index: number;
  audio_url: string;
};

const FETCH_TIMEOUT_MS = 10 * 60 * 1000;
const RESTING_AUDIO_LEVELS = [0.26, 0.5, 0.64, 0.36, 0.22, 0.19, 0.14];

export default function Home() {
  const [fullLength, setFullLength] = useState<"short" | "medium" | "long">("medium");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState("Preparing briefing...");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GenerateResponse | null>(null);
  const [episodeTitle, setEpisodeTitle] = useState("Your briefing");
  const [loadingCategory, setLoadingCategory] = useState<string | null>(null);
  const [playerInstanceKey, setPlayerInstanceKey] = useState(0);
  const [briefingAudioPlaying, setBriefingAudioPlaying] = useState(false);
  const [heroAudioLevels, setHeroAudioLevels] = useState(RESTING_AUDIO_LEVELS);
  const [audioTime, setAudioTime] = useState({ currentTime: 0, duration: 0 });
  const [modalOpen, setModalOpen] = useState(false);
  const [displayProgress, setDisplayProgress] = useState(0);
  const [audioChunks, setAudioChunks] = useState<AudioChunk[]>([]);

  // Show modal on first visit; never again once dismissed via localStorage.
  useEffect(() => {
    if (!localStorage.getItem("cda_seen_intro")) {
      setModalOpen(true);
    }
  }, []);

  const handleModalClose = useCallback(() => {
    localStorage.setItem("cda_seen_intro", "1");
    setModalOpen(false);
  }, []);

  useEffect(() => {
    if (!result?.audio_url && audioChunks.length === 0) {
      setBriefingAudioPlaying(false);
      setHeroAudioLevels(RESTING_AUDIO_LEVELS);
      setAudioTime({ currentTime: 0, duration: 0 });
    }
  }, [result?.audio_url, audioChunks.length]);

  useEffect(() => {
    if (loadingCategory) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [loadingCategory]);

  // Smooth animated progress: eases toward real milestones, creeps slowly between them.
  useEffect(() => {
    if (!loading) {
      setDisplayProgress(progress === 100 ? 100 : 0);
      return;
    }
    const targetProgress = Math.min(progress, 99);
    const id = setInterval(() => {
      setDisplayProgress((prev) => {
        if (prev < targetProgress) {
          return Math.min(
            targetProgress,
            prev + Math.max(1, (targetProgress - prev) * 0.18)
          );
        }
        return prev < 93 ? Math.min(93, prev + 0.14) : Math.min(prev, 99);
      });
    }, 200);
    return () => clearInterval(id);
  }, [loading, progress]);

  const handleTimeUpdate = useCallback((currentTime: number, duration: number) => {
    setAudioTime({ currentTime, duration });
  }, []);

  const runGenerate = useCallback(
    async (mode: BriefingMode, opts: { categoryKey?: string; length: string; title: string }) => {
      setLoading(true);
      setProgress(0);
      setDisplayProgress(0);
      setLoadingMessage("Preparing briefing...");
      setError(null);
      setResult(null);
      setAudioChunks([]);
      setAudioTime({ currentTime: 0, duration: 0 });
      setEpisodeTitle(opts.title);
      setLoadingCategory(mode === "category" ? opts.categoryKey ?? null : null);
      setPlayerInstanceKey((k) => k + 1);

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
        const apiBase =
          typeof window !== "undefined"
            ? process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
            : "";
        const url = apiBase ? `${apiBase}/generate/stream` : "/api/generate/stream";
        const body =
          mode === "full_daily"
            ? { briefing_mode: "full_daily", length: opts.length }
            : {
                briefing_mode: "category",
                category: opts.categoryKey,
                length: opts.length,
              };

        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (!res.ok) {
          const text = await res.text();
          let msg = `Request failed with status ${res.status}`;
          try {
            const errBody = JSON.parse(text) as { detail?: string };
            if (errBody?.detail) msg = errBody.detail;
          } catch {
            if (text) msg = text.slice(0, 300);
          }
          throw new Error(msg);
        }

        const reader = res.body?.getReader();
        if (!reader) throw new Error("No response body");
        const decoder = new TextDecoder();
        let buffer = "";
        let gotResult = false;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            try {
              const data = JSON.parse(line.slice(6)) as {
                percent?: number;
                message?: string;
                result?: GenerateResponse;
                audio_chunk?: AudioChunk;
                error?: string;
              };
              if (data.error) {
                setError(data.error);
                setLoading(false);
                setLoadingCategory(null);
                return;
              }
              if (typeof data.percent === "number") setProgress(data.percent);
              if (data.message) setLoadingMessage(data.message);
              if (data.audio_chunk?.audio_url) {
                setAudioChunks((prev) => {
                  const next = prev.filter((chunk) => chunk.index !== data.audio_chunk!.index);
                  next.push(data.audio_chunk!);
                  return next.sort((a, b) => a.index - b.index);
                });
                if (data.message) setLoadingMessage(data.message);
              }
              if (data.result) {
                setResult(data.result);
                setProgress(100);
                setLoadingMessage("Ready");
                gotResult = true;
                break;
              }
            } catch {
              // ignore malformed SSE lines
            }
          }
          if (gotResult) break;
        }
      } catch (err: unknown) {
        const e = err as { name?: string; message?: string };
        if (e?.name === "AbortError") {
          setError("Request took too long. Try a shorter length or check your connection.");
        } else {
          setError(e.message ?? "Something went wrong");
        }
      } finally {
        setLoading(false);
        setLoadingCategory(null);
      }
    },
    []
  );

  const audioUrls = audioChunks.length
    ? audioChunks.map((chunk) => chunk.audio_url)
    : result?.audio_url
      ? [result.audio_url]
      : [];
  const visibleProgress = Math.round(
    loading && !result ? Math.min(displayProgress, 99) : displayProgress
  );
  const dockVisible = loading || !!result || audioUrls.length > 0;

  return (
    <>
      <Head>
        <title>Daily Briefing</title>
      </Head>

      <main className="relative bg-[#050508] text-slate-100 lg:flex lg:h-screen lg:overflow-hidden">
        <div
          className="pointer-events-none fixed inset-0 opacity-80"
          aria-hidden
          style={{
            background:
              "linear-gradient(135deg, rgba(99,102,241,0.10) 0%, transparent 28%, transparent 68%, rgba(20,184,166,0.06) 100%)",
          }}
        />

        {/* ── LEFT COLUMN — sticky sidebar, 35% on desktop ── */}
        <div className="relative lg:w-[35%] lg:h-full lg:flex lg:flex-col lg:border-r lg:border-[#222222]">
          <div
            id="layout-left-inner"
            className="px-4 sm:px-6 lg:px-5 py-4 sm:py-5 lg:py-5 lg:overflow-y-auto lg:flex-1"
            style={{ scrollbarWidth: "none" }}
          >
            {/* Site header */}
            <header className="mb-4 sm:mb-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[9px] font-semibold uppercase tracking-[0.28em] text-slate-600 leading-none">
                    Curated daily audio
                  </p>
                  <h1 className="mt-1 font-display font-bold text-base sm:text-lg tracking-tight text-white leading-tight">
                    Stay informed—without the noise
                  </h1>
                </div>
                <button
                  type="button"
                  onClick={() => setModalOpen(true)}
                  aria-label="How it works"
                  className="flex-shrink-0 flex items-center gap-1.5 mt-1 text-[10px] text-slate-500 hover:text-slate-300 transition-colors"
                >
                  <Info className="h-3.5 w-3.5" />
                  <span>How it works</span>
                </button>
              </div>
            </header>

            {/* Hero */}
            <div id="mobile-hero">
              <DailyBriefingHero
                length={fullLength}
                onLengthChange={setFullLength}
                onGenerate={() =>
                  runGenerate("full_daily", {
                    length: fullLength,
                    title: "Today's Full Briefing",
                  })
                }
                loading={loading}
                isFullBriefingActive={loading && loadingCategory === null}
                progress={visibleProgress}
                loadingMessage={loadingMessage}
                audioLevels={heroAudioLevels}
                audioReactive={briefingAudioPlaying}
              />
            </div>

            {/* Category grid — compact in the narrow left column */}
            <div id="mobile-categories">
              <CategoryBriefingGrid
                onSelectCategory={(categoryKey, label) =>
                  runGenerate("category", {
                    categoryKey,
                    length: "medium",
                    title: label,
                  })
                }
                loading={loading}
                loadingCategory={loadingCategory}
                compact
              />
            </div>
          </div>
        </div>

        {/* ── MOBILE GLOBE — idle visual between controls and transcript ── */}
        {!result && !error && (
          <div
            className="lg:hidden"
            id="mobile-globe-container"
            data-state={loading ? "loading" : "idle"}
          >
            <div id="mobile-globe-sphere">
              <HeroGlobeBroadcast
                variant="mobile"
                activity={loading ? "active" : "idle"}
                progress={visibleProgress}
              />
            </div>
            {!loading && (
              <p id="mobile-globe-label" className="tabular-nums">
                Select a briefing to begin
              </p>
            )}
          </div>
        )}

        {/* ── RIGHT COLUMN — scrollable content + pinned player ── */}
        <div className="lg:flex-1 lg:h-full lg:flex lg:flex-col lg:overflow-hidden">

          {/* Scrollable content area */}
          <div
            id="layout-right-content"
            className={`flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8${dockVisible ? " max-lg:pb-24" : ""}`}
            style={{ scrollbarWidth: "none" }}
          >
            {/* Desktop: idle state — large centered globe as visual centerpiece */}
            {!result && !loading && !error && (
              <div className="hidden lg:block relative h-full min-h-[60vh] overflow-hidden">
                <HeroGlobeBroadcast variant="centered" />
                <div className="absolute inset-x-0 bottom-8 flex justify-center pointer-events-none">
                  <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-[#2e2e2e]">
                    Select a briefing to begin
                  </p>
                </div>
              </div>
            )}

            {/* Desktop: loading state */}
            {loading && !result && (
              <div className="hidden lg:flex relative h-full min-h-[60vh] flex-col items-center justify-center overflow-hidden">
                <HeroGlobeBroadcast
                  variant="centered"
                  activity="active"
                  progress={visibleProgress}
                />
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="text-[11px] text-red-300 bg-red-950/25 border border-red-900/35 rounded-lg px-4 py-3 leading-snug">
                {error}
              </div>
            )}

            {/* Result — transcript + sources */}
            {result && (
              <section className="space-y-6">
                {/* Transcript panel */}
                <div>
                  <div className="flex items-baseline justify-between mb-3">
                    <h3 className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                      Now Playing
                    </h3>
                    <span className="text-[9px] text-slate-600 uppercase tracking-wider">
                      {episodeTitle}
                    </span>
                  </div>
                  <div className="rounded-xl border border-[#222222] bg-[#111111] overflow-hidden">
                    <div className="px-5 py-4 sm:px-6 sm:py-5">
                      <TranscriptHighlight
                        transcript={result.transcript}
                        currentTime={audioTime.currentTime}
                        duration={audioTime.duration}
                      />
                    </div>
                  </div>
                </div>

                {/* Sources */}
                {result.sources?.length > 0 && (
                  <div>
                    <h3 className="text-[10px] font-semibold uppercase tracking-widest text-[#555555] mb-3">
                      Sources
                    </h3>
                    <div className="rounded-xl border border-[#222222] bg-[#111111] overflow-hidden">
                      <div className="max-h-56 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
                        {result.sources.map((source, idx) => (
                          <div
                            key={idx}
                            className={`group flex items-center justify-between gap-4 px-4 py-3 transition-colors duration-150 hover:bg-[#161616] ${
                              idx < result.sources.length - 1 ? "border-b border-[#1a1a1a]" : ""
                            }`}
                          >
                            <a
                              href={source.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[11px] text-[#aaaaaa] group-hover:text-white transition-colors duration-150 leading-snug min-w-0 truncate"
                            >
                              {source.title}
                            </a>
                            {source.publisher && (
                              <span className="flex-shrink-0 text-[9px] font-medium uppercase tracking-wide text-[#666666] group-hover:text-[#aaaaaa] bg-[#1a1a1a] group-hover:bg-[#222222] border border-[#222222] group-hover:border-[#333333] px-2 py-1 rounded-[4px] transition-colors duration-150">
                                {source.publisher}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </section>
            )}
          </div>

          {/* Player dock — fixed on mobile, pinned to bottom of right column on desktop */}
          <BriefingPlayerDock
            visible={dockVisible}
            loading={loading}
            progress={visibleProgress}
            episodeTitle={episodeTitle}
            audioUrls={audioUrls}
            playerId={`briefing-${playerInstanceKey}`}
            onPlayStateChange={setBriefingAudioPlaying}
            onTimeUpdate={handleTimeUpdate}
            onAudioLevels={setHeroAudioLevels}
            loadingMessage={loadingMessage}
          />
        </div>
      </main>

      <InfoModal open={modalOpen} onClose={handleModalClose} />
    </>
  );
}

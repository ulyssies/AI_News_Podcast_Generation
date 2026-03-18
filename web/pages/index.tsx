import Head from "next/head";
import { useCallback, useEffect, useState } from "react";
import { BriefingPlayerDock } from "../components/BriefingPlayerDock";
import { CategoryBriefingGrid } from "../components/CategoryBriefingGrid";
import { DailyBriefingHero } from "../components/DailyBriefingHero";

type GenerateResponse = {
  audio_url: string;
  transcript: string;
  sources: { title: string; url: string; publisher?: string | null }[];
};

type BriefingMode = "full_daily" | "category";

const FETCH_TIMEOUT_MS = 10 * 60 * 1000;

export default function Home() {
  const [fullLength, setFullLength] = useState<"short" | "medium" | "long">("medium");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GenerateResponse | null>(null);
  const [episodeTitle, setEpisodeTitle] = useState("Your briefing");
  const [loadingCategory, setLoadingCategory] = useState<string | null>(null);
  const [playerInstanceKey, setPlayerInstanceKey] = useState(0);
  const [briefingAudioPlaying, setBriefingAudioPlaying] = useState(false);

  useEffect(() => {
    if (!result?.audio_url) setBriefingAudioPlaying(false);
  }, [result?.audio_url]);

  useEffect(() => {
    if (loadingCategory) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [loadingCategory]);

  const runGenerate = useCallback(
    async (mode: BriefingMode, opts: { categoryKey?: string; length: string; title: string }) => {
      setLoading(true);
      setProgress(0);
      setError(null);
      setResult(null);
      setEpisodeTitle(opts.title);
      setLoadingCategory(mode === "category" ? opts.categoryKey ?? null : null);

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
                error?: string;
              };
              if (data.error) {
                setError(data.error);
                setLoading(false);
                setLoadingCategory(null);
                return;
              }
              if (typeof data.percent === "number") setProgress(data.percent);
              if (data.result) {
                setResult(data.result);
                setProgress(100);
                setPlayerInstanceKey((k) => k + 1);
                gotResult = true;
                break;
              }
            } catch {
              // ignore
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

  const dockVisible = loading || !!result;
  const audioUrl = result?.audio_url ?? null;

  return (
    <>
      <Head>
        <title>Daily Briefing</title>
      </Head>
      <main
        className={`min-h-screen bg-[#050508] text-slate-100 ${dockVisible ? "pb-[5.25rem] sm:pb-[5.5rem]" : ""}`}
      >
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-4">
          <header className="mb-2">
            <p className="text-[8px] font-semibold uppercase tracking-[0.26em] text-slate-500 leading-none">
              Curated daily audio
            </p>
            <h1 className="mt-0.5 text-sm sm:text-base lg:text-lg font-semibold tracking-tight text-white leading-tight">
              Stay informed—without the noise
            </h1>
          </header>

          <DailyBriefingHero
            length={fullLength}
            onLengthChange={setFullLength}
            onGenerate={() =>
              runGenerate("full_daily", {
                length: fullLength,
                title: "Today’s Full Briefing",
              })
            }
            loading={loading}
            isFullBriefingActive={loading && loadingCategory === null}
            progress={progress}
            audioPlaying={briefingAudioPlaying}
          />

          <CategoryBriefingGrid
            onSelectCategory={(categoryKey, label) =>
              runGenerate("category", {
                categoryKey,
                length: "short",
                title: label,
              })
            }
            loading={loading}
            loadingCategory={loadingCategory}
          />

          {error && (
            <div className="mt-3 text-[11px] text-red-300 bg-red-950/25 border border-red-900/35 rounded-lg px-3 py-2 leading-snug">
              {error}
            </div>
          )}

          {result && (
            <section className="mt-5 sm:mt-6 space-y-3 border-t border-slate-800/60 pt-4">
              <div className="space-y-2">
                <h3 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Transcript
                </h3>
                <div className="border border-slate-800/80 rounded-lg bg-black/25 overflow-hidden">
                  <div className="p-3 text-[11px] text-slate-300 whitespace-pre-line overflow-y-auto max-h-56 sm:max-h-64 min-h-[6rem] leading-snug">
                    {result.transcript}
                  </div>
                </div>
              </div>

              {result.sources?.length > 0 && (
                <div className="space-y-1.5">
                  <h3 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    Sources
                  </h3>
                  <ul className="space-y-1 text-[11px] text-slate-300 leading-snug">
                    {result.sources.map((source, idx) => (
                      <li key={idx}>
                        <a
                          href={source.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sky-400/90 hover:text-sky-300 hover:underline"
                        >
                          {source.title}
                        </a>
                        {source.publisher && (
                          <span className="text-slate-500"> · {source.publisher}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}
        </div>

        <BriefingPlayerDock
          visible={dockVisible}
          loading={loading}
          progress={progress}
          episodeTitle={episodeTitle}
          audioUrl={audioUrl}
          playerId={`briefing-${playerInstanceKey}`}
          onPlayStateChange={setBriefingAudioPlaying}
        />
      </main>
    </>
  );
}

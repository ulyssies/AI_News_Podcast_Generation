import Head from "next/head";
import { FormEvent, useState } from "react";
import { AudioPlayer } from "../components/AudioPlayer";
import { TopicInputWithDiscovery } from "../components/TopicInputWithDiscovery";

type GenerateResponse = {
  audio_url: string;
  transcript: string;
  sources: { title: string; url: string; publisher?: string | null }[];
};

function formatEpisodeTitle(topic: string): string {
  const t = topic.trim();
  if (!t) return "Your episode";
  const capped = t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
  return `Latest on ${capped}`;
}

const FETCH_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

export default function Home() {
  const [topic, setTopic] = useState("");
  const [length, setLength] = useState<"short" | "medium" | "long">("short");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GenerateResponse | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setProgress(0);
    setError(null);
    setResult(null);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      const apiBase =
        typeof window !== "undefined"
          ? process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
          : "";
      const url = apiBase ? `${apiBase}/generate/stream` : "/api/generate/stream";
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, length }),
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
              return;
            }
            if (typeof data.percent === "number") setProgress(data.percent);
            if (data.result) {
              setResult(data.result);
              setProgress(100);
              gotResult = true;
              break;
            }
          } catch {
            // ignore malformed lines
          }
        }
        if (gotResult) break;
      }
    } catch (err: any) {
      if (err?.name === "AbortError") {
        setError("Request took too long. Try a shorter episode length or check your connection.");
      } else {
        setError(err.message ?? "Something went wrong");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>AI News Podcast Generator</title>
      </Head>
      <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-50 flex items-center justify-center p-6">
        <div className="w-full max-w-2xl">
          <header className="text-center mb-8">
            <h1 className="text-3xl font-bold tracking-tight text-white">
              AI News Podcast
            </h1>
            <p className="mt-2 text-slate-400 text-sm max-w-md mx-auto">
              Enter a topic and get an audio briefing with transcript and sources.
            </p>
          </header>

          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl shadow-2xl shadow-black/20 p-6 sm:p-8 space-y-6">
            <form onSubmit={handleSubmit} className="space-y-5">
              <TopicInputWithDiscovery
                value={topic}
                onChange={setTopic}
                placeholder="e.g. Iran, climate summit, AI regulation"
                id="topic"
                aria-label="Topic"
                required
              />

              <div className="space-y-2">
                <span className="text-sm font-medium text-slate-300">Length</span>
                <div className="flex gap-2">
                  {(["short", "medium", "long"] as const).map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setLength(option)}
                      className={`flex-1 rounded-xl py-2.5 text-sm font-medium capitalize transition-all ${
                        length === option
                          ? "bg-sky-500 text-white shadow-lg shadow-sky-500/25"
                          : "bg-slate-800/60 text-slate-400 border border-slate-700/80 hover:bg-slate-700/50 hover:text-slate-200 hover:border-slate-600"
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl py-3.5 text-sm font-semibold bg-sky-500 text-white shadow-lg shadow-sky-500/25 hover:bg-sky-400 hover:shadow-sky-400/30 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none transition-all"
              >
                {loading ? `Generating… ${progress}%` : "Generate Episode"}
              </button>
            </form>

            {error && (
              <div className="text-sm text-red-300 bg-red-950/40 border border-red-900/50 rounded-xl px-4 py-3">
                {error}
              </div>
            )}

            {result && (
              <section className="space-y-5 border-t border-slate-700/80 pt-6">
                <div className="space-y-3">
                  <h2 className="text-xl font-semibold text-white">
                    {formatEpisodeTitle(topic)}
                  </h2>
                  {result.audio_url ? (
                    <AudioPlayer
                      key={result.audio_url.slice(0, 80)}
                      src={result.audio_url}
                      id={`episode-${topic}-${length}`}
                      aria-label="Episode playback"
                      className="rounded-xl bg-slate-800/50 border border-slate-700/80 p-3"
                    />
                  ) : (
                    <div className="text-sm text-slate-400 bg-slate-800/40 border border-slate-700 rounded-xl px-4 py-3">
                      Audio is unavailable. Transcript is shown below.
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-slate-200">Transcript</h3>
                  <div className="border border-slate-700/80 rounded-xl bg-slate-950/50 overflow-hidden">
                    <div className="p-4 text-sm text-slate-300 whitespace-pre-line overflow-y-auto max-h-96 min-h-[8rem]">
                      {result.transcript}
                    </div>
                  </div>
                </div>

                {result.sources?.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-slate-200">Sources</h3>
                    <ul className="space-y-1.5 text-sm text-slate-300">
                      {result.sources.map((source, idx) => (
                        <li key={idx}>
                          <a
                            href={source.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-sky-400 hover:text-sky-300 hover:underline"
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
        </div>
      </main>
    </>
  );
}

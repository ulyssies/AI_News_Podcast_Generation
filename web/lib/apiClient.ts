/**
 * Shared API base URL for backend calls (generate, trending-topics).
 * In the browser we call the API directly to avoid proxy timeouts.
 */

export function getApiBase(): string {
  if (typeof window === "undefined") return "";
  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
}

export type TrendingTopicsResponse = { topics: string[] };

export async function fetchTrendingTopics(): Promise<TrendingTopicsResponse> {
  const base = getApiBase();
  const url = base ? `${base}/trending-topics` : "/api/trending-topics";
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    let msg = `Trending topics failed: ${res.status}`;
    try {
      const j = JSON.parse(text) as { detail?: string };
      if (j?.detail) msg = j.detail;
    } catch {
      if (text) msg = text.slice(0, 200);
    }
    throw new Error(msg);
  }
  return res.json() as Promise<TrendingTopicsResponse>;
}

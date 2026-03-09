"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchTrendingTopics } from "../lib/apiClient";

export interface UseTrendingTopicsResult {
  topics: string[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useTrendingTopics(): UseTrendingTopicsResult {
  const [topics, setTopics] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchTrendingTopics();
      setTopics(Array.isArray(data.topics) ? data.topics : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load trending topics");
      setTopics([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { topics, loading, error, refetch: load };
}

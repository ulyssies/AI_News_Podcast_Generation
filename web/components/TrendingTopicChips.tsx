"use client";

export interface TrendingTopicChipsProps {
  topics: string[];
  loading: boolean;
  error: string | null;
  selectedTopic: string | null;
  onSelectTopic: (topic: string) => void;
  onRetry?: () => void;
  className?: string;
}

export function TrendingTopicChips({
  topics,
  loading,
  error,
  selectedTopic,
  onSelectTopic,
  onRetry,
  className = "",
}: TrendingTopicChipsProps) {
  if (loading) {
    return (
      <div className={`space-y-2 ${className}`}>
        <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">
          Trending topics
        </p>
        <div className="flex flex-wrap gap-2" aria-busy="true" aria-live="polite">
          {[1, 2, 3, 4, 5].map((i) => (
            <span
              key={i}
              className="h-8 w-20 rounded-lg bg-slate-700/60 animate-pulse"
              aria-hidden
            />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`space-y-2 ${className}`}>
        <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">
          Trending topics
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-slate-400">Couldn’t load trending topics. Start the API (uvicorn from project root) and click Retry.</span>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="text-sm text-sky-400 hover:text-sky-300 underline"
            >
              Retry
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!topics.length) {
    return (
      <div className={`space-y-2 ${className}`}>
        <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">
          Trending topics
        </p>
        <p className="text-sm text-slate-500">No trending topics right now.</p>
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">
        Trending in the last 7 days
      </p>
      <div className="flex flex-wrap gap-2" role="list">
        {topics.map((topic) => {
          const isSelected =
            selectedTopic !== null &&
            selectedTopic.trim().toLowerCase() === topic.trim().toLowerCase();

          return (
            <button
              key={topic}
              type="button"
              role="listitem"
              onClick={() => onSelectTopic(topic)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-all border ${
                isSelected
                  ? "bg-sky-500/20 border-sky-500 text-sky-200"
                  : "bg-slate-800/60 border-slate-600 text-slate-300 hover:bg-slate-700/60 hover:border-slate-500 hover:text-slate-200"
              }`}
            >
              {topic}
            </button>
          );
        })}
      </div>
    </div>
  );
}

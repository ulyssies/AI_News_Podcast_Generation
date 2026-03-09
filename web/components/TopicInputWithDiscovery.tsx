"use client";

import { useTrendingTopics } from "../hooks/useTrendingTopics";
import { TrendingTopicChips } from "./TrendingTopicChips";

export interface TopicInputWithDiscoveryProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  id?: string;
  "aria-label"?: string;
  required?: boolean;
  className?: string;
}

/**
 * Topic input with a discovery layer: custom text input plus trending topic chips.
 * Clicking a chip fills the input and marks it as selected; user can still edit.
 */
export function TopicInputWithDiscovery({
  value,
  onChange,
  placeholder = "e.g. Iran, climate summit, AI regulation",
  id = "topic",
  "aria-label": ariaLabel = "Topic",
  required = true,
  className = "",
}: TopicInputWithDiscoveryProps) {
  const { topics, loading, error, refetch } = useTrendingTopics();

  const handleSelectTopic = (topic: string) => {
    onChange(topic);
  };

  const selectedTopic = value.trim() ? value : null;

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-300" htmlFor={id}>
          Topic
        </label>
        <input
          id={id}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-label={ariaLabel}
          required={required}
          className="w-full rounded-xl border border-slate-600/80 bg-slate-950/70 px-4 py-3 text-slate-100 placeholder:text-slate-500 outline-none focus:border-sky-500/80 focus:ring-2 focus:ring-sky-500/20 transition"
        />
      </div>

      <TrendingTopicChips
        topics={topics}
        loading={loading}
        error={error}
        selectedTopic={selectedTopic}
        onSelectTopic={handleSelectTopic}
        onRetry={refetch}
      />
    </div>
  );
}

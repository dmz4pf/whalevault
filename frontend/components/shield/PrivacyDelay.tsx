"use client";

import { useState } from "react";

interface PrivacyDelayProps {
  delayMs: number | null;
  onDelayChange: (delayMs: number | null) => void;
}

const DELAY_PRESETS = [
  { label: "1h", ms: 60 * 60 * 1000 },
  { label: "6h", ms: 6 * 60 * 60 * 1000 },
  { label: "24h", ms: 24 * 60 * 60 * 1000 },
] as const;

export function PrivacyDelay({ delayMs, onDelayChange }: PrivacyDelayProps) {
  const [enabled, setEnabled] = useState(delayMs !== null);

  const handleToggle = () => {
    if (enabled) {
      setEnabled(false);
      onDelayChange(null);
    } else {
      setEnabled(true);
      onDelayChange(DELAY_PRESETS[0].ms);
    }
  };

  return (
    <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-white">Privacy Delay</span>
          <div className="group relative">
            <svg
              className="w-4 h-4 text-gray-500 cursor-help"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 rounded-lg bg-gray-900 border border-white/10 text-xs text-gray-300 opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-10">
              Privacy delays make your withdrawal pattern less predictable by
              requiring a minimum wait time.
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={handleToggle}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            enabled ? "bg-whale-500" : "bg-white/20"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              enabled ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>

      {enabled && (
        <div className="flex gap-2">
          {DELAY_PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => onDelayChange(preset.ms)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                delayMs === preset.ms
                  ? "bg-whale-500/20 text-whale-400 border border-whale-500/40"
                  : "bg-white/5 text-gray-400 border border-white/10 hover:border-white/20"
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";

interface PrivacyDelayProps {
  delayMs: number | null;
  onDelayChange: (delayMs: number | null) => void;
}

// Fixed delay intervals (not random ranges)
const DELAY_PRESETS = [
  { label: "Instant", icon: "⚡", ms: 0, description: "No delay" },
  { label: "1 Hour", icon: "🕐", ms: 60 * 60 * 1000, description: "1h delay" },
  { label: "6 Hours", icon: "🕕", ms: 6 * 60 * 60 * 1000, description: "6h delay" },
  { label: "12 Hours", icon: "🕛", ms: 12 * 60 * 60 * 1000, description: "12h delay" },
  { label: "24 Hours", icon: "🔒", ms: 24 * 60 * 60 * 1000, description: "24h delay" },
] as const;

export function PrivacyDelay({ delayMs, onDelayChange }: PrivacyDelayProps) {
  const [showCustom, setShowCustom] = useState(false);
  const [customHours, setCustomHours] = useState("");

  // Check if current delay matches a preset
  const isPresetSelected = (presetMs: number) => {
    if (presetMs === 0) return delayMs === null || delayMs === 0;
    return delayMs === presetMs;
  };

  const isCustomSelected = !DELAY_PRESETS.some(p => isPresetSelected(p.ms)) && delayMs !== null && delayMs > 0;

  const handlePresetSelect = (ms: number) => {
    setShowCustom(false);
    onDelayChange(ms === 0 ? null : ms);
  };

  const handleCustomSelect = () => {
    setShowCustom(true);
    if (customHours) {
      onDelayChange(parseFloat(customHours) * 60 * 60 * 1000);
    }
  };

  const handleCustomChange = (value: string) => {
    setCustomHours(value);
    const hours = parseFloat(value);
    if (!isNaN(hours) && hours > 0) {
      onDelayChange(hours * 60 * 60 * 1000);
    }
  };

  return (
    <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-white">Privacy Level</span>
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
            Longer delays increase privacy by making withdrawal timing unpredictable.
            Choose how long before you can unshield.
          </div>
        </div>
      </div>

      {/* Preset buttons */}
      <div className="grid grid-cols-3 gap-2">
        {DELAY_PRESETS.map((preset) => (
          <button
            key={preset.label}
            type="button"
            onClick={() => handlePresetSelect(preset.ms)}
            className={`flex flex-col items-center py-3 px-2 rounded-lg text-sm font-medium transition-all ${
              isPresetSelected(preset.ms)
                ? "bg-whale-500/20 text-whale-400 border border-whale-500/40"
                : "bg-white/5 text-gray-400 border border-white/10 hover:border-white/20"
            }`}
          >
            <span className="text-lg mb-1">{preset.icon}</span>
            <span className="text-xs">{preset.label}</span>
          </button>
        ))}

        {/* Custom button */}
        <button
          type="button"
          onClick={handleCustomSelect}
          className={`flex flex-col items-center py-3 px-2 rounded-lg text-sm font-medium transition-all ${
            isCustomSelected || showCustom
              ? "bg-whale-500/20 text-whale-400 border border-whale-500/40"
              : "bg-white/5 text-gray-400 border border-white/10 hover:border-white/20"
          }`}
        >
          <span className="text-lg mb-1">⚙️</span>
          <span className="text-xs">Custom</span>
        </button>
      </div>

      {/* Custom input */}
      {showCustom && (
        <div className="flex items-center gap-2">
          <input
            type="number"
            min="1"
            step="1"
            value={customHours}
            onChange={(e) => handleCustomChange(e.target.value)}
            placeholder="Enter hours"
            className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-whale-500"
          />
          <span className="text-sm text-gray-400">hours</span>
        </div>
      )}

      {/* Current selection indicator */}
      <div className="text-xs text-gray-500 text-center">
        {delayMs === null || delayMs === 0 ? (
          <span>Funds available immediately after shielding</span>
        ) : (
          <span>Funds available {Math.round(delayMs / (60 * 60 * 1000))} hours after shielding</span>
        )}
      </div>
    </div>
  );
}

"use client";

import { FIXED_DENOMINATIONS } from "@/lib/constants";
import { AnonymityBadge } from "./AnonymityBadge";
import type { PoolInfo } from "@/types/api";
import { cn } from "@/lib/utils";

interface Props {
  selected: number | null;
  onSelect: (value: number | null, mode: "fixed" | "custom") => void;
  pools: PoolInfo[];
}

export function DenominationSelector({ selected, onSelect, pools }: Props) {
  const isCustomMode = selected === null;

  const selectedPool = selected !== null
    ? pools.find((p) => p.denomination === selected)
    : null;

  const showWarning = selectedPool && selectedPool.depositCount < 5;

  return (
    <div className="space-y-4">
      <label className="block text-sm text-text-dim">Select Amount</label>

      {/* Segmented Control */}
      <div className="flex rounded-lg bg-bg-card border border-border p-1">
        <button
          onClick={() => {
            if (isCustomMode) onSelect(1_000_000_000, "fixed");
          }}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-all",
            !isCustomMode
              ? "bg-terminal-green/20 text-terminal-green border border-terminal-green/30"
              : "text-text-dim hover:text-text"
          )}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M17 14v6m-3-3h6M6 10h2a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v2a2 2 0 002 2zm10 0h2a2 2 0 002-2V6a2 2 0 00-2-2h-2a2 2 0 00-2 2v2a2 2 0 002 2zM6 20h2a2 2 0 002-2v-2a2 2 0 00-2-2H6a2 2 0 00-2 2v2a2 2 0 002 2z" />
          </svg>
          Fixed Pools
          {!isCustomMode && (
            <span className="text-[10px] bg-terminal-green/10 text-terminal-green px-1.5 py-0.5 rounded-full">
              Best Privacy
            </span>
          )}
        </button>
        <button
          onClick={() => onSelect(null, "custom")}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-all",
            isCustomMode
              ? "bg-terminal-green/20 text-terminal-green border border-terminal-green/30"
              : "text-text-dim hover:text-text"
          )}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          Custom Amount
        </button>
      </div>

      {/* Fixed Denomination Grid */}
      {!isCustomMode && (
        <>
          <div className="grid grid-cols-3 gap-3">
            {FIXED_DENOMINATIONS.map((denom) => {
              const pool = pools.find((p) => p.denomination === denom.value);
              const isSelected = selected === denom.value;
              return (
                <button
                  key={denom.value}
                  onClick={() => onSelect(denom.value, "fixed")}
                  className={cn(
                    "relative p-5 rounded-lg border cursor-pointer transition-all text-left",
                    "bg-bg-card border-border",
                    isSelected
                      ? "border-terminal-green bg-terminal-green/10"
                      : "hover:border-terminal-dark hover:bg-terminal-green/[0.03]"
                  )}
                >
                  <div className="text-xl font-bold text-white">{denom.label}</div>
                  <div className="mt-1">
                    {pool ? (
                      <AnonymityBadge depositCount={pool.depositCount} />
                    ) : (
                      <span className="text-xs text-text-muted">---</span>
                    )}
                  </div>
                  {denom.recommended && (
                    <span className="absolute top-2 right-2 text-[10px] font-medium text-terminal-green bg-terminal-green/10 px-1.5 py-0.5 rounded">
                      Best
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {showWarning && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-300">
              <span className="mt-0.5 shrink-0">!</span>
              <span>
                This pool has only {selectedPool.depositCount} deposits. Consider waiting for more
                deposits or choosing a different denomination for better privacy.
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

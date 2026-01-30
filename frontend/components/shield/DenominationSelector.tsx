"use client";

import { FIXED_DENOMINATIONS } from "@/lib/constants";
import type { PoolInfo } from "@/types/api";
import { cn } from "@/lib/utils";

interface Props {
  selected: number | null;
  onSelect: (value: number | null, mode: "fixed" | "custom") => void;
  pools: PoolInfo[];
}

function getPrivacyLevel(depositCount: number): { label: string; color: string; bgColor: string; progress: number } {
  if (depositCount >= 50) return { label: "EXCELLENT", color: "text-terminal-green", bgColor: "bg-terminal-green", progress: 100 };
  if (depositCount >= 20) return { label: "GOOD", color: "text-terminal-green", bgColor: "bg-terminal-green", progress: 75 };
  if (depositCount >= 10) return { label: "MODERATE", color: "text-yellow-400", bgColor: "bg-yellow-400", progress: 50 };
  if (depositCount >= 5) return { label: "LOW", color: "text-orange-400", bgColor: "bg-orange-400", progress: 30 };
  return { label: "MINIMAL", color: "text-red-400", bgColor: "bg-red-400", progress: 15 };
}

export function DenominationSelector({ selected, onSelect, pools }: Props) {
  const isCustomMode = selected === null;

  const selectedPool = selected !== null
    ? pools.find((p) => p.denomination === selected)
    : null;

  const showWarning = selectedPool && selectedPool.depositCount < 5;

  return (
    <div className="space-y-5">
      <label className="block font-heading text-[13px] text-white uppercase tracking-[3px]">
        Select Amount
      </label>

      {/* Segmented Control */}
      <div className="flex rounded-xl bg-[#0a0f14] border border-terminal-green/20 p-1.5">
        <button
          onClick={() => {
            if (isCustomMode) onSelect(1_000_000_000, "fixed");
          }}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg text-sm font-medium transition-all duration-200",
            !isCustomMode
              ? "bg-terminal-green/20 text-terminal-green shadow-[0_0_20px_rgba(0,160,136,0.15)]"
              : "text-text-dim hover:text-terminal-green/70"
          )}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M17 14v6m-3-3h6M6 10h2a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v2a2 2 0 002 2zm10 0h2a2 2 0 002-2V6a2 2 0 00-2-2h-2a2 2 0 00-2 2v2a2 2 0 002 2zM6 20h2a2 2 0 002-2v-2a2 2 0 00-2-2H6a2 2 0 00-2 2v2a2 2 0 002 2z" />
          </svg>
          Fixed Pools
          {!isCustomMode && (
            <span className="text-[10px] bg-terminal-green/30 text-terminal-green px-2 py-0.5 rounded-full font-bold">
              ● BEST
            </span>
          )}
        </button>
        <button
          onClick={() => onSelect(null, "custom")}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg text-sm font-medium transition-all duration-200",
            isCustomMode
              ? "bg-terminal-green/20 text-terminal-green shadow-[0_0_20px_rgba(0,160,136,0.15)]"
              : "text-text-dim hover:text-terminal-green/70"
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
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {FIXED_DENOMINATIONS.map((denom) => {
              const pool = pools.find((p) => p.denomination === denom.value);
              const depositCount = pool?.depositCount ?? 0;
              const privacy = getPrivacyLevel(depositCount);
              const isSelected = selected === denom.value;

              return (
                <button
                  key={denom.value}
                  onClick={() => onSelect(denom.value, "fixed")}
                  className={cn(
                    "relative p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 text-left group",
                    "bg-[#0a0f14]",
                    isSelected
                      ? "border-terminal-green shadow-[0_0_30px_rgba(0,160,136,0.2)]"
                      : "border-terminal-green/10 hover:border-terminal-green/40 hover:shadow-[0_0_20px_rgba(0,160,136,0.1)]"
                  )}
                >
                  {/* Recommended Badge */}
                  {denom.recommended && (
                    <span className="absolute -top-2 -right-2 text-[10px] font-bold text-black bg-terminal-green px-2 py-1 rounded-full shadow-[0_0_10px_rgba(0,160,136,0.5)]">
                      ★ BEST
                    </span>
                  )}

                  {/* Denomination */}
                  <div className="text-2xl font-bold text-white mb-3 font-heading">
                    {denom.label}
                  </div>

                  {/* Deposit Count */}
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-text-dim">Deposits</span>
                    <span className="text-sm font-mono text-white">{depositCount}</span>
                  </div>

                  {/* Progress Bar */}
                  <div className="h-1.5 bg-white/5 rounded-full overflow-hidden mb-2">
                    <div
                      className={cn("h-full rounded-full transition-all duration-500", privacy.bgColor)}
                      style={{ width: `${privacy.progress}%`, opacity: 0.8 }}
                    />
                  </div>

                  {/* Privacy Level */}
                  <div className={cn("text-[10px] font-bold tracking-wider", privacy.color)}>
                    {privacy.label} PRIVACY
                  </div>

                  {/* Selection Indicator */}
                  {isSelected && (
                    <div className="absolute top-3 left-3">
                      <div className="w-3 h-3 rounded-full bg-terminal-green shadow-[0_0_10px_rgba(0,160,136,0.8)]" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Privacy Info */}
          <div className="flex items-center gap-3 p-4 rounded-xl bg-terminal-green/5 border border-terminal-green/20">
            <div className="w-8 h-8 rounded-full bg-terminal-green/20 flex items-center justify-center shrink-0">
              <span className="text-terminal-green text-lg">i</span>
            </div>
            <p className="text-xs text-text-dim leading-relaxed">
              Fixed denominations mix your deposit with others who deposited the same amount,
              <span className="text-terminal-green"> maximizing your privacy</span>.
              Higher deposit counts = stronger anonymity.
            </p>
          </div>

          {/* Low Privacy Warning */}
          {showWarning && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/30">
              <div className="w-6 h-6 rounded-full bg-red-500/20 flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-red-400 text-sm font-bold">!</span>
              </div>
              <div>
                <div className="text-sm font-medium text-red-400 mb-1">Low Anonymity Warning</div>
                <p className="text-xs text-red-300/70">
                  This pool has only {selectedPool?.depositCount} deposits. Consider waiting for more
                  deposits or choosing a different denomination for better privacy protection.
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

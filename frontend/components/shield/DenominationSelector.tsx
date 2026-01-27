"use client";

import { FIXED_DENOMINATIONS } from "@/lib/constants";
import type { PoolInfo } from "@/types/api";

function getPrivacyLevel(depositCount: number) {
  if (depositCount >= 20) return { color: "text-green-400", bg: "bg-green-400", label: "Good privacy" };
  if (depositCount >= 5) return { color: "text-yellow-400", bg: "bg-yellow-400", label: "Moderate" };
  return { color: "text-red-400", bg: "bg-red-400", label: "Low privacy" };
}

interface Props {
  selected: number | null;
  onSelect: (value: number | null, mode: "fixed" | "custom") => void;
  pools: PoolInfo[];
}

export function DenominationSelector({ selected, onSelect, pools }: Props) {
  return (
    <div className="space-y-4">
      <label className="block text-sm text-gray-400">Select Amount</label>

      <div className="grid grid-cols-3 gap-3">
        {FIXED_DENOMINATIONS.map((denom) => {
          const pool = pools.find((p) => p.denomination === denom.value);
          const isSelected = selected === denom.value;
          return (
            <button
              key={denom.value}
              onClick={() => onSelect(denom.value, "fixed")}
              className={`relative p-4 rounded-xl border text-left transition-all ${
                isSelected
                  ? "border-whale-500 bg-whale-500/10"
                  : "border-white/10 bg-white/5 hover:border-white/20"
              }`}
            >
              <div className="text-xl font-bold text-white">{denom.label}</div>
              <div className="flex items-center gap-1.5 text-xs text-gray-400 mt-1">
                {pool ? (
                  <>
                    <span className={`w-1.5 h-1.5 rounded-full ${getPrivacyLevel(pool.depositCount).bg}`} />
                    <span>{pool.depositCount} deposits</span>
                  </>
                ) : (
                  <span>---</span>
                )}
              </div>
              {denom.recommended && (
                <span className="absolute top-2 right-2 text-[10px] font-medium text-green-400 bg-green-400/10 px-1.5 py-0.5 rounded">
                  Best
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="pt-3 border-t border-white/10">
        <button
          onClick={() => onSelect(null, "custom")}
          className={`text-sm transition-colors ${
            selected === null
              ? "text-whale-400"
              : "text-gray-500 hover:text-gray-300"
          }`}
        >
          Use custom amount (reduced privacy) &rarr;
        </button>
      </div>
    </div>
  );
}

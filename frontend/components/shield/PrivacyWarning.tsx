"use client";

import { CUSTOM_AMOUNT_WARNING } from "@/lib/constants";

interface Props {
  isCustom: boolean;
  onSwitchToFixed?: () => void;
}

export function PrivacyWarning({ isCustom, onSwitchToFixed }: Props) {
  if (!isCustom) return null;

  return (
    <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
      <div className="flex items-start gap-3">
        <svg
          className="w-5 h-5 text-yellow-500 mt-0.5 shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <div>
          <h4 className="font-medium text-yellow-500 text-sm">
            Reduced Privacy
          </h4>
          <p className="text-sm text-text-dim mt-1">{CUSTOM_AMOUNT_WARNING}</p>
          {onSwitchToFixed && (
            <button
              onClick={onSwitchToFixed}
              className="text-sm text-terminal-green mt-2 hover:underline"
            >
              Switch to fixed denomination &rarr;
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

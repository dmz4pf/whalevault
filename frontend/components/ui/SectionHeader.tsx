"use client";

import { cn } from "@/lib/utils";

interface SectionHeaderProps {
  children: string;
  className?: string;
  /** Terminal command style e.g. "shield --token" renders as "$ shield --token" */
  command?: string;
}

export function SectionHeader({ children, className, command }: SectionHeaderProps) {
  // Terminal command style
  if (command) {
    return (
      <div
        className={cn(
          "font-mono text-[14px] mb-4",
          className
        )}
      >
        <span className="text-terminal-green">$</span>{" "}
        <span className="text-text-dim">{command}</span>
      </div>
    );
  }

  // Default uppercase style
  return (
    <div
      className={cn(
        "font-mono text-[13px] text-white uppercase tracking-[2px] mb-[15px]",
        className
      )}
    >
      {children.toUpperCase()}
    </div>
  );
}

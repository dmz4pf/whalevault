"use client";

import { useState, useEffect, useRef, ReactNode } from "react";
import { motion } from "framer-motion";

interface PageHeaderProps {
  title: string;
  subtitle: string;
  rightContent?: ReactNode;
}

export function PageHeader({ title, subtitle, rightContent }: PageHeaderProps) {
  const [displayedTitle, setDisplayedTitle] = useState("");
  const [displayedSubtitle, setDisplayedSubtitle] = useState("");
  const [showCursor, setShowCursor] = useState(true);
  const animationStarted = useRef(false);

  useEffect(() => {
    if (animationStarted.current) return;
    animationStarted.current = true;

    let titleIndex = 0;
    let subtitleIndex = 0;
    const titleSpeed = 40;
    const subtitleSpeed = 15;

    // Type title first
    const typeTitle = () => {
      if (titleIndex <= title.length) {
        setDisplayedTitle(title.slice(0, titleIndex));
        titleIndex++;
        setTimeout(typeTitle, titleSpeed);
      } else {
        // Then type subtitle
        setTimeout(typeSubtitle, 200);
      }
    };

    const typeSubtitle = () => {
      if (subtitleIndex <= subtitle.length) {
        setDisplayedSubtitle(subtitle.slice(0, subtitleIndex));
        subtitleIndex++;
        setTimeout(typeSubtitle, subtitleSpeed);
      } else {
        // Hide cursor after typing complete
        setTimeout(() => setShowCursor(false), 500);
      }
    };

    setTimeout(typeTitle, 300);
  }, [title, subtitle]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className={rightContent ? "flex items-end justify-between mb-[30px]" : "mb-[30px]"}
    >
      <div className="space-y-[10px]">
        <h1
          className="font-heading text-[26px] font-semibold text-terminal-green"
          style={{ textShadow: "0 0 20px rgba(0, 160, 136, 0.3)" }}
        >
          {displayedTitle}
          {showCursor && displayedSubtitle.length === 0 && (
            <span
              className="inline-block w-[2px] h-[26px] bg-terminal-green ml-1 align-middle animate-cursor-blink"
              style={{ boxShadow: "0 0 8px #00a088" }}
            />
          )}
        </h1>
        <p className="font-mono text-[14px] text-text-dim">
          {displayedSubtitle}
          {showCursor && displayedSubtitle.length > 0 && displayedSubtitle.length < subtitle.length && (
            <span
              className="inline-block w-[2px] h-[14px] bg-terminal-green ml-0.5 align-middle animate-cursor-blink"
              style={{ boxShadow: "0 0 6px #00a088" }}
            />
          )}
        </p>
      </div>
      {rightContent}
    </motion.div>
  );
}

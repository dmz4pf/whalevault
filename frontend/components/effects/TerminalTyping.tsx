"use client";

import { useState, useEffect, useRef } from "react";

interface TerminalLine {
  type: "command" | "output" | "success" | "highlight";
  text: string;
}

const terminalContent: TerminalLine[] = [
  { type: "command", text: "whalevault init --network devnet" },
  { type: "output", text: "Initializing privacy protocol..." },
  { type: "success", text: "Zero-knowledge circuits loaded" },
  { type: "success", text: "Privacy pool connected" },
  { type: "success", text: "Stealth addresses generated" },
  { type: "highlight", text: "Ready for private transactions" },
];

export function TerminalTyping() {
  const [displayedLines, setDisplayedLines] = useState<{text: string; type: string; complete: boolean}[]>([]);
  const [isComplete, setIsComplete] = useState(false);
  const animationStarted = useRef(false);

  useEffect(() => {
    // Always animate on page load - no localStorage caching
    if (animationStarted.current) return;
    animationStarted.current = true;

    let lineIndex = 0;
    let charIndex = 0;

    const typeNextChar = () => {
      if (lineIndex >= terminalContent.length) {
        setIsComplete(true);
        return;
      }

      const currentLine = terminalContent[lineIndex];
      const speed = currentLine.type === "command" ? 30 :
                    currentLine.type === "output" ? 20 : 15;

      if (charIndex <= currentLine.text.length) {
        setDisplayedLines(prev => {
          const updated = [...prev];
          updated[lineIndex] = {
            type: currentLine.type,
            text: currentLine.text.slice(0, charIndex),
            complete: charIndex === currentLine.text.length
          };
          return updated;
        });
        charIndex++;
        setTimeout(typeNextChar, speed);
      } else {
        lineIndex++;
        charIndex = 0;
        setTimeout(typeNextChar, 200);
      }
    };

    setTimeout(typeNextChar, 500);
  }, []);

  return (
    <div className="font-mono text-sm leading-[2.2]">
      {displayedLines.map((line, i) => (
        <div key={i} className="mb-1">
          {line.type === "command" && (
            <>
              <span className="text-terminal-green">$</span>
              <span className="text-text ml-2">{line.text}</span>
            </>
          )}
          {line.type === "output" && (
            <span className="text-text-dim pl-4">{line.text}</span>
          )}
          {line.type === "success" && (
            <>
              <span className="text-terminal-green pl-4">✓</span>
              <span className="text-terminal-dim ml-2">{line.text}</span>
            </>
          )}
          {line.type === "highlight" && (
            <>
              <span className="text-terminal-green">$</span>
              <span className="text-text ml-2">Ready for </span>
              <span className="text-terminal-green" style={{ textShadow: "0 0 10px #00a088" }}>
                private transactions
              </span>
            </>
          )}
        </div>
      ))}
      {/* Blinking cursor */}
      <span
        className="inline-block w-2 h-4 bg-terminal-green ml-1 align-middle animate-cursor-blink"
        style={{ boxShadow: "0 0 8px #00a088" }}
      />
    </div>
  );
}

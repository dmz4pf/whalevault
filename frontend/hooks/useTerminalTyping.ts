"use client";

import { useState, useEffect, useCallback, useRef } from "react";

const STORAGE_KEY = "whalevault_visited";

interface UseTerminalTypingReturn {
  isFirstVisit: boolean;
  hasAnimated: boolean;
  typeText: (
    element: HTMLElement,
    text: string,
    speed?: number
  ) => Promise<void>;
  markVisited: () => void;
}

export function useTerminalTyping(): UseTerminalTypingReturn {
  const [isFirstVisit, setIsFirstVisit] = useState(true);
  const [hasAnimated, setHasAnimated] = useState(false);
  const animationRef = useRef<boolean>(false);

  useEffect(() => {
    const visited = localStorage.getItem(STORAGE_KEY);
    setIsFirstVisit(!visited);
  }, []);

  const typeText = useCallback(
    async (element: HTMLElement, text: string, speed = 25): Promise<void> => {
      for (let i = 0; i < text.length; i++) {
        element.innerHTML += text[i];
        await new Promise((resolve) => setTimeout(resolve, speed));
      }
    },
    []
  );

  const markVisited = useCallback(() => {
    if (!animationRef.current) {
      animationRef.current = true;
      localStorage.setItem(STORAGE_KEY, "true");
      setHasAnimated(true);
    }
  }, []);

  return { isFirstVisit, hasAnimated, typeText, markVisited };
}

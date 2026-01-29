"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface UsePrivacyRingOptions {
  duration?: number;
  startDelay?: number;
}

interface UsePrivacyRingReturn {
  currentScore: number;
  isAnimating: boolean;
  startAnimation: (target: number) => void;
  reset: () => void;
}

export function usePrivacyRing(
  options: UsePrivacyRingOptions = {}
): UsePrivacyRingReturn {
  const { duration = 2000, startDelay = 0 } = options;
  const [currentScore, setCurrentScore] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const targetRef = useRef<number>(0);

  const easeOutQuart = (t: number): number => {
    return 1 - Math.pow(1 - t, 4);
  };

  const animate = useCallback(
    (timestamp: number) => {
      if (!startTimeRef.current) {
        startTimeRef.current = timestamp;
      }

      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easeOutQuart(progress);
      const newScore = Math.round(easedProgress * targetRef.current);

      setCurrentScore(newScore);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        setIsAnimating(false);
        animationRef.current = null;
      }
    },
    [duration]
  );

  const startAnimation = useCallback(
    (target: number) => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }

      targetRef.current = target;
      startTimeRef.current = 0;
      setCurrentScore(0);
      setIsAnimating(true);

      const begin = () => {
        animationRef.current = requestAnimationFrame(animate);
      };

      if (startDelay > 0) {
        setTimeout(begin, startDelay);
      } else {
        begin();
      }
    },
    [animate, startDelay]
  );

  const reset = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    setCurrentScore(0);
    setIsAnimating(false);
    startTimeRef.current = 0;
  }, []);

  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  return { currentScore, isAnimating, startAnimation, reset };
}

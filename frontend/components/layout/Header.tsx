"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { ConnectButton } from "@/components/wallet/ConnectButton";
import { useWallet } from "@/hooks/useWallet";
import { cn, formatAddress, formatAmount } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  newTab?: boolean;
  badge?: string;
}

// Landing page nav items (4 items, no Dashboard)
const landingNavItems: NavItem[] = [
  { href: "/shield", label: "SHIELD" },
  { href: "/unshield", label: "WITHDRAW" },
  { href: "/private-swap", label: "SWAP" },
  { href: "/history", label: "HISTORY" },
];

// Dashboard/App nav items (5 items, includes Dashboard)
const appNavItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/shield", label: "Shield" },
  { href: "/unshield", label: "Withdraw" },
  { href: "/private-swap", label: "Swap" },
  { href: "/history", label: "History" },
];

export function Header() {
  const pathname = usePathname();
  const { connected, publicKey, balance } = useWallet();

  // Determine if on landing page (show landing header style)
  const isLandingPage = pathname === "/" || pathname === "/home";

  // Track if header animation has played this session
  const [hasAnimated, setHasAnimated] = useState(true);

  useEffect(() => {
    const animated = sessionStorage.getItem("header_animated");
    if (!animated) {
      setHasAnimated(false);
      sessionStorage.setItem("header_animated", "true");
    }
  }, []);

  // Choose nav items based on context
  const navItems = isLandingPage ? landingNavItems : appNavItems;

  // Landing page header style
  if (isLandingPage) {
    return (
      <motion.header
        initial={hasAnimated ? false : { y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="fixed top-0 left-0 right-0 z-50 bg-bg/85 backdrop-blur-xl border-b border-terminal-green/10"
      >
        <div className="max-w-7xl mx-auto px-[50px]">
          <div className="flex items-center justify-between h-[72px]">
            {/* Logo - lowercase with blinking cursor */}
            <Link href="/home" className="flex items-center">
              <span className="animate-cursor-blink text-terminal-green mr-2" style={{ textShadow: "0 0 15px #00a088" }}>{">"}</span>
              <span
                className="text-terminal-green font-heading text-[22px] font-bold tracking-[2px]"
                style={{ textShadow: "0 0 25px #00a088, 0 0 50px rgba(0, 160, 136, 0.3)" }}
              >
                whalevault
              </span>
            </Link>

            {/* Centered Landing Nav - white text with glow on active */}
            <nav className="hidden md:flex items-center gap-[50px] absolute left-1/2 -translate-x-1/2">
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "font-heading text-[11px] tracking-[3px] uppercase transition-all duration-300",
                      isActive
                        ? "text-terminal-green"
                        : "text-white hover:text-terminal-green"
                    )}
                    style={isActive ? { textShadow: "0 0 20px #00a088, 0 0 40px rgba(0, 160, 136, 0.4)" } : undefined}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <ConnectButton />
          </div>
        </div>
      </motion.header>
    );
  }

  // Dashboard/App header style
  return (
    <motion.header
      initial={hasAnimated ? false : { y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="fixed top-0 left-0 right-0 z-50 bg-bg/85 backdrop-blur-xl border-b border-terminal-green/10"
    >
      <div className="max-w-7xl mx-auto px-[50px]">
        <div className="flex items-center justify-between h-[72px]">
          {/* Logo - > whalevault */}
          <Link href="/home" className="flex items-center">
            <span className="animate-cursor-blink text-terminal-green mr-2" style={{ textShadow: "0 0 15px #00a088" }}>{">"}</span>
            <span
              className="text-terminal-green font-heading text-[22px] font-bold tracking-[2px]"
              style={{ textShadow: "0 0 25px #00a088, 0 0 50px rgba(0, 160, 136, 0.3)" }}
            >
              whalevault
            </span>
          </Link>

          {/* Centered App Nav - white text, pill styling for active */}
          <nav className="hidden md:flex items-center gap-2 absolute left-1/2 -translate-x-1/2">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "px-5 py-2.5 rounded-md text-[13px] tracking-wider transition-all duration-200",
                    isActive
                      ? "bg-terminal-green/10 text-terminal-green"
                      : "text-white hover:text-terminal-green hover:bg-white/[0.02]"
                  )}
                  style={isActive ? { textShadow: "0 0 15px #00a088" } : undefined}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Wallet display when connected, otherwise Connect button */}
          {connected && publicKey ? (
            <div className="text-[13px] text-text-dim px-4 py-2.5 bg-bg-card border border-border rounded-md flex items-center gap-2">
              <span className="text-terminal-green" style={{ textShadow: "0 0 10px #00a088" }}>◎</span>
              <span>{formatAmount(balance, 4)} SOL</span>
              <span className="text-text-muted">·</span>
              <span>{formatAddress(publicKey)}</span>
            </div>
          ) : (
            <ConnectButton />
          )}
        </div>
      </div>
    </motion.header>
  );
}

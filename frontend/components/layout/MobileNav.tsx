"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
}

const landingNavItems: NavItem[] = [
  { href: "/shield", label: "SHIELD" },
  { href: "/send", label: "SEND" },
  { href: "/private-swap", label: "SWAP" },
  { href: "/history", label: "HISTORY" },
];

const appNavItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/shield", label: "Shield" },
  { href: "/send", label: "Send" },
  { href: "/private-swap", label: "Swap" },
  { href: "/history", label: "History" },
];

function Overlay({
  navItems,
  pathname,
  onClose,
}: {
  navItems: NavItem[];
  pathname: string;
  onClose: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: "100%" }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: "100%" }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="fixed inset-0 z-[9999] backdrop-blur-xl flex flex-col items-center justify-center"
      style={{ backgroundColor: "rgba(8, 12, 18, 0.97)" }}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-5 left-4 w-11 h-11 flex items-center justify-center"
        aria-label="Close menu"
      >
        <span className="block w-6 h-[2px] bg-terminal-green rotate-45 absolute" />
        <span className="block w-6 h-[2px] bg-terminal-green -rotate-45 absolute" />
      </button>

      <nav className="flex flex-col items-center gap-8">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={cn(
                "font-heading text-2xl tracking-[4px] uppercase transition-colors min-h-[44px] flex items-center",
                isActive
                  ? "text-terminal-green"
                  : "text-white hover:text-terminal-green"
              )}
              style={
                isActive
                  ? { textShadow: "0 0 20px #00a088, 0 0 40px rgba(0, 160, 136, 0.4)" }
                  : undefined
              }
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </motion.div>
  );
}

export function MobileNav({ isLanding }: { isLanding: boolean }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();
  const navItems = isLanding ? landingNavItems : appNavItems;

  const close = useCallback(() => setOpen(false), []);

  // Client-side mount for portal
  useEffect(() => setMounted(true), []);

  // Close on route change
  useEffect(() => {
    close();
  }, [pathname, close]);

  // Escape key handler
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, close]);

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <div className="md:hidden">
      {/* Hamburger Button */}
      <button
        onClick={() => setOpen(!open)}
        className="relative z-[70] flex flex-col justify-center items-center w-11 h-11 gap-[5px]"
        aria-label={open ? "Close menu" : "Open menu"}
      >
        <span
          className={cn(
            "block w-5 h-[2px] bg-terminal-green transition-all duration-300",
            open && "translate-y-[7px] rotate-45"
          )}
        />
        <span
          className={cn(
            "block w-5 h-[2px] bg-terminal-green transition-all duration-300",
            open && "opacity-0"
          )}
        />
        <span
          className={cn(
            "block w-5 h-[2px] bg-terminal-green transition-all duration-300",
            open && "-translate-y-[7px] -rotate-45"
          )}
        />
      </button>

      {/* Fullscreen Overlay — portaled to body to escape header's transform stacking context */}
      {mounted &&
        createPortal(
          <AnimatePresence>
            {open && (
              <Overlay navItems={navItems} pathname={pathname} onClose={close} />
            )}
          </AnimatePresence>,
          document.body
        )}
    </div>
  );
}

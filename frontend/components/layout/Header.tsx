"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { ConnectButton } from "@/components/wallet/ConnectButton";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  newTab?: boolean;
  badge?: string;
}

const navItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/shield", label: "Shield" },
  { href: "/unshield", label: "Stealth Withdraw" },
  { href: "/private-swap", label: "Private Swap" },
  { href: "/private-yield", label: "Private Yield", newTab: true, badge: "Soon" },
  { href: "/history", label: "History" },
];

export function Header() {
  const pathname = usePathname();

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="fixed top-0 left-0 right-0 z-50"
    >
      <div className="mx-4 mt-4">
        <div className="max-w-7xl mx-auto px-6 py-4 rounded-2xl bg-black/40 backdrop-blur-xl border border-white/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-8">
              <Link href="/" className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-whale-500 to-vault-500 flex items-center justify-center">
                  <svg
                    className="w-6 h-6 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                    />
                  </svg>
                </div>
                <span className="text-xl font-bold text-white">WhaleVault</span>
              </Link>

              <nav className="hidden md:flex items-center gap-1">
                {navItems.map((item) => {
                  const isActive = pathname === item.href;
                  const linkProps = item.newTab
                    ? { target: "_blank", rel: "noopener noreferrer" }
                    : {};
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      {...linkProps}
                      className={cn(
                        "relative px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                        isActive
                          ? "text-white"
                          : "text-gray-400 hover:text-white hover:bg-white/5"
                      )}
                    >
                      {isActive && (
                        <motion.div
                          layoutId="activeNav"
                          className="absolute inset-0 rounded-lg bg-white/10"
                          transition={{ type: "spring", duration: 0.5 }}
                        />
                      )}
                      <span className="relative z-10 flex items-center gap-1.5">
                        {item.label}
                        {item.badge && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-whale-500/20 text-whale-400 font-medium">
                            {item.badge}
                          </span>
                        )}
                        {item.newTab && (
                          <svg className="w-3 h-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        )}
                      </span>
                    </Link>
                  );
                })}
              </nav>
            </div>

            <ConnectButton />
          </div>
        </div>
      </div>
    </motion.header>
  );
}

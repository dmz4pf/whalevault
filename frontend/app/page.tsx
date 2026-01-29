"use client";

import { BinaryRain, HexStream } from "@/components/effects";
import Link from "next/link";

export default function SplashPage() {
  return (
    <div className="fixed inset-0 overflow-hidden">
      {/* Background Effects */}
      <BinaryRain opacity={0.05} />
      <HexStream opacity={0.12} />

      {/* Vignette */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          zIndex: 2,
          background:
            "radial-gradient(ellipse at center, transparent 30%, rgba(0, 0, 0, 0.7) 100%)",
        }}
      />

      {/* Glow overlay - FIXED COLOR */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          zIndex: 3,
          background:
            "radial-gradient(ellipse at 50% 40%, rgba(0, 160, 136, 0.04) 0%, transparent 50%)",
        }}
      />

      {/* Main Content */}
      <div className="relative h-full flex flex-col" style={{ zIndex: 10 }}>
        {/* Navigation */}
        <nav
          className="px-12 md:px-16 py-6 flex justify-between items-center border-b"
          style={{
            background: "rgba(5, 5, 8, 0.7)",
            backdropFilter: "blur(20px)",
            borderColor: "rgba(0, 160, 136, 0.15)",
          }}
        >
          <div className="flex items-center gap-3 text-xl text-terminal-green tracking-wider font-mono">
            <span className="animate-blink">&gt;</span>
            <span
              style={{
                textShadow: "0 0 15px var(--terminal-green)",
              }}
            >
              whalevault
            </span>
          </div>

          <div className="hidden md:flex gap-10">
            {["shield", "withdraw", "swap", "history", "docs"].map((link) => (
              <Link
                key={link}
                href={link === "docs" ? "https://docs.whalevault.io" : `/${link}`}
                className="text-white text-[13px] tracking-wider transition-all duration-300 relative group"
                target={link === "docs" ? "_blank" : undefined}
              >
                <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-terminal-dark">
                  ./
                </span>
                <span className="group-hover:text-terminal-green group-hover:drop-shadow-[0_0_10px_var(--terminal-green)] transition-all duration-300">
                  {link}
                </span>
              </Link>
            ))}
          </div>
        </nav>

        {/* Main CTA Section */}
        <section className="flex-1 flex flex-col items-center justify-center text-center px-8 md:px-16">
          <h1 className="font-heading font-normal text-5xl md:text-6xl lg:text-7xl mb-6">
            Initialize{" "}
            <span
              className="text-terminal-green"
              style={{
                textShadow: "0 0 40px rgba(0, 160, 136, 0.5)",
              }}
            >
              privacy
            </span>
          </h1>

          <p className="text-text-dim text-lg md:text-xl tracking-wider mb-12">
            Your financial sovereignty awaits.
          </p>

          <Link
            href="/landing"
            className="font-mono bg-transparent border border-terminal-green text-terminal-green px-12 py-5 text-base md:text-lg cursor-pointer transition-all duration-300 inline-block hover:bg-terminal-green hover:text-[#050508]"
            style={{
              textShadow: "0 0 8px var(--terminal-green)",
              boxShadow: "0 0 25px rgba(0, 160, 136, 0.15)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.textShadow = "none";
              e.currentTarget.style.boxShadow = "0 0 50px rgba(0, 160, 136, 0.4)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.textShadow = "0 0 8px var(--terminal-green)";
              e.currentTarget.style.boxShadow = "0 0 25px rgba(0, 160, 136, 0.15)";
            }}
          >
            ./launch-app
          </Link>
        </section>

        {/* Footer */}
        <footer
          className="px-12 md:px-16 py-8 border-t flex flex-col md:flex-row justify-between items-center gap-6"
          style={{
            background: "rgba(5, 5, 8, 0.5)",
            borderColor: "rgba(0, 160, 136, 0.1)",
          }}
        >
          <div
            className="text-lg text-terminal-green"
            style={{
              textShadow: "0 0 15px rgba(0, 160, 136, 0.3)",
            }}
          >
            &gt; whalevault
          </div>

          <div className="flex gap-8 md:gap-12">
            {[
              { label: "Documentation", href: "https://docs.whalevault.io" },
              { label: "GitHub", href: "https://github.com" },
              { label: "Discord", href: "https://discord.com" },
              { label: "Twitter", href: "https://twitter.com" },
            ].map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="font-heading text-white text-xs tracking-[2px] transition-colors duration-300 hover:text-terminal-green"
                target="_blank"
                rel="noopener noreferrer"
              >
                {link.label}
              </a>
            ))}
          </div>
        </footer>
      </div>

      <style jsx>{`
        @keyframes blink {
          0%,
          50% {
            opacity: 1;
          }
          51%,
          100% {
            opacity: 0;
          }
        }
        .animate-blink {
          animation: blink 1s infinite;
        }
      `}</style>
    </div>
  );
}

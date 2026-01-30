"use client";

import { Share_Tech_Mono, Chakra_Petch } from "next/font/google";
import { usePathname } from "next/navigation";
import { Toaster } from "sonner";
import { WalletProvider } from "@/components/wallet/WalletProvider";
import { WalletRedirect } from "@/components/wallet/WalletRedirect";
import { Header } from "@/components/layout/Header";
import { ErrorBoundary } from "@/components/feedback/ErrorBoundary";
import { BinaryRain, HexStream, CRTEffects } from "@/components/effects";
import "./globals.css";

const shareTechMono = Share_Tech_Mono({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-mono",
});

const chakraPetch = Chakra_Petch({
  weight: ["300", "400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-heading",
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const isSplash = pathname === "/";

  return (
    <html lang="en" className="dark">
      <body className={`${shareTechMono.variable} ${chakraPetch.variable} font-mono`}>
        <WalletProvider>
          <WalletRedirect />
          {/* Background Effects - only on non-splash pages */}
          {!isSplash && (
            <>
              <BinaryRain opacity={0.05} />
              <HexStream opacity={0.1} />
              <CRTEffects />
              <div
                className="fixed inset-0 pointer-events-none z-[3]"
                style={{
                  background: 'radial-gradient(ellipse at 50% 40%, rgba(0, 160, 136, 0.04) 0%, transparent 50%)'
                }}
              />
            </>
          )}

          <div className="relative min-h-screen" style={{ zIndex: 10 }}>
            {!isSplash && <Header />}

            <main className={isSplash ? "" : "pt-28 pb-16 px-4"}>
              <div className={isSplash ? "" : "max-w-7xl mx-auto"}>
                <ErrorBoundary>{children}</ErrorBoundary>
              </div>
            </main>
          </div>

          <Toaster
            position="bottom-right"
            toastOptions={{
              unstyled: true,
              classNames: {
                toast: "bg-[#0d1117] border border-terminal-green/30 rounded-md p-4 flex items-start gap-3 font-mono text-sm shadow-[0_0_20px_rgba(0,160,136,0.15)]",
                title: "text-white font-medium",
                description: "text-text-dim text-xs mt-1",
                success: "border-terminal-green/50 shadow-[0_0_25px_rgba(0,160,136,0.25)]",
                error: "border-red-500/50 shadow-[0_0_25px_rgba(239,68,68,0.2)]",
                icon: "mt-0.5",
              },
            }}
            icons={{
              success: <span className="text-terminal-green text-lg" style={{ textShadow: "0 0 10px #00a088" }}>✓</span>,
              error: <span className="text-red-500 text-lg">✗</span>,
              loading: <span className="text-terminal-green animate-pulse">◉</span>,
            }}
          />
        </WalletProvider>
      </body>
    </html>
  );
}

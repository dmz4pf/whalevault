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
              style: {
                background: "var(--bg-card)",
                border: "1px solid var(--border)",
                color: "var(--text)",
              },
            }}
          />
        </WalletProvider>
      </body>
    </html>
  );
}

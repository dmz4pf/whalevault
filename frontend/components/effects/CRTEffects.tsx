"use client";

export function CRTEffects() {
  return (
    <>
      {/* Vignette overlay */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          zIndex: 2,
          background: "radial-gradient(ellipse at center, transparent 40%, rgba(0, 0, 0, 0.4) 100%)",
        }}
      />

      {/* Screen flicker */}
      <div
        className="fixed inset-0 pointer-events-none animate-flicker"
        style={{
          zIndex: 999,
          background: "#00a088",
          opacity: 0.008,
        }}
      />

      {/* Scanlines */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          zIndex: 1000,
          background: "repeating-linear-gradient(0deg, rgba(0, 0, 0, 0.03), rgba(0, 0, 0, 0.03) 1px, transparent 1px, transparent 2px)",
        }}
      />
    </>
  );
}

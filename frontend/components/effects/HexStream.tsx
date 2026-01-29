"use client";

interface HexStreamProps {
  opacity?: number;
  className?: string;
}

const rows = [
  { top: "5%", content: "0x7f3a9d2b 0xa2c84e1f 0x9b4d7c3e 0xc4e12f8a 0x5e7b3d9c 0x8f2a6b4d 0x1c9e5f7a 0x3b8d4e2c", direction: "left", duration: 40 },
  { top: "15%", content: "shield(proof) zkSNARK.verify() nullifier.hash() merkle.insert() stealth.generate() withdraw(addr)", direction: "right", duration: 35 },
  { top: "25%", content: "0x2d6f8a4b 0xe5c17b9d 0x4a8e2f6c 0xb7d93c5e 0x6f1a4d8b 0xc2e57a3f 0x9d4b8e6a 0x3f7c2a9e", direction: "left", duration: 45 },
  { top: "35%", content: "privacy.shield() pool.deposit() proof.generate() relayer.submit() commitment.add()", direction: "right", duration: 38 },
  { top: "55%", content: "0x8c5e2a7d 0x1f9b4d6e 0xa3e78c5b 0x6d2f9a4c 0xe7b35d8a 0x4c9a2e6f 0xb5d87c3a 0x2a6e4f9d", direction: "left", duration: 42 },
  { top: "65%", content: "swap.execute() balance.update() state.commit() circuit.prove() verify.output()", direction: "right", duration: 36 },
  { top: "75%", content: "0xf4a28e6d 0x7c3b9d5a 0x2e8f4a6c 0xd5b17c9e 0x9a6e3f8b 0x4d2c7a5f 0xb8e93d6a 0x1f5a8c4e", direction: "left", duration: 44 },
  { top: "85%", content: "zk.witness() input.hash() output.encrypt() tx.broadcast() block.confirm()", direction: "right", duration: 40 },
];

export function HexStream({ opacity = 0.1, className = "" }: HexStreamProps) {
  return (
    <div
      className={`fixed inset-0 overflow-hidden pointer-events-none ${className}`}
      style={{ zIndex: 1, opacity }}
    >
      {rows.map((row, i) => (
        <div
          key={i}
          className="absolute whitespace-nowrap font-mono text-xs text-terminal-green"
          style={{
            top: row.top,
            animation: `scroll${row.direction === "left" ? "Left" : "Right"} ${row.duration}s linear infinite`,
            textShadow: "0 0 8px #00a088",
          }}
        >
          {row.content} {row.content}
        </div>
      ))}
    </div>
  );
}

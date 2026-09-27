import type { ReactNode } from "react";
import { artTitle, seeded, type ArtTheme } from "@/lib/trips/art";

/**
 * An illustrated, gently animated cover: a scene for the destination (beach,
 * mountains, desert or city) with its name across it. Pure SVG + CSS, so it
 * is sharp on any screen and fills any shape — the scene is drawn on a wide
 * 1600×600 canvas with everything important in the middle band, and the box
 * crops around that (phones see the middle, laptops a wide strip). The name
 * is sized from the box itself (container units). Motion stops for
 * "reduce motion" and in print. Works on the server too (no hooks).
 */
export function DestinationArt({ theme, destination, name, titleAt = "center", children }: {
  theme: ArtTheme;
  destination: string;
  name: string;
  titleAt?: "top" | "center" | "none";
  children?: ReactNode;
}) {
  const title = artTitle(destination, name);
  const rnd = seeded(`${theme}:${title.toLowerCase()}`);
  const id = `a${Math.floor(rnd() * 1e9).toString(36)}`;
  const P = PALETTE[theme];

  return (
    <div className="dest-art" style={{ position: "absolute", inset: 0, containerType: "size", overflow: "hidden", background: P.sky[1] }}>
      <svg viewBox="0 0 1600 600" preserveAspectRatio="xMidYMid slice" width="100%" height="100%" aria-hidden style={{ display: "block" }}>
        <defs>
          <linearGradient id={`${id}sky`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={P.sky[0]} />
            <stop offset="1" stopColor={P.sky[1]} />
          </linearGradient>
          <radialGradient id={`${id}sun`}>
            <stop offset="0" stopColor={P.sun} stopOpacity="1" />
            <stop offset="0.45" stopColor={P.sun} stopOpacity="0.55" />
            <stop offset="1" stopColor={P.sun} stopOpacity="0" />
          </radialGradient>
          <linearGradient id={`${id}sea`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#3fb4c4" />
            <stop offset="1" stopColor="#1d6f8c" />
          </linearGradient>
        </defs>
        <style>{`
          .dest-art .cloud { animation: da-drift linear infinite; }
          .dest-art .sun { animation: da-glow 6s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
          .dest-art .wave { animation: da-wave 7s linear infinite; }
          .dest-art .wave2 { animation-duration: 11s; animation-direction: reverse; }
          .dest-art .sway { animation: da-sway 5s ease-in-out infinite; transform-box: fill-box; transform-origin: 50% 100%; }
          .dest-art .bob { animation: da-bob 4s ease-in-out infinite; }
          .dest-art .bird { animation: da-fly 26s linear infinite; }
          .dest-art .plane { animation: da-plane 38s linear infinite; }
          .dest-art .tw { animation: da-tw 3s ease-in-out infinite; }
          .dest-art .mist { animation: da-mist 18s ease-in-out infinite alternate; }
          @keyframes da-drift { from { transform: translateX(-420px); } to { transform: translateX(1900px); } }
          @keyframes da-glow { 0%,100% { transform: scale(1); opacity: .95; } 50% { transform: scale(1.06); opacity: 1; } }
          @keyframes da-wave { from { transform: translateX(0); } to { transform: translateX(-200px); } }
          @keyframes da-sway { 0%,100% { transform: rotate(-2deg); } 50% { transform: rotate(2.5deg); } }
          @keyframes da-bob { 0%,100% { transform: translateY(0); } 50% { transform: translateY(6px); } }
          @keyframes da-fly { from { transform: translate(-200px, 0); } to { transform: translate(1900px, -60px); } }
          @keyframes da-plane { from { transform: translate(-260px, 40px); } to { transform: translate(1900px, -40px); } }
          @keyframes da-tw { 0%,100% { opacity: .25; } 50% { opacity: 1; } }
          @keyframes da-mist { from { transform: translateX(-60px); } to { transform: translateX(60px); } }
          @media (prefers-reduced-motion: reduce) { .dest-art * { animation: none !important; } }
          @media print { .dest-art * { animation: none !important; } }
        `}</style>

        <rect width="1600" height="600" fill={`url(#${id}sky)`} />
        {theme === "city" && <Stars rnd={rnd} />}
        <circle className="sun" cx={P.sunAt[0]} cy={P.sunAt[1]} r={P.sunR * 2.2} fill={`url(#${id}sun)`} />
        <circle cx={P.sunAt[0]} cy={P.sunAt[1]} r={P.sunR} fill={P.sun} />
        <Clouds rnd={rnd} color={P.cloud} />
        <Plane />
        <Birds color={P.bird} />

        {theme === "beach" && <Beach id={id} />}
        {theme === "mountains" && <Mountains rnd={rnd} />}
        {theme === "desert" && <Desert rnd={rnd} />}
        {theme === "city" && <City rnd={rnd} />}
      </svg>

      {titleAt !== "none" && (
        <div style={{ position: "absolute", left: 0, right: 0, top: titleAt === "top" ? "10%" : "50%", transform: titleAt === "top" ? "none" : "translateY(-60%)", textAlign: "center", padding: "0 6%", pointerEvents: "none" }}>
          <span className="display" style={{
            display: "inline-block", maxWidth: "100%", color: "#fff", fontWeight: 700, lineHeight: 1,
            fontSize: "clamp(18px, min(9cqw, 24cqh), 110px)", letterSpacing: "0.04em", textTransform: "uppercase",
            textShadow: "0 2px 18px rgba(0,0,0,.35), 0 1px 3px rgba(0,0,0,.35)", overflowWrap: "anywhere",
          }}>{title}</span>
        </div>
      )}
      {children}
    </div>
  );
}

const PALETTE: Record<ArtTheme, { sky: [string, string]; sun: string; sunAt: [number, number]; sunR: number; cloud: string; bird: string }> = {
  beach: { sky: ["#6cc6e8", "#d9f3f4"], sun: "#ffe08a", sunAt: [1130, 250], sunR: 46, cloud: "#ffffff", bird: "#2d4a5a" },
  mountains: { sky: ["#7fa9d9", "#e8eef6"], sun: "#fff4d6", sunAt: [1040, 205], sunR: 38, cloud: "#ffffff", bird: "#34465e" },
  desert: { sky: ["#f28c5a", "#fbd9a4"], sun: "#fff1c9", sunAt: [800, 330], sunR: 70, cloud: "#fde6cc", bird: "#7a3b24" },
  city: { sky: ["#2b2d63", "#f08f6a"], sun: "#ffd28c", sunAt: [520, 400], sunR: 58, cloud: "#f6b8a3", bird: "#2b2346" },
};

function Clouds({ rnd, color }: { rnd: () => number; color: string }) {
  const clouds = [0, 1, 2, 3].map((i) => ({ y: 70 + rnd() * 150, s: 0.6 + rnd() * 0.7, dur: 55 + rnd() * 40, delay: -rnd() * 90 - i * 20 }));
  return (
    <>
      {clouds.map((c, i) => (
        <g key={i} className="cloud" style={{ animationDuration: `${c.dur}s`, animationDelay: `${c.delay}s` }} opacity={0.85}>
          <g transform={`translate(0 ${c.y}) scale(${c.s})`} fill={color}>
            <ellipse cx="60" cy="30" rx="60" ry="22" />
            <ellipse cx="110" cy="18" rx="46" ry="28" />
            <ellipse cx="160" cy="32" rx="52" ry="20" />
          </g>
        </g>
      ))}
    </>
  );
}

function Birds({ color }: { color: string }) {
  const bird = (x: number, y: number, s: number) => (
    <path d={`M${x} ${y} q${6 * s} ${-6 * s} ${12 * s} 0 q${6 * s} ${-6 * s} ${12 * s} 0`} fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
  );
  return (
    <g className="bird" style={{ animationDelay: "-8s" }}>
      {bird(0, 150, 1.2)}{bird(34, 136, 1)}{bird(60, 160, 0.9)}
    </g>
  );
}

function Plane() {
  return (
    <g className="plane" style={{ animationDelay: "-12s" }} opacity={0.9}>
      <path d="M-220 118 C-150 112 -80 106 -20 100" fill="none" stroke="#fff" strokeWidth="2" strokeDasharray="6 8" opacity={0.7} />
      <g transform="translate(0 100) rotate(-4)" fill="#fff">
        <path d="M0 0 L34 -3 L42 0 L34 3 Z" />
        <path d="M14 -1 L6 -16 L12 -16 L24 -1 Z" />
        <path d="M14 1 L6 16 L12 16 L24 1 Z" />
        <path d="M2 0 L-2 -8 L3 -8 L8 0 Z" />
      </g>
    </g>
  );
}

function Stars({ rnd }: { rnd: () => number }) {
  return (
    <>
      {Array.from({ length: 26 }, (_, i) => (
        <circle key={i} className="tw" cx={rnd() * 1600} cy={rnd() * 200} r={1 + rnd() * 1.6} fill="#fff" style={{ animationDelay: `${-rnd() * 3}s` }} />
      ))}
    </>
  );
}

function Beach({ id }: { id: string }) {
  const wave = (y: number, cls: string, color: string) => (
    <path className={`wave ${cls}`} d={`M0 ${y} ${Array.from({ length: 10 }, (_, i) => `q50 -14 100 0 t100 0`).join(" ")} V600 H0 Z`} transform="translate(0 0)" fill={color} />
  );
  return (
    <>
      <rect y="360" width="1600" height="240" fill={`url(#${id}sea)`} />
      <g opacity={0.55}>{wave(380, "", "#8fdbe3")}</g>
      <g opacity={0.5}>{wave(420, "wave2", "#5cc3d2")}</g>
      <g className="bob">
        <path d="M600 372 h90 l-14 18 h-62 Z" fill="#fff" />
        <path d="M640 370 V300 L690 364 Z" fill="#fff" opacity={0.95} />
        <path d="M636 370 V312 L604 364 Z" fill="#ffd9a0" />
      </g>
      <path d="M0 520 C300 470 620 500 900 488 C1150 478 1400 470 1600 490 V600 H0 Z" fill="#f3dca8" />
      <path d="M0 548 C400 520 800 540 1600 522 V600 H0 Z" fill="#e8c989" />
      <Palm x={1200} y={500} h={210} />
      <Palm x={1290} y={506} h={160} flip />
    </>
  );
}

function Palm({ x, y, h, flip = false, color = "#1f5d4a" }: { x: number; y: number; h: number; flip?: boolean; color?: string }) {
  const d = flip ? -1 : 1;
  const tx = x + d * 26;
  const ty = y - h;
  return (
    <g className="sway" style={{ animationDelay: flip ? "-2s" : "0s" }}>
      <path d={`M${x} ${y} Q${x + d * 6} ${y - h / 2} ${tx} ${ty}`} stroke="#6b4a2b" strokeWidth={9} fill="none" strokeLinecap="round" />
      {[-150, -110, -60, -20, 20].map((a, i) => {
        const r = (a * Math.PI) / 180;
        const ex = tx + Math.cos(r) * 90 * d;
        const ey = ty + Math.sin(r) * 60 + 30;
        return <path key={i} d={`M${tx} ${ty} Q${(tx + ex) / 2} ${ty - 30} ${ex} ${ey}`} stroke={color} strokeWidth={11} fill="none" strokeLinecap="round" />;
      })}
    </g>
  );
}

function ridge(rnd: () => number, base: number, amp: number, steps: number): { d: string; peaks: [number, number][] } {
  const pts: [number, number][] = [];
  for (let i = 0; i <= steps; i++) pts.push([(1600 / steps) * i, base - (0.35 + rnd() * 0.65) * amp]);
  const peaks = pts.filter((p, i) => i > 0 && i < steps && p[1] < pts[i - 1][1] && p[1] < pts[i + 1][1]);
  return { d: `M0 600 L${pts.map((p) => p.join(" ")).join(" L")} L1600 600 Z`, peaks };
}

function Mountains({ rnd }: { rnd: () => number }) {
  const back = ridge(rnd, 400, 240, 7);
  const mid = ridge(rnd, 460, 200, 9);
  const front = ridge(rnd, 540, 120, 12);
  return (
    <>
      <path d={back.d} fill="#9fb3cf" />
      {back.peaks.map(([x, y], i) => <path key={i} d={`M${x} ${y} l-34 40 l16 -6 l18 10 l16 -12 l18 8 Z`} fill="#fff" opacity={0.9} />)}
      <g className="mist"><rect x="-100" y="380" width="1800" height="60" fill="#fff" opacity={0.28} rx="30" /></g>
      <path d={mid.d} fill="#5f7fa6" />
      {mid.peaks.map(([x, y], i) => <path key={i} d={`M${x} ${y} l-26 30 l12 -4 l14 8 l12 -9 l14 6 Z`} fill="#fff" opacity={0.8} />)}
      <path d={front.d} fill="#2f4d63" />
      {Array.from({ length: 14 }, (_, i) => {
        const x = 40 + i * 115 + rnd() * 50;
        const s = 0.7 + rnd() * 0.6;
        return <path key={i} className="sway" style={{ animationDelay: `${-rnd() * 5}s` }} d={`M${x} ${600 - 20} l${-18 * s} 0 l${18 * s} ${-70 * s} l${18 * s} ${70 * s} Z`} fill="#1d3444" />;
      })}
    </>
  );
}

function Desert({ rnd }: { rnd: () => number }) {
  const dune = (base: number, amp: number, color: string) => {
    const a = base - amp * (0.4 + rnd() * 0.6);
    const b = base - amp * (0.4 + rnd() * 0.6);
    return <path d={`M0 ${base} C300 ${a} 560 ${b} 820 ${base - amp * 0.3} S1350 ${a} 1600 ${base - amp * 0.2} V600 H0 Z`} fill={color} />;
  };
  return (
    <>
      {dune(430, 80, "#e9a766")}
      {dune(480, 90, "#d98b4b")}
      <Palm x={330} y={500} h={120} color="#3d5a2a" />
      <Palm x={385} y={505} h={90} flip color="#3d5a2a" />
      {dune(540, 70, "#c4733a")}
      <g transform="translate(1080 470)" fill="#6d3b22">
        {/* a small caravan */}
        {[0, 70, 140].map((dx) => (
          <g key={dx} transform={`translate(${dx} 0)`}>
            <path d="M0 0 q6 -22 22 -22 q8 -14 18 0 q10 -6 14 6 l8 -18 l6 2 l-8 26 l0 22 l-4 0 l-2 -18 l-30 0 l-2 18 l-4 0 l0 -20 Z" />
          </g>
        ))}
      </g>
    </>
  );
}

function City({ rnd }: { rnd: () => number }) {
  const buildings: { x: number; w: number; h: number; tone: number }[] = [];
  for (let x = -20; x < 1620; ) {
    const w = 50 + rnd() * 70;
    const mid = Math.abs(x + w / 2 - 800) < 520;
    buildings.push({ x, w, h: (mid ? 120 : 80) + rnd() * (mid ? 200 : 140), tone: rnd() });
    x += w + 4;
  }
  const base = 500;
  return (
    <>
      {buildings.map((b, i) => (
        <path key={`b${i}`} d={`M${b.x + 18} ${base} v${-b.h * 0.8} h${b.w * 0.8} v${b.h * 0.8} Z`} fill="#3a2f5c" opacity={0.55} />
      ))}
      {buildings.map((b, i) => (
        <g key={i}>
          <rect x={b.x} y={base - b.h} width={b.w} height={b.h} fill={b.tone > 0.5 ? "#231d3d" : "#2c2450"} />
          {b.tone > 0.7 && <rect x={b.x + b.w / 2 - 2} y={base - b.h - 26} width={4} height={26} fill="#231d3d" />}
          {Array.from({ length: Math.floor(b.h / 34) }, (_, r) =>
            Array.from({ length: Math.floor(b.w / 22) }, (_, c) =>
              rnd() > 0.55 ? (
                <rect key={`${r}-${c}`} className={rnd() > 0.8 ? "tw" : undefined} style={{ animationDelay: `${-rnd() * 3}s` }}
                  x={b.x + 8 + c * 22} y={base - b.h + 14 + r * 34} width={9} height={13} fill="#ffd89a" opacity={0.85} />
              ) : null,
            ),
          )}
        </g>
      ))}
      <rect y={base} width="1600" height={100} fill="#171330" />
      <path d="M0 540 H1800" stroke="#ffd89a" strokeWidth={3} strokeDasharray="30 30" opacity={0.35} className="wave" />
    </>
  );
}

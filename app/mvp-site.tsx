"use client";

import { useRef, useState, type CSSProperties } from "react";
import type { Design, Mvp } from "@/lib/franken";

// A skin is stitched from the design of one or more dead startups:
// colours from one, typeface from the next, shapes and layout from others.
export type Skin = Design & { credits: { colours: string; type: string; shapes: string; layout: string } };

export const DEFAULT_SKIN: Skin = {
  primary: "#111111",
  accent: "#84cc16",
  background: "#e9e4d8",
  text: "#111111",
  font: "geometric sans",
  corners: "soft",
  layout: "centered",
  vibe: "generic startup template",
  credits: { colours: "nobody", type: "nobody", shapes: "nobody", layout: "nobody" },
};

export function mixSkin(donors: { startup: string; design: Design }[]): Skin {
  if (donors.length === 0) return DEFAULT_SKIN;
  const pick = (i: number) => donors[i % donors.length];
  const [c, t, s, l] = [pick(0), pick(1), pick(2), pick(3)];
  return {
    primary: c.design.primary,
    accent: c.design.accent,
    background: c.design.background,
    text: c.design.text,
    font: t.design.font,
    corners: s.design.corners,
    layout: l.design.layout,
    vibe: donors.map((d) => d.design.vibe).join("; "),
    credits: { colours: c.startup, type: t.startup, shapes: s.startup, layout: l.startup },
  };
}

// Typeface style -> a Google Font that carries it.
const FONTS: [string, string, string][] = [
  ["serif", "Playfair Display", "serif"],
  ["rounded", "Nunito", "sans-serif"],
  ["mono", "Space Mono", "monospace"],
  ["condensed", "Bebas Neue", "sans-serif"],
  ["hand", "Caveat", "cursive"],
  ["geometric", "Poppins", "sans-serif"],
];
function fontFor(style: string) {
  const s = style.toLowerCase();
  const [, family, fallback] = FONTS.find(([k]) => s.includes(k)) ?? FONTS[5];
  return {
    css: `'${family}', ${fallback}`,
    href: `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, "+")}:wght@400;700&display=swap`,
  };
}

const hex = (v: string, fallback: string) => (/^#[0-9a-fA-F]{3,8}$/.test(v.trim()) ? v.trim() : fallback);

function rgb(colour: string) {
  const h = colour.replace("#", "");
  const full = h.length === 3 ? h.split("").map((x) => x + x).join("") : h;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
}
const brightness = (colour: string) => {
  const [r, g, b] = rgb(colour);
  return (r * 299 + g * 587 + b * 114) / 1000;
};
// Near-black or off-white ink, whichever reads better on the given colour.
const inkOn = (colour: string) => (brightness(colour) > 150 ? "#141414" : "#f4f1ea");
// Blend two colours: t = 0 gives a, t = 1 gives b.
function mix(a: string, b: string, t: number) {
  const [x, y] = [rgb(a), rgb(b)];
  return "#" + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, "0")).join("");
}

// The generated MVP: a landing page for the stitched startup, wearing the
// harvested skin, shown in a fake browser. Inline styles only, so the page
// can be downloaded as standalone HTML straight from the DOM.
//
// House rules, so it does not look machine-made: no white backgrounds, no
// gradients, no emoji icons, no centred text, no row of three boxed cards.
// Flat colour blocks, left-aligned type, numbered rows, hairline rules.
export function MvpSite({ mvp, skin, score }: { mvp: Mvp; skin: Skin; score: number }) {
  const [joined, setJoined] = useState(false);
  const page = useRef<HTMLDivElement>(null);
  const domain = `${mvp.name.toLowerCase().replace(/[^a-z0-9]/g, "")}.ly`;

  const primary = hex(skin.primary, DEFAULT_SKIN.primary);
  const accent = hex(skin.accent, DEFAULT_SKIN.accent);
  const rawBg = hex(skin.background, DEFAULT_SKIN.background);
  // Never plain white: a near-white background becomes paper tinted with the brand colour.
  const bg = brightness(rawBg) > 235 ? mix("#e9e4d8", primary, 0.08) : rawBg;
  const text = inkOn(bg);
  // The hero is a flat block of the brand colour; if that is the page colour, use the accent.
  const block = Math.abs(brightness(primary) - brightness(bg)) < 40 ? accent : primary;
  const onBlock = inkOn(block);
  const rule = mix(bg, text, 0.25);

  const font = fontFor(skin.font);
  const c = skin.corners.toLowerCase();
  const radius = c.includes("sharp") ? 0 : c.includes("pill") ? 999 : 6;
  const l = skin.layout.toLowerCase();
  const layout = l.includes("split") ? "split" : l.includes("big") ? "big" : "stacked";

  const button: CSSProperties = {
    background: onBlock,
    color: block,
    border: "none",
    borderRadius: radius,
    padding: "15px 28px",
    fontSize: 18,
    fontWeight: 700,
    fontFamily: "inherit",
    cursor: "pointer",
  };

  const hero = (
    <div style={{ flex: "1 1 340px", background: block, color: onBlock, padding: "44px 36px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 15, fontWeight: 700, letterSpacing: 1 }}>
        <span style={{ width: 14, height: 14, background: onBlock, borderRadius: c.includes("sharp") ? 0 : 999 }} />
        {mvp.name.toUpperCase()}
      </div>
      <h1
        style={{
          margin: "56px 0 0",
          lineHeight: 0.98,
          fontWeight: 700,
          letterSpacing: -1,
          fontSize: layout === "big" ? "clamp(54px, 10vw, 120px)" : "clamp(40px, 6vw, 68px)",
          textTransform: layout === "big" ? "uppercase" : "none",
        }}
      >
        {mvp.tagline}
      </h1>
      <p style={{ fontSize: 19, lineHeight: 1.5, maxWidth: 560, margin: "22px 0 30px" }}>{mvp.pitch}</p>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 18 }}>
        <button style={button} onClick={() => setJoined(true)}>
          {joined ? "You are customer no. 1" : mvp.cta}
        </button>
        <span style={{ fontSize: 16 }}>{mvp.price}</span>
      </div>
    </div>
  );

  const features = (
    <div style={{ flex: "1 1 320px", padding: layout === "split" ? "44px 36px" : "12px 36px 36px" }}>
      {mvp.features.map((f, i) => (
        <div
          key={f.title}
          style={{ display: "flex", gap: 22, padding: "22px 0", borderTop: i === 0 && layout === "split" ? "none" : `1px solid ${rule}` }}
        >
          <span style={{ fontSize: 15, fontWeight: 700, color: mix(text, bg, 0.35), minWidth: 28, paddingTop: 5 }}>
            {String(i + 1).padStart(2, "0")}
          </span>
          <div>
            <div style={{ fontSize: 24, fontWeight: 700, lineHeight: 1.15 }}>{f.title}</div>
            <div style={{ fontSize: 17, lineHeight: 1.5, marginTop: 6, color: mix(text, bg, 0.2), maxWidth: 520 }}>{f.text}</div>
          </div>
        </div>
      ))}
    </div>
  );

  function download() {
    if (!page.current) return;
    const html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${mvp.name}</title><link rel="stylesheet" href="${font.href}"><body style="margin:0;background:${bg}">${page.current.outerHTML}</body>`;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([html], { type: "text/html" }));
    a.download = `${domain}.html`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="alive overflow-hidden rounded-3xl border-4 border-lime-400">
      <link rel="stylesheet" href={font.href} />
      <div className="flex items-center gap-3 bg-stone-800 px-4 py-2">
        <span className="text-sm">🔴 🟡 🟢</span>
        <span className="flex-1 truncate rounded-full bg-stone-900 px-4 py-1 text-sm text-stone-300">
          https://{domain}
        </span>
        <button onClick={download} className="rounded-full bg-lime-400 px-4 py-1 text-sm font-black text-black hover:bg-lime-300">
          ⬇️ Download site
        </button>
      </div>

      <div ref={page} style={{ background: bg, color: text, fontFamily: font.css, textAlign: "left" }}>
        <div style={{ display: "flex", flexWrap: "wrap", flexDirection: layout === "split" ? "row" : "column", alignItems: "stretch" }}>
          {hero}
          {features}
        </div>
        <div style={{ borderTop: `1px solid ${rule}`, padding: "14px 36px", fontSize: 13, color: mix(text, bg, 0.35) }}>
          Design harvested from dead startups. Colours: {skin.credits.colours}. Type: {skin.credits.type}. Shapes:{" "}
          {skin.credits.shapes}. Layout: {skin.credits.layout}. Success rating {score}%.
        </div>
      </div>
    </div>
  );
}

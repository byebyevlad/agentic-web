"use client";

import { useRef, useState, type CSSProperties } from "react";
import type { Design, Mvp } from "@/lib/franken";

// A skin is stitched from the design of one or more dead startups:
// colours from one, typeface from the next, shapes and layout from others.
export type Skin = Design & { credits: { colours: string; type: string; shapes: string; layout: string } };

export const DEFAULT_SKIN: Skin = {
  primary: "#111111",
  accent: "#84cc16",
  background: "#fafafa",
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

// Black or white, whichever reads better on the given colour.
function inkOn(colour: string) {
  const h = colour.replace("#", "");
  const full = h.length === 3 ? h.split("").map((x) => x + x).join("") : h;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? "#111111" : "#ffffff";
}

// The generated MVP: a landing page for the stitched startup, wearing the
// harvested skin, shown in a fake browser. Inline styles only, so the page
// can be downloaded as standalone HTML straight from the DOM.
export function MvpSite({ mvp, skin, score }: { mvp: Mvp; skin: Skin; score: number }) {
  const [joined, setJoined] = useState(false);
  const page = useRef<HTMLDivElement>(null);
  const domain = `${mvp.name.toLowerCase().replace(/[^a-z0-9]/g, "")}.ly`;

  const primary = hex(skin.primary, DEFAULT_SKIN.primary);
  const accent = hex(skin.accent, DEFAULT_SKIN.accent);
  const bg = hex(skin.background, DEFAULT_SKIN.background);
  const ink = hex(skin.text, inkOn(bg));
  const text = ink.toLowerCase() === bg.toLowerCase() ? inkOn(bg) : ink;
  const font = fontFor(skin.font);
  const c = skin.corners.toLowerCase();
  const radius = c.includes("sharp") ? 0 : c.includes("pill") ? 28 : 12;
  const btnRadius = c.includes("sharp") ? 0 : c.includes("pill") ? 999 : 12;
  const l = skin.layout.toLowerCase();
  const layout = l.includes("split") ? "split" : l.includes("big") ? "big" : "centered";

  const card: CSSProperties = {
    flex: "1 1 200px",
    background: inkOn(bg) === "#ffffff" ? "rgba(255,255,255,0.08)" : "#ffffff",
    border: `2px solid ${accent}`,
    borderRadius: radius,
    padding: 20,
    textAlign: "left",
  };
  const button: CSSProperties = {
    display: "inline-block",
    background: primary,
    color: inkOn(primary),
    border: "none",
    borderRadius: btnRadius,
    padding: "16px 34px",
    fontSize: 20,
    fontWeight: 700,
    fontFamily: "inherit",
    cursor: "pointer",
  };
  const headline: CSSProperties = {
    margin: "8px 0",
    lineHeight: 1,
    fontWeight: 700,
    color: primary === bg ? text : primary,
    fontSize: layout === "big" ? "clamp(56px, 11vw, 132px)" : "clamp(44px, 7vw, 76px)",
    textTransform: layout === "big" ? "uppercase" : "none",
  };

  const hero = (
    <div style={{ flex: "1 1 320px" }}>
      <div style={{ fontSize: 64 }}>{mvp.emoji}</div>
      <h1 style={headline}>{mvp.name}</h1>
      <p style={{ fontSize: 26, fontWeight: 700, margin: "6px 0" }}>{mvp.tagline}</p>
      <p style={{ fontSize: 18, opacity: 0.75, maxWidth: 640, margin: layout === "centered" ? "10px auto" : "10px 0" }}>
        {mvp.pitch}
      </p>
      <p style={{ fontSize: 20, fontWeight: 700, margin: "22px 0 10px" }}>{mvp.price}</p>
      <button style={button} onClick={() => setJoined(true)}>
        {joined ? "🎉 You're customer #1" : mvp.cta}
      </button>
    </div>
  );
  const features = (
    <div
      style={{
        flex: "1 1 320px",
        display: "flex",
        gap: 16,
        flexWrap: "wrap",
        flexDirection: layout === "centered" ? "row" : "column",
      }}
    >
      {mvp.features.map((f) => (
        <div key={f.title} style={card}>
          <div style={{ fontSize: 34 }}>{f.emoji}</div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>{f.title}</div>
          <div style={{ opacity: 0.75 }}>{f.text}</div>
        </div>
      ))}
    </div>
  );

  function download() {
    if (!page.current) return;
    const html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${mvp.name}</title><link rel="stylesheet" href="${font.href}"><body style="margin:0">${page.current.outerHTML}</body>`;
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

      <div ref={page} style={{ background: bg, color: text, fontFamily: font.css }}>
        <div style={{ height: 10, background: `linear-gradient(90deg, ${primary}, ${accent})` }} />
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 36,
            alignItems: "center",
            padding: "48px 28px",
            maxWidth: 1040,
            margin: "0 auto",
            flexDirection: layout === "split" ? "row" : "column",
            textAlign: layout === "centered" ? "center" : "left",
          }}
        >
          {hero}
          {features}
        </div>
        <div style={{ background: primary, color: inkOn(primary), padding: "14px 28px", fontSize: 14, textAlign: "center" }}>
          Skin harvested from the dead · colours: {skin.credits.colours} · type: {skin.credits.type} · shapes:{" "}
          {skin.credits.shapes} · layout: {skin.credits.layout} · success rating {score}%
        </div>
      </div>
    </div>
  );
}

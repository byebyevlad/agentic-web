"use client";

import { useEffect, useState } from "react";
import { JUDGES, type Mvp, type Startup, type Verdict } from "@/lib/franken";
import { MvpSite, mixSkin, type Skin } from "./mvp-site";

// EDIT ME: one-click prompts.
const IDEAS = [
  "💸 a financial product",
  "🍔 food delivery",
  "💘 a dating app",
  "🛴 scooter rental",
  "🥽 a VR thing",
  "📺 streaming service",
];

const ORGANS: Record<string, string> = {
  feature: "💪",
  pricing: "👛",
  "business model": "🧠",
  "go-to-market": "👄",
  team: "🫀",
  funding: "🩸",
  design: "🎨",
};
const organ = (kind: string) => ORGANS[kind.toLowerCase().trim()] ?? "🦴";

type Phase = "idle" | "digging" | "jury" | "lab";

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
  return data;
}

const key = (v: Verdict) => `${v.startup}::${v.part.name}`;

function rank(score: number, n: number) {
  if (n === 0) return "Drag organs onto the slab";
  if (score >= 85) return "🦄 Unicorn material";
  if (score >= 65) return "🚀 Fundable";
  if (score >= 45) return "🤨 Your mum would invest";
  if (score >= 25) return "🔥 Burning cash";
  return "⚰️ Dead on arrival";
}

export default function Home() {
  const [query, setQuery] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [startups, setStartups] = useState<Startup[]>([]);
  const [verdicts, setVerdicts] = useState<Verdict[]>([]);
  const [picked, setPicked] = useState<string[]>([]); // keys on the slab
  const [toast, setToast] = useState<{ good: boolean; text: string } | null>(null);
  const [hover, setHover] = useState(false);
  const [open, setOpen] = useState<Verdict | null>(null);
  const [mvp, setMvp] = useState<Mvp | null>(null);
  const [skin, setSkin] = useState<Skin>(mixSkin([]));
  const [building, setBuilding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const busy = phase === "digging" || phase === "jury";

  async function raise(q: string) {
    const prompt = q.trim();
    if (!prompt || busy) return;
    setQuery(prompt);
    setPhase("digging");
    setError(null);
    setStartups([]);
    setVerdicts([]);
    setPicked([]);
    setMvp(null);
    setToast(null);
    try {
      // 1. Parallel Responses: dig up dead startups and take them apart (~10s).
      const autopsy = await post<{ startups: Startup[] }>("/api/autopsy", { query: prompt });
      if (autopsy.startups.length === 0) throw new Error("The graveyard is empty. Try another idea.");
      setStartups(autopsy.startups);
      setPhase("jury");

      // 2. Parallel Decisions: a jury of three judges rules on every part.
      const all = await Promise.all(
        autopsy.startups.map((s) =>
          post<{ verdicts: Verdict[] }>("/api/decide", {
            startup: {
              ...s,
              // The startup's look is one more organ for the jury to judge.
              parts: [
                ...s.parts,
                {
                  name: `${s.name}'s look`,
                  kind: "design",
                  detail: `Its brand and website design: ${s.design.vibe}; ${s.design.font} type, ${s.design.corners} corners, ${s.design.layout} layout.`,
                },
              ],
            },
          }),
        ),
      );
      // Shuffle so good and bad organs are mixed on the tray.
      const flat = all.flatMap((d) => d.verdicts);
      setVerdicts(flat.sort((a, b) => (key(a).length * 7919) % 13 - (key(b).length * 7919) % 13));
      setPhase("lab");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setPhase("idle");
    }
  }

  function stitch(k: string) {
    const v = verdicts.find((x) => key(x) === k);
    if (!v || picked.includes(k)) return;
    setPicked((p) => [...p, k]);
    setMvp(null);
    setToast(
      v.keep
        ? { good: true, text: `⚡ ${v.part.name} twitches to life!` }
        : { good: false, text: `💀 ${v.part.name} is what killed ${v.startup}!` },
    );
  }
  const rip = (k: string) => {
    setPicked((p) => p.filter((x) => x !== k));
    setMvp(null);
  };
  const autoStitch = () => {
    setPicked(verdicts.filter((v) => v.keep).map(key));
    setMvp(null);
    setToast({ good: true, text: "🤖 The jury built it for you. Lazy." });
  };

  async function buildMvp() {
    setBuilding(true);
    setError(null);
    try {
      const looks = onSlab.filter((v) => v.part.kind === "design");
      const organs = onSlab.filter((v) => v.part.kind !== "design");
      const parts = (organs.length ? organs : onSlab).map((v) => ({
        name: v.part.name,
        detail: v.part.detail,
        startup: v.startup,
      }));
      // Stitch the skin from every look on the slab, in the order they were added.
      const next = mixSkin(looks.map((v) => ({ startup: v.startup, design: designOf(v)! })).filter((d) => d.design));
      setSkin(next);
      setMvp(await post<Mvp>("/api/mvp", { query, parts, vibes: looks.length ? [next.vibe] : [] }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBuilding(false);
    }
  }

  const designOf = (v: Verdict) => startups.find((s) => s.name === v.startup)?.design;
  const swatches = (v: Verdict) => {
    const d = v.part.kind === "design" ? designOf(v) : undefined;
    if (!d) return null;
    return (
      <span className="mt-1 flex justify-center gap-1">
        {[d.primary, d.accent, d.background].map((c, i) => (
          <span key={i} className="size-5 rounded-full border border-black/30" style={{ background: c }} />
        ))}
      </span>
    );
  };
  const onSlab = picked.map((k) => verdicts.find((v) => key(v) === k)!).filter(Boolean);
  const onTray = verdicts.filter((v) => !picked.includes(key(v)));
  const score = onSlab.length
    ? Math.round((onSlab.reduce((s, v) => s + (v.confidence ?? 0.5), 0) / onSlab.length) * 100)
    : 0;

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-8">
      <header className="text-center">
        <h1 className="font-creepy text-6xl tracking-wide text-lime-300 drop-shadow-[0_0_25px_rgba(163,230,53,0.5)] sm:text-7xl">
          <span className="wobble inline-block">🧟</span> Frankenstartup
        </h1>
        <p className="mt-2 text-xl text-lime-100/70">
          Dig up dead startups. Steal the good organs. Leave what killed them.
        </p>
      </header>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          raise(query);
        }}
        className="mx-auto mt-6 flex max-w-3xl flex-col gap-3 sm:flex-row"
      >
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="I want to build…"
          aria-label="What do you want to build?"
          className="min-w-0 flex-1 rounded-2xl border-2 border-lime-400/40 bg-black/40 px-5 py-3 text-2xl text-lime-50 outline-none placeholder:text-lime-100/30 focus:border-lime-300"
        />
        <button
          type="submit"
          disabled={busy || !query.trim()}
          className="rounded-2xl bg-lime-400 px-7 py-3 text-2xl font-black text-black transition hover:scale-105 hover:bg-lime-300 active:scale-95 disabled:opacity-40"
        >
          ⚡ RAISE THE DEAD
        </button>
      </form>

      <div className="mx-auto mt-3 flex max-w-3xl flex-wrap justify-center gap-2">
        {IDEAS.map((idea) => (
          <button
            key={idea}
            disabled={busy}
            onClick={() => raise(idea.replace(/^\S+\s/, ""))}
            className="rounded-full border border-lime-400/30 bg-lime-400/10 px-4 py-1.5 text-lg text-lime-100 transition hover:-rotate-2 hover:scale-110 hover:bg-lime-400/25 disabled:opacity-40"
          >
            {idea}
          </button>
        ))}
      </div>

      <section className="mt-8 space-y-8" aria-live="polite">
        {phase === "digging" && (
          <Loading emoji="⛏️" text="Digging up dead startups…" sub="robbing graves on the live web" />
        )}
        {phase === "jury" && (
          <Loading
            emoji={JUDGES.map((j) => j.emoji).join(" ")}
            text="The jury is arguing over every organ…"
            sub={startups.map((s) => `🪦 ${s.name}`).join("   ")}
          />
        )}

        {error && (
          <div className="mx-auto max-w-3xl rounded-2xl border-2 border-red-500/60 bg-red-950/60 px-5 py-4 text-center text-xl text-red-200">
            💀 {error}
          </div>
        )}

        {phase === "lab" && (
          <>
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Organ tray: verdicts are hidden until you stitch one in. */}
              <div>
                <h3 className="font-creepy text-3xl text-lime-200/90">🧺 Organ tray</h3>
                <p className="text-base text-lime-100/50">
                  Harvested from {startups.map((s) => s.name).join(", ")}. Some of these killed their
                  host. Drag (or tap) the ones you trust. 🎨 looks decide how your MVP is dressed: mix
                  several for a true Frankenstein.
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  {onTray.map((v, i) => (
                    <button
                      key={key(v)}
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData("text/plain", key(v))}
                      onClick={() => stitch(key(v))}
                      title={v.part.detail}
                      style={{ transform: `rotate(${((i * 37) % 7) - 3}deg)` }}
                      className="pop w-40 cursor-grab rounded-2xl border-2 border-dashed border-stone-400/60 bg-stone-200 p-3 text-center text-black shadow-lg transition hover:z-10 hover:!rotate-0 hover:scale-110 active:cursor-grabbing"
                    >
                      <span className="block text-4xl">{organ(v.part.kind)}</span>
                      <span className="mt-1 block text-base font-black leading-tight">{v.part.name}</span>
                      {swatches(v)}
                      <span className="block text-xs text-black/50">🪦 {v.startup}</span>
                    </button>
                  ))}
                  {onTray.length === 0 && <p className="text-xl text-lime-100/50">Tray empty. You monster.</p>}
                </div>
              </div>

              {/* The slab: drop zone and live success rating. */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setHover(true);
                }}
                onDragLeave={() => setHover(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setHover(false);
                  stitch(e.dataTransfer.getData("text/plain"));
                }}
                className={`rounded-3xl border-4 p-5 transition ${
                  hover ? "scale-[1.02] border-yellow-300 bg-lime-900/60" : "border-lime-400 bg-lime-950/60"
                }`}
              >
                <div className="flex items-end justify-between gap-3">
                  <h3 className="font-creepy text-3xl text-lime-300">🛏️ The slab</h3>
                  <p className="text-5xl font-black tabular-nums text-white">{score}%</p>
                </div>
                <div className="mt-2 h-5 overflow-hidden rounded-full bg-black/60">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-red-500 via-yellow-400 to-lime-400 transition-all duration-500"
                    style={{ width: `${score}%` }}
                  />
                </div>
                <p className="mt-1 text-xl font-bold text-lime-100">{rank(score, onSlab.length)}</p>

                {toast && (
                  <p
                    key={toast.text}
                    className={`pop mt-3 rounded-xl px-4 py-2 text-lg font-bold ${
                      toast.good ? "bg-lime-400 text-black" : "bg-red-600 text-white"
                    }`}
                  >
                    {toast.text}
                  </p>
                )}

                <div className="mt-4 flex min-h-32 flex-wrap gap-3">
                  {onSlab.map((v) => (
                    <div
                      key={key(v)}
                      className={`pop group relative w-36 rounded-2xl p-3 text-center text-black ${
                        v.keep ? "bg-lime-300" : "bg-red-400"
                      }`}
                    >
                      <button onClick={() => setOpen(v)} className="block w-full" title="See the jury">
                        <span className="block text-3xl">{v.keep ? organ(v.part.kind) : "☠️"}</span>
                        <span className="block text-sm font-black leading-tight">{v.part.name}</span>
                        {swatches(v)}
                        <span className="block tracking-widest">
                          {v.votes.map((x) => (x.copy === null ? "🤷" : x.copy >= 0.5 ? "👍" : "👎")).join("")}
                        </span>
                      </button>
                      <button
                        onClick={() => rip(key(v))}
                        title="Rip it out"
                        className="absolute -right-2 -top-2 rounded-full bg-black px-2 py-1 text-sm"
                      >
                        ✂️
                      </button>
                    </div>
                  ))}
                  {onSlab.length === 0 && (
                    <p className="m-auto text-center text-2xl text-lime-100/40">⬇️ drop organs here</p>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    onClick={autoStitch}
                    className="rounded-xl border-2 border-lime-400/60 px-4 py-2 text-lg font-bold text-lime-100 transition hover:bg-lime-400/20"
                  >
                    🤖 I&apos;m lazy, do it for me
                  </button>
                  <button
                    onClick={buildMvp}
                    disabled={onSlab.length === 0 || building}
                    className="flex-1 rounded-xl bg-lime-400 px-4 py-2 text-xl font-black text-black transition hover:scale-105 hover:bg-lime-300 disabled:opacity-40"
                  >
                    {building ? "🧪 Stitching your MVP…" : "🚀 BUILD MY MVP"}
                  </button>
                </div>
              </div>
            </div>

            {mvp && <MvpSite mvp={mvp} skin={skin} score={score} />}
          </>
        )}
      </section>

      {open && <JuryCard v={open} onClose={() => setOpen(null)} />}
    </main>
  );
}

function Loading({ emoji, text, sub }: { emoji: string; text: string; sub: string }) {
  return (
    <div className="text-center">
      <p className="wobble text-7xl">{emoji}</p>
      <p className="font-creepy mt-3 text-4xl text-lime-200">{text}</p>
      <p className="mt-1 text-lg text-lime-100/50">{sub}</p>
    </div>
  );
}

function JuryCard({ v, onClose }: { v: Verdict; onClose: () => void }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/70 p-5" onClick={onClose}>
      <div
        className="pop w-full max-w-lg rounded-3xl border-4 border-lime-400 bg-stone-900 p-6 text-lime-50"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-center text-6xl">{organ(v.part.kind)}</p>
        <h3 className="mt-2 text-center text-3xl font-black">{v.part.name}</h3>
        <p className="text-center text-stone-400">
          {v.part.kind} · harvested from {v.startup}
        </p>
        <p className="mt-3 text-center text-lg">{v.part.detail}</p>
        <div className="mt-5 space-y-3">
          {v.votes.map((x) => (
            <div key={x.judge.id} className="flex items-center gap-3">
              <span className="text-4xl">{x.judge.emoji}</span>
              <div className="min-w-0 flex-1">
                <p className="font-bold">
                  {x.judge.name} <span className="font-normal text-stone-400">“{x.judge.asks}”</span>
                </p>
                <div className="mt-1 h-3 overflow-hidden rounded-full bg-black">
                  <div
                    className={`h-full ${x.copy !== null && x.copy >= 0.5 ? "bg-lime-400" : "bg-red-500"}`}
                    style={{ width: `${Math.round((x.copy ?? 0) * 100)}%` }}
                  />
                </div>
              </div>
              <span className="w-16 text-right text-lg font-bold tabular-nums">
                {x.copy === null ? "🤷" : `${Math.round(x.copy * 100)}%`}
              </span>
            </div>
          ))}
        </div>
        <p className="mt-4 text-center text-sm text-stone-500">Estimates from web evidence, not facts.</p>
        <button onClick={onClose} className="mt-4 w-full rounded-xl bg-lime-400 py-2.5 text-xl font-black text-black">
          Back to the lab
        </button>
      </div>
    </div>
  );
}

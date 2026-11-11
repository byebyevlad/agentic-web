"use client";

import { useEffect, useState } from "react";
import { JUDGES, type Startup, type Verdict } from "@/lib/franken";
import type { Source } from "@/lib/types";

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
};
const organ = (kind: string) => ORGANS[kind.toLowerCase().trim()] ?? "🦴";

type Phase = "idle" | "digging" | "jury" | "alive";

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

// "Munchery" + "Sprig" + "Maple" -> "Munsprimap.ly"
function monsterName(names: string[]) {
  const bits = names.map((n) => n.replace(/[^a-zA-Z]/g, "").slice(0, 3).toLowerCase());
  const s = bits.join("") || "blob";
  return s[0].toUpperCase() + s.slice(1) + ".ly";
}

export default function Home() {
  const [query, setQuery] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [startups, setStartups] = useState<Startup[]>([]);
  const [verdicts, setVerdicts] = useState<Record<string, Verdict[]>>({});
  const [flipped, setFlipped] = useState<Record<string, boolean>>({}); // human overrides
  const [sources, setSources] = useState<Source[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const busy = phase === "digging" || phase === "jury";

  async function raise(q: string) {
    const prompt = q.trim();
    if (!prompt || busy) return;
    setQuery(prompt);
    setPhase("digging");
    setError(null);
    setStartups([]);
    setVerdicts({});
    setFlipped({});
    setSources([]);
    setOpen(null);
    try {
      // 1. Parallel Responses: dig up dead startups and take them apart (~10s).
      const autopsy = await post<{ startups: Startup[]; sources: Source[] }>("/api/autopsy", {
        query: prompt,
      });
      if (autopsy.startups.length === 0) throw new Error("The graveyard is empty. Try another idea.");
      setStartups(autopsy.startups);
      setSources(autopsy.sources);
      setPhase("jury");

      // 2. Parallel Decisions: a jury of three judges rules on every part.
      await Promise.all(
        autopsy.startups.map(async (s) => {
          const d = await post<{ verdicts: Verdict[]; sources: Source[] }>("/api/decide", {
            startup: s,
          });
          setVerdicts((v) => ({ ...v, [s.name]: d.verdicts }));
          setSources((prev) => {
            const urls = new Set(prev.map((p) => p.url));
            return [...prev, ...d.sources.filter((x) => !urls.has(x.url))];
          });
        }),
      );
      setPhase("alive");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setPhase("idle");
    }
  }

  const key = (v: Verdict) => `${v.startup}::${v.part.name}`;
  const isKept = (v: Verdict) => (flipped[key(v)] ? !v.keep : v.keep);
  const toggle = (v: Verdict) => setFlipped((f) => ({ ...f, [key(v)]: !f[key(v)] }));

  const all = Object.values(verdicts).flat();
  const kept = all.filter(isKept);
  const odds = kept.length
    ? Math.round((kept.reduce((s, v) => s + (v.confidence ?? 0.5), 0) / kept.length) * 100)
    : 0;
  const donors = [...new Set(kept.map((v) => v.startup))];
  const opened = all.find((v) => key(v) === open);

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-10">
      <header className="text-center">
        <h1 className="font-creepy text-6xl tracking-wide text-lime-300 drop-shadow-[0_0_25px_rgba(163,230,53,0.5)] sm:text-8xl">
          <span className="wobble inline-block">🧟</span> Frankenstartup
        </h1>
        <p className="mt-3 text-xl text-lime-100/70 sm:text-2xl">
          Dig up dead startups. Steal the good organs. Leave what killed them.
        </p>
      </header>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          raise(query);
        }}
        className="mx-auto mt-8 flex max-w-3xl flex-col gap-3 sm:flex-row"
      >
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="I want to build…"
          aria-label="What do you want to build?"
          className="min-w-0 flex-1 rounded-2xl border-2 border-lime-400/40 bg-black/40 px-5 py-4 text-2xl text-lime-50 outline-none placeholder:text-lime-100/30 focus:border-lime-300"
        />
        <button
          type="submit"
          disabled={busy || !query.trim()}
          className="rounded-2xl bg-lime-400 px-7 py-4 text-2xl font-black text-black transition hover:scale-105 hover:bg-lime-300 active:scale-95 disabled:opacity-40"
        >
          ⚡ RAISE THE DEAD
        </button>
      </form>

      <div className="mx-auto mt-4 flex max-w-3xl flex-wrap justify-center gap-2">
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

      <section className="mt-10 space-y-10" aria-live="polite">
        {phase === "digging" && (
          <Loading emoji="⛏️" text="Digging up dead startups…" sub="robbing graves on the live web" />
        )}
        {phase === "jury" && (
          <Loading
            emoji={JUDGES.map((j) => j.emoji).join(" ")}
            text="The jury is arguing over every organ…"
            sub="three judges, one question each: copy it or bury it?"
          />
        )}

        {error && (
          <div className="mx-auto max-w-3xl rounded-2xl border-2 border-red-500/60 bg-red-950/60 px-5 py-4 text-center text-xl text-red-200">
            💀 {error}
          </div>
        )}

        {phase === "alive" && (
          <article className="alive relative rounded-3xl border-4 border-lime-400 bg-gradient-to-b from-lime-950/80 to-black/60 p-6 sm:p-8">
            <p className="font-creepy text-center text-4xl text-lime-300 sm:text-5xl">⚡ IT&apos;S ALIVE! ⚡</p>
            <h2 className="mt-2 text-center text-5xl font-black tracking-tight text-white sm:text-7xl">
              {monsterName(donors)}
            </h2>
            <p className="mt-2 text-center text-xl text-lime-100/70">
              {query} · stitched from {donors.length} corpses · {kept.length} organs
            </p>

            <div className="mx-auto mt-5 max-w-xl">
              <div className="flex justify-between text-lg font-bold text-lime-200">
                <span>Survival odds</span>
                <span className="tabular-nums">{odds}%</span>
              </div>
              <div className="mt-1 h-5 overflow-hidden rounded-full bg-black/60">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-red-500 via-yellow-400 to-lime-400 transition-all duration-500"
                  style={{ width: `${odds}%` }}
                />
              </div>
            </div>

            <div className="mt-7 flex flex-wrap justify-center gap-4">
              {kept.map((v, i) => (
                <Organ
                  key={key(v)}
                  v={v}
                  tilt={((i * 37) % 9) - 4}
                  onInfo={() => setOpen(key(v))}
                  onRip={() => toggle(v)}
                />
              ))}
              {kept.length === 0 && (
                <p className="text-2xl text-lime-100/60">You buried everything. It&apos;s a ghost. 👻</p>
              )}
            </div>
            <p className="mt-6 text-center text-base text-lime-100/50">
              Tap an organ to see the jury. ✂️ rips it out. Dig buried parts back up in the graveyard.
            </p>
          </article>
        )}

        {startups.length > 0 && (
          <div>
            <h3 className="font-creepy text-center text-4xl text-lime-200/80">The Graveyard</h3>
            <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {startups.map((s) => (
                <div
                  key={s.name}
                  className="pop rounded-t-[5rem] rounded-b-xl border-2 border-stone-500/60 bg-stone-800/70 px-5 pb-5 pt-9 text-center"
                >
                  <p className="font-creepy text-2xl text-stone-400">R.I.P.</p>
                  <p className="text-2xl font-black text-white">{s.name}</p>
                  <p className="text-lg text-stone-400">† {s.died}</p>
                  <p className="mt-2 line-clamp-3 text-sm text-red-300/90" title={s.cause_of_death}>
                    ☠️ {s.cause_of_death}
                  </p>
                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    {s.parts.map((p, i) => {
                      const v = verdicts[s.name]?.[i];
                      if (!v) {
                        return (
                          <span key={i} className="animate-pulse rounded-full bg-stone-700 px-3 py-1 text-sm text-stone-400">
                            {organ(p.kind)} {p.name}
                          </span>
                        );
                      }
                      const on = isKept(v);
                      return (
                        <button
                          key={i}
                          onClick={() => toggle(v)}
                          title={on ? "Stitched in. Click to bury." : "Buried. Click to dig up."}
                          className={`rounded-full px-3 py-1 text-sm font-semibold transition hover:scale-110 ${
                            on
                              ? "bg-lime-400 text-black"
                              : "bg-stone-900 text-stone-500 line-through decoration-red-500"
                          }`}
                        >
                          {on ? organ(p.kind) : "⚰️"} {p.name}
                          {v.split && " ⚡"}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-4 text-center text-sm text-stone-500">
              ⚡ = the jury disagreed. Verdicts are estimates from web evidence, not facts.
            </p>
          </div>
        )}

        {sources.length > 0 && phase === "alive" && (
          <details className="mx-auto max-w-3xl text-stone-400">
            <summary className="cursor-pointer text-center text-lg">📜 {sources.length} sources</summary>
            <ol className="mt-3 space-y-1">
              {sources.slice(0, 20).map((s) => (
                <li key={s.url} className="truncate text-sm">
                  <a href={s.url} target="_blank" rel="noreferrer" className="underline underline-offset-4 hover:text-lime-200">
                    {s.title}
                  </a>
                </li>
              ))}
            </ol>
          </details>
        )}
      </section>

      {opened && <JuryCard v={opened} onClose={() => setOpen(null)} />}
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

function Organ({
  v,
  tilt,
  onInfo,
  onRip,
}: {
  v: Verdict;
  tilt: number;
  onInfo: () => void;
  onRip: () => void;
}) {
  return (
    <div
      style={{ transform: `rotate(${tilt}deg)` }}
      className="pop group relative w-44 rounded-2xl border-2 border-dashed border-lime-300/70 bg-lime-200 p-3 text-center text-black shadow-lg transition hover:z-10 hover:!rotate-0 hover:scale-110"
    >
      <button onClick={onInfo} className="block w-full" title={v.part.detail}>
        <span className="text-5xl">{organ(v.part.kind)}</span>
        <span className="mt-1 block text-lg font-black leading-tight">{v.part.name}</span>
        <span className="block text-xs text-black/60">from {v.startup}</span>
        <span className="mt-1 block text-lg tracking-widest">
          {v.votes.map((x) => (x.copy === null ? "🤷" : x.copy >= 0.5 ? "👍" : "👎")).join("")}
        </span>
      </button>
      <button
        onClick={onRip}
        title="Rip it out"
        className="absolute -right-2 -top-2 rounded-full bg-black px-2 py-1 text-sm opacity-0 transition group-hover:opacity-100"
      >
        ✂️
      </button>
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
        <button onClick={onClose} className="mt-6 w-full rounded-xl bg-lime-400 py-2.5 text-xl font-black text-black">
          Back to the lab
        </button>
      </div>
    </div>
  );
}

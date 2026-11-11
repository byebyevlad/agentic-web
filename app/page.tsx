"use client";

import { useEffect, useState } from "react";
import type { Startup, Verdict } from "@/lib/franken";
import type { Source } from "@/lib/types";

const APP_NAME = "Frankenstartup";
const TAGLINE = "Dead startups, taken apart. The parts that didn't kill them, stitched into yours.";
const PLACEHOLDER = "e.g. make me a financial product";

type Phase = "idle" | "autopsy" | "deciding" | "done";

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

export default function Home() {
  const [query, setQuery] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [seconds, setSeconds] = useState(0);
  const [startups, setStartups] = useState<Startup[]>([]);
  const [verdicts, setVerdicts] = useState<Record<string, Verdict[]>>({});
  const [sources, setSources] = useState<Source[]>([]);
  const [error, setError] = useState<string | null>(null);

  const busy = phase === "autopsy" || phase === "deciding";

  useEffect(() => {
    if (!busy) return;
    const started = Date.now();
    const id = setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 500);
    return () => clearInterval(id);
  }, [busy]);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim() || busy) return;
    setPhase("autopsy");
    setSeconds(0);
    setError(null);
    setStartups([]);
    setVerdicts({});
    setSources([]);
    try {
      // 1. Parallel Responses: find dead startups and take them apart (~10s).
      //    Cached in this browser per prompt as a demo safety net; step 2
      //    always runs live.
      type AutopsyResult = { startups: Startup[]; sources: Source[] };
      const cacheKey = `autopsy:${query.trim().toLowerCase()}`;
      let autopsy: AutopsyResult | null = null;
      try {
        autopsy = JSON.parse(localStorage.getItem(cacheKey) ?? "null");
      } catch {}
      if (!autopsy) {
        autopsy = await post<AutopsyResult>("/api/autopsy", { query });
        try {
          localStorage.setItem(cacheKey, JSON.stringify(autopsy));
        } catch {}
      }
      if (autopsy.startups.length === 0) throw new Error("No dead startups found. Try another prompt.");
      setStartups(autopsy.startups);
      setSources(autopsy.sources);
      setPhase("deciding");

      // 2. Parallel Decisions: one call per startup, one question per part.
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
      setPhase("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setPhase("idle");
    }
  }

  const all = Object.values(verdicts).flat();
  const kept = all.filter((v) => v.keep).sort((a, b) => (a.blame ?? 0) - (b.blame ?? 0));
  const rejected = all.filter((v) => !v.keep);

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-12 sm:py-16">
      <header className="mb-10">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">🧟 {APP_NAME}</h1>
        <p className="mt-3 max-w-3xl text-xl text-neutral-500">{TAGLINE}</p>
      </header>

      <form onSubmit={run} className="flex flex-col gap-3 sm:flex-row">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={PLACEHOLDER}
          aria-label="What do you want to build?"
          autoFocus
          className="min-w-0 flex-1 rounded-xl border border-neutral-300 bg-white px-5 py-4 text-xl outline-none focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10"
        />
        <button
          type="submit"
          disabled={busy || !query.trim()}
          className="rounded-xl bg-neutral-900 px-8 py-4 text-xl font-medium text-white transition hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? "Digging…" : "Raise it"}
        </button>
      </form>

      <section className="mt-10 space-y-12" aria-live="polite">
        {busy && (
          <div className="flex items-center gap-4 text-xl text-neutral-500">
            <span className="size-5 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-900" />
            {phase === "autopsy"
              ? "Digging up dead startups and taking them apart"
              : "Asking, part by part: did this kill them?"}
            … {seconds}s
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-lg text-red-800">
            {error}
          </div>
        )}

        {phase === "done" && <Monster query={query} kept={kept} rejected={rejected} />}

        {startups.length > 0 && (
          <div>
            <SectionTitle>The graveyard</SectionTitle>
            <div className="mt-4 grid gap-5 md:grid-cols-2">
              {startups.map((s) => (
                <Grave key={s.name} startup={s} verdicts={verdicts[s.name]} />
              ))}
            </div>
          </div>
        )}

        {sources.length > 0 && phase === "done" && (
          <div className="border-t border-neutral-200 pt-6">
            <SectionTitle>Sources</SectionTitle>
            <ol className="mt-3 grid gap-x-8 gap-y-1.5 md:grid-cols-2">
              {sources.slice(0, 16).map((s) => (
                <li key={s.url} className="truncate text-sm">
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noreferrer"
                    className="underline decoration-neutral-300 underline-offset-4 hover:decoration-neutral-900"
                  >
                    {s.title}
                  </a>
                </li>
              ))}
            </ol>
          </div>
        )}
      </section>
    </main>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-sm font-semibold uppercase tracking-widest text-neutral-400">{children}</h3>
  );
}

const pct = (n: number | null) => (n === null ? "n/a" : `${Math.round(n * 100)}%`);

function Monster({ query, kept, rejected }: { query: string; kept: Verdict[]; rejected: Verdict[] }) {
  return (
    <article className="rounded-2xl border-2 border-emerald-600 bg-white p-6 sm:p-8">
      <SectionTitle>Your Frankenstartup</SectionTitle>
      <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{query}</h2>
      <p className="mt-2 text-lg text-neutral-500">
        {kept.length} parts copied, {rejected.length} left in the grave.
      </p>
      <ul className="mt-6 space-y-4">
        {kept.map((v, i) => (
          <li key={i} className="flex gap-4">
            <span className="mt-1 text-xl">🧩</span>
            <div className="min-w-0">
              <p className="text-xl font-semibold">
                {v.part.name}
                <span className="ml-3 rounded-full bg-neutral-100 px-2.5 py-0.5 text-sm font-normal text-neutral-500">
                  {v.part.kind}
                </span>
              </p>
              <p className="text-lg leading-relaxed text-neutral-700">{v.part.detail}</p>
              <p className="text-sm text-neutral-400">
                from {v.startup} · {pct(v.blame)} chance it caused the failure
              </p>
            </div>
          </li>
        ))}
      </ul>
    </article>
  );
}

function Grave({ startup, verdicts }: { startup: Startup; verdicts?: Verdict[] }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5">
      <p className="text-xl font-semibold">
        🪦 {startup.name} <span className="font-normal text-neutral-400">† {startup.died}</span>
      </p>
      <p className="mt-1 text-base text-neutral-600">{startup.what_it_did}</p>
      <p className="mt-1 text-base text-red-700">{startup.cause_of_death}</p>
      <ul className="mt-4 space-y-2">
        {startup.parts.map((p, i) => {
          const v = verdicts?.[i];
          return (
            <li key={i} className="flex items-baseline justify-between gap-3 text-base">
              <span className={v && !v.keep ? "text-neutral-400 line-through" : ""}>{p.name}</span>
              {v ? (
                <span
                  className={`shrink-0 rounded-full px-2.5 py-0.5 text-sm font-medium tabular-nums ${
                    v.keep ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"
                  }`}
                >
                  {v.keep ? "copy" : "bury"} · {pct(v.blame)}
                </span>
              ) : (
                <span className="shrink-0 text-sm text-neutral-300">deciding…</span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

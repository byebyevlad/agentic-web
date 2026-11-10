"use client";

import { useEffect, useState } from "react";
import type { RunResult } from "@/lib/types";

// EDIT ME: app name and tagline for the demo.
const APP_NAME = "Agentic Web Starter";
const TAGLINE = "Ask the live web. Get a cited brief.";
const PLACEHOLDER = "e.g. Parallel Web Systems company";

export default function Home() {
  const [query, setQuery] = useState("");
  const [deep, setDeep] = useState(false); // Parallel Task instead of Search
  const [useClaude, setUseClaude] = useState(true);
  const [loading, setLoading] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [result, setResult] = useState<RunResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading) return;
    const started = Date.now();
    const id = setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 500);
    return () => clearInterval(id);
  }, [loading]);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim() || loading) return;
    setLoading(true);
    setSeconds(0);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(deep ? "/api/task" : "/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, useClaude }),
      });
      const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-12 sm:py-20">
      <header className="mb-10">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">{APP_NAME}</h1>
        <p className="mt-3 text-xl text-neutral-500">{TAGLINE}</p>
      </header>

      <form onSubmit={run} className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={PLACEHOLDER}
            aria-label="Objective"
            autoFocus
            className="min-w-0 flex-1 rounded-xl border border-neutral-300 bg-white px-5 py-4 text-xl outline-none focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10"
          />
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="rounded-xl bg-neutral-900 px-8 py-4 text-xl font-medium text-white transition hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? "Running…" : "Run"}
          </button>
        </div>

        <div className="flex flex-wrap gap-x-8 gap-y-2 text-base text-neutral-600">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={deep}
              onChange={(e) => setDeep(e.target.checked)}
              className="size-4 accent-neutral-900"
            />
            Deep research (Parallel Task, slower)
          </label>
          <label className={`flex items-center gap-2 ${deep ? "opacity-40" : "cursor-pointer"}`}>
            <input
              type="checkbox"
              checked={useClaude && !deep}
              disabled={deep}
              onChange={(e) => setUseClaude(e.target.checked)}
              className="size-4 accent-neutral-900"
            />
            Summarize with Claude
          </label>
        </div>
      </form>

      <section className="mt-12" aria-live="polite">
        {loading && (
          <div className="flex items-center gap-4 text-xl text-neutral-500">
            <span className="size-5 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-900" />
            {deep ? "Researching the web" : "Searching the web"}… {seconds}s
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-lg text-red-800">
            {error}
          </div>
        )}

        {result && <Results result={result} />}
      </section>
    </main>
  );
}

function Results({ result }: { result: RunResult }) {
  const { brief, sources, note } = result;
  return (
    <article>
      <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">{brief.title}</h2>
      {note && <p className="mt-2 text-sm text-neutral-400">{note}</p>}

      <div className="mt-8 space-y-7">
        {brief.sections.map((s, i) => (
          <div key={i}>
            <h3 className="text-xl font-semibold">{s.heading}</h3>
            <p className="mt-1.5 text-lg leading-relaxed text-neutral-700">{s.body}</p>
          </div>
        ))}
      </div>

      {sources.length > 0 && (
        <div className="mt-10 border-t border-neutral-200 pt-6">
          <h3 className="text-sm font-semibold uppercase tracking-widest text-neutral-400">
            Sources
          </h3>
          <ol className="mt-3 space-y-2">
            {sources.map((s, i) => (
              <li key={s.url} className="flex gap-3 text-base">
                <span className="w-6 shrink-0 text-right tabular-nums text-neutral-400">{i + 1}</span>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noreferrer"
                  className="min-w-0 truncate underline decoration-neutral-300 underline-offset-4 hover:decoration-neutral-900"
                >
                  {s.title}
                  <span className="ml-2 text-neutral-400">{hostname(s.url)}</span>
                </a>
              </li>
            ))}
          </ol>
        </div>
      )}
    </article>
  );
}

function hostname(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

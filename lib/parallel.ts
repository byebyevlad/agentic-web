import Parallel from "parallel-web";
import type { SearchHit } from "./types";

/** Server-only Parallel client. Reads PARALLEL_API_KEY. */
export function parallel() {
  if (!process.env.PARALLEL_API_KEY) {
    throw new Error("PARALLEL_API_KEY is not set (see .env.example)");
  }
  return new Parallel({ apiKey: process.env.PARALLEL_API_KEY });
}

// "fast" ≈ 700ms, "advanced" ≈ 3s (best quality), "turbo" ≈ 200ms.
const SEARCH_MODE = "fast" as const;

export async function search(objective: string): Promise<SearchHit[]> {
  const res = await parallel().search({
    objective,
    // /v1/search requires at least one keyword query. Reusing the raw input
    // works, but 1-3 short keyword queries give better results (see CLAUDE.md).
    search_queries: [objective.slice(0, 200)],
    mode: SEARCH_MODE,
  });
  return res.results.map((r) => ({
    title: r.title ?? r.url,
    url: r.url,
    excerpts: r.excerpts ?? [],
  }));
}

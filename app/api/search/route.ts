import { search } from "@/lib/parallel";
import { briefFromHits, briefFromSearch, hasClaude } from "@/lib/brief";
import type { RunResult } from "@/lib/types";

export const maxDuration = 60;

// POST { query: string, useClaude?: boolean } -> RunResult & { results }
export async function POST(req: Request) {
  try {
    const { query, useClaude = true } = await req.json();
    if (typeof query !== "string" || !query.trim()) {
      return Response.json({ error: "query is required" }, { status: 400 });
    }

    const results = await search(query.trim());

    let brief = briefFromHits(query, results);
    let note: string | undefined;
    if (useClaude && results.length > 0) {
      if (hasClaude()) brief = await briefFromSearch(query, results);
      else note = "ANTHROPIC_API_KEY not set, showing raw excerpts";
    }

    const body: RunResult & { results: typeof results } = {
      brief,
      sources: results.map(({ title, url }) => ({ title, url })),
      note,
      results,
    };
    return Response.json(body);
  } catch (err) {
    console.error("/api/search", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}

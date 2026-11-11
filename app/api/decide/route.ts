import { KEEP_BELOW, type Startup, type Verdict } from "@/lib/franken";
import type { Source } from "@/lib/types";

export const maxDuration = 60;

type DecisionsResponse = {
  answers: Record<string, { type: string; noul?: number }>;
  citations?: { url: string; title?: string }[];
};

// POST { startup } -> { verdicts, sources }
// Step 2: for every part of one dead startup, ask Parallel Decisions whether
// that part contributed to the failure. One request, one question per part.
export async function POST(req: Request) {
  try {
    const { startup } = (await req.json()) as { startup: Startup };
    if (!startup?.name || !Array.isArray(startup.parts)) {
      return Response.json({ error: "startup is required" }, { status: 400 });
    }
    if (!process.env.PARALLEL_API_KEY) throw new Error("PARALLEL_API_KEY is not set");

    const questions = Object.fromEntries(
      startup.parts.map((p, i) => [
        `part_${i}`,
        {
          type: "noul",
          instructions:
            `Was "${p.name}" (${p.detail}) a significant cause of the failure ` +
            `or shutdown of ${startup.name}?`,
        },
      ]),
    );

    // The Decisions API is not in the SDK yet; the docs use plain fetch.
    const res = await fetch("https://api.parallel.ai/v1/decisions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.PARALLEL_API_KEY,
      },
      body: JSON.stringify({
        state: {
          startup: startup.name,
          what_it_did: startup.what_it_did,
          shut_down: startup.died,
        },
        questions,
      }),
    });
    if (!res.ok) throw new Error(`Decisions ${res.status}: ${await res.text()}`);
    const decision = (await res.json()) as DecisionsResponse;

    const verdicts: Verdict[] = startup.parts.map((part, i) => {
      const a = decision.answers?.[`part_${i}`];
      const blame = a?.type === "noul" && typeof a.noul === "number" ? a.noul : null;
      // No answer means no evidence either way: do not copy it.
      return { part, startup: startup.name, blame, keep: blame !== null && blame < KEEP_BELOW };
    });

    const sources: Source[] = (decision.citations ?? [])
      .slice(0, 4)
      .map((c) => ({ title: c.title ?? c.url, url: c.url }));

    return Response.json({ verdicts, sources });
  } catch (err) {
    console.error("/api/decide", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}

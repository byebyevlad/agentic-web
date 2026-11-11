import { z } from "zod";
import { AutopsySchema } from "@/lib/franken";
import type { Source } from "@/lib/types";

export const maxDuration = 120;

// EDIT ME: low ≈ 10s, medium/high research deeper but take longer.
const EFFORT = "low";
const STARTUPS = 4;
const PARTS = 4;

type ResponsesOutput = {
  output?: {
    type: string;
    content?: { type: string; text?: string; annotations?: { url?: string; title?: string }[] }[];
  }[];
};

// POST { query } -> { startups, sources }
// Step 1: find dead startups in the space and take them apart.
// Uses Parallel's Responses API (web research in seconds; not in the SDK,
// OpenAI-compatible). The Task API gave the same result but took ~2 minutes.
export async function POST(req: Request) {
  try {
    const { query } = await req.json();
    if (typeof query !== "string" || !query.trim()) {
      return Response.json({ error: "query is required" }, { status: 400 });
    }
    if (!process.env.PARALLEL_API_KEY) throw new Error("PARALLEL_API_KEY is not set");

    const schema: Record<string, unknown> = z.toJSONSchema(AutopsySchema);
    delete schema.$schema;

    const res = await fetch("https://api.parallel.ai/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.PARALLEL_API_KEY}`,
      },
      body: JSON.stringify({
        model: "parallel",
        reasoning: { effort: EFFORT },
        text: { format: { type: "json_schema", name: "autopsy", strict: true, schema } },
        input:
          `The user wants to build: "${query.trim()}". ` +
          `Find ${STARTUPS} real failed, shut-down startups in that space with documented post-mortems ` +
          `and break each into ${PARTS} concrete product features or business decisions it made while ` +
          `operating (a mix of good ones and ones that hurt it; nothing that happened after it failed). ` +
          `Also record each startup's real visual identity: brand colours, typeface style, shapes and website layout.`,
      }),
    });
    if (!res.ok) throw new Error(`Responses ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as ResponsesOutput;

    const blocks = (data.output ?? [])
      .filter((o) => o.type === "message")
      .flatMap((o) => o.content ?? [])
      .filter((c) => c.type === "output_text");
    const text = blocks.map((c) => c.text ?? "").join("");

    // Structured output should be bare JSON; tolerate stray text around it.
    const json = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
    const parsed = AutopsySchema.safeParse(JSON.parse(json));
    if (!parsed.success) throw new Error("Research came back in an unexpected shape. Try again.");

    const seen = new Map<string, Source>();
    for (const a of blocks.flatMap((c) => c.annotations ?? [])) {
      if (a.url && !seen.has(a.url)) seen.set(a.url, { title: a.title ?? a.url, url: a.url });
    }

    return Response.json({ startups: parsed.data.startups, sources: [...seen.values()] });
  } catch (err) {
    console.error("/api/autopsy", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}

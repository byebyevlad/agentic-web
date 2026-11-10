import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { BriefSchema, type Brief, type SearchHit } from "./types";

const MODEL = "claude-opus-5-5";
const MAX_EXCERPT_CHARS = 1500; // per excerpt, keeps the prompt small and fast

// EDIT ME: what Claude should do with the excerpts.
const SYSTEM = `You turn web search excerpts into a short, factual brief.
Use only what the excerpts say. If they disagree or are thin, say so plainly.`;

export const hasClaude = () => Boolean(process.env.ANTHROPIC_API_KEY);

/** Optional LLM step: search excerpts -> structured Brief (see BriefSchema). */
export async function briefFromSearch(
  objective: string,
  hits: SearchHit[],
): Promise<Brief> {
  const client = new Anthropic(); // reads ANTHROPIC_API_KEY

  const sources = hits
    .map(
      (h, i) =>
        `[${i + 1}] ${h.title}\n${h.url}\n` +
        h.excerpts.map((e) => e.slice(0, MAX_EXCERPT_CHARS)).join("\n"),
    )
    .join("\n\n");

  const res = await client.messages.parse({
    model: MODEL,
    max_tokens: 4000,
    system: SYSTEM,
    output_config: { effort: "low", format: zodOutputFormat(BriefSchema) },
    messages: [
      { role: "user", content: `Objective: ${objective}\n\nExcerpts:\n\n${sources}` },
    ],
  });

  if (res.stop_reason === "refusal" || !res.parsed_output) {
    throw new Error(`Claude returned no brief (stop_reason: ${res.stop_reason})`);
  }
  return res.parsed_output;
}

/** No-LLM fallback: show the top hits as sections so the UI always has a brief. */
export function briefFromHits(objective: string, hits: SearchHit[]): Brief {
  return {
    title: objective,
    sections: hits.slice(0, 5).map((h) => ({
      heading: h.title,
      body: (h.excerpts[0] ?? "").replace(/\s+/g, " ").slice(0, 400),
    })),
  };
}

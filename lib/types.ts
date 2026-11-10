import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// EDIT ME: the shape of the brief. This one constant drives
//   - Claude's structured output (lib/brief.ts)
//   - the Parallel Task output schema (app/api/task/route.ts)
//   - the results panel (app/page.tsx renders title + sections)
// Field descriptions are read by both models, so write them as instructions.
// ─────────────────────────────────────────────────────────────────────────────
export const BriefSchema = z.object({
  title: z.string().describe("Short headline for the brief, under 10 words"),
  sections: z
    .array(
      z.object({
        heading: z.string().describe("Section heading, 2-5 words"),
        body: z.string().describe("2-3 plain sentences. No markdown."),
      }),
    )
    .describe("3 to 5 sections covering the most important findings"),
});

export type Brief = z.infer<typeof BriefSchema>;

export type Source = { title: string; url: string };

export type SearchHit = Source & { excerpts: string[] };

/** What every API route returns and what the results panel renders. */
export type RunResult = {
  brief: Brief;
  sources: Source[];
  note?: string; // shown small under the title (e.g. "Claude step skipped")
};

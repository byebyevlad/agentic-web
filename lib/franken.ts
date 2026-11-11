import { z } from "zod";

// ── Step 1 output: dead startups, taken apart into parts ────────────────────
export const AutopsySchema = z.object({
  startups: z
    .array(
      z.object({
        name: z.string().describe("Name of a real startup that failed or shut down"),
        what_it_did: z.string().describe("One sentence on what the startup did"),
        died: z.string().describe("Year it shut down, e.g. 2023"),
        cause_of_death: z.string().describe("One sentence on why it failed"),
        parts: z
          .array(
            z.object({
              name: z.string().describe("Short name of the part, 2-5 words"),
              kind: z
                .string()
                .describe("One of: feature, pricing, business model, go-to-market, team, funding"),
              detail: z.string().describe("One sentence describing this specific choice"),
            }),
          )
          .describe(
            "5 distinct product features and business decisions of this startup, a mix of good ones and ones that hurt it",
          ),
      }),
    )
    .describe("4 well-documented failed startups in the requested space"),
});

export type Autopsy = z.infer<typeof AutopsySchema>;
export type Startup = Autopsy["startups"][number];

// ── Step 2 output: a verdict per part ──────────────────────────────────────
export type Verdict = {
  part: Startup["parts"][number];
  startup: string;
  blame: number | null; // probability this part caused the failure (null = no answer)
  keep: boolean;
};

// EDIT ME: a part is copied when its blame probability is below this.
export const KEEP_BELOW = 0.5;

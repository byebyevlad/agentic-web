import { z } from "zod";

// ── Step 1 output: dead startups, taken apart into parts ────────────────────
export const AutopsySchema = z.object({
  startups: z
    .array(
      z.object({
        name: z.string().describe("Name of a real startup that failed or shut down"),
        what_it_did: z.string().describe("One sentence on what the startup did"),
        died: z.string().describe("Year it shut down, e.g. 2023. Just the year, or \"unknown\"."),
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
            "Distinct product features and business decisions of this startup, a mix of good ones and ones that hurt it",
          ),
      }),
    )
    .describe("Well-documented failed startups in the requested space"),
});

export type Autopsy = z.infer<typeof AutopsySchema>;
export type Startup = Autopsy["startups"][number];

// ── Step 2 output: a jury verdict per part ─────────────────────────────────
// Three Parallel Decisions question types act as three judges.
export const JUDGES = [
  { id: "coroner", emoji: "🧑‍⚕️", name: "The Coroner", asks: "Did this kill them?" },
  { id: "vc", emoji: "🤑", name: "The VC", asks: "Would you copy it?" },
  { id: "gambler", emoji: "🎲", name: "The Gambler", asks: "Mistake or strength?" },
] as const;

export type JudgeVote = {
  judge: (typeof JUDGES)[number];
  copy: number | null; // confidence the part is worth copying, 0..1 (null = abstained)
};

export type Verdict = {
  part: Startup["parts"][number];
  startup: string;
  votes: JudgeVote[];
  confidence: number | null; // mean of the judges who voted
  keep: boolean; // majority says copy
  split: boolean; // the judges disagreed
};

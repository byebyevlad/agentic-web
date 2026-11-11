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
        design: z
          .object({
            primary: z.string().describe("Main brand colour as a hex code, e.g. #FF5A1F"),
            accent: z.string().describe("Secondary brand colour as a hex code"),
            background: z.string().describe("Page background colour of its website as a hex code"),
            text: z.string().describe("Body text colour as a hex code, readable on the background"),
            font: z
              .string()
              .describe("Typeface style. One of: serif, geometric sans, rounded sans, monospace, condensed display, handwritten"),
            corners: z.string().describe("Shape language. One of: sharp, soft, pill"),
            layout: z.string().describe("Website layout. One of: centered, split, big type"),
            vibe: z.string().describe("The visual style in 3-6 words, e.g. 'playful pastel food illustrations'"),
          })
          .describe("The startup's real brand and website design, as best documented"),
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
export type Design = Startup["design"];

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

// ── Step 3 output: the startup idea and its landing page content ───────────
export const MvpSchema = z.object({
  name: z.string().describe("A catchy one-word startup name"),
  emoji: z.string().describe("One emoji that works as the logo"),
  tagline: z.string().describe("Landing page headline: one plain sentence under 9 words that says what you get"),
  pitch: z.string().describe("Two short sentences, under 35 words in total: what it is and why it will not die like its donors"),
  features: z
    .array(
      z.object({
        emoji: z.string().describe("One emoji"),
        title: z.string().describe("Feature name, 2-4 words"),
        text: z.string().describe("One sentence"),
      }),
    )
    .describe("Exactly 3 features, each based on one of the stitched parts"),
  price: z.string().describe("Pricing in a few words, e.g. '$9/month, first month free'"),
  cta: z.string().describe("Call-to-action button text, 2-4 words"),
});

export type Mvp = z.infer<typeof MvpSchema>;

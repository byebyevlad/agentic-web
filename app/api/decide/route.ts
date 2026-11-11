import { JUDGES, type JudgeVote, type Startup, type Verdict } from "@/lib/franken";
import type { Source } from "@/lib/types";

export const maxDuration = 60;

type Answer = {
  type: string;
  noul?: number;
  choice?: string;
  probabilities?: Record<string, number>;
  score?: number;
};
type DecisionsResponse = {
  answers: Record<string, Answer>;
  citations?: { url: string; title?: string }[];
};

// POST { startup } -> { verdicts, sources }
// Step 2: a jury of three Parallel Decisions question types judges every part
// of one dead startup. One request, three questions per part, shared evidence.
//   coroner (noul):   probability the part caused the death
//   vc (choice):      copy / bury / unknown
//   gambler (score):  0 = fatal mistake ... 2 = real strength
export async function POST(req: Request) {
  try {
    const { startup } = (await req.json()) as { startup: Startup };
    if (!startup?.name || !Array.isArray(startup.parts)) {
      return Response.json({ error: "startup is required" }, { status: 400 });
    }
    if (!process.env.PARALLEL_API_KEY) throw new Error("PARALLEL_API_KEY is not set");

    const questions: Record<string, unknown> = {};
    startup.parts.forEach((p, i) => {
      const what = `"${p.name}" (${p.detail})`;
      questions[`coroner_${i}`] = {
        type: "noul",
        instructions: `Was ${what} a significant cause of the failure or shutdown of ${startup.name}?`,
      };
      questions[`vc_${i}`] = {
        type: "choice",
        instructions: `Should a new startup in the same space copy ${what} from ${startup.name}? Select unknown when evidence is insufficient.`,
        criteria: {
          copy: "It worked well or was praised, and was not a reason the company failed.",
          bury: "It contributed to the company's failure or was widely criticised.",
          unknown: "The evidence does not establish either.",
        },
      };
      questions[`gambler_${i}`] = {
        type: "score",
        instructions: `Rate ${what} as a choice made by ${startup.name}.`,
        criteria: [
          "A fatal mistake that directly contributed to the shutdown.",
          "Neutral or mixed: neither clearly helped nor clearly hurt.",
          "A real strength that customers or observers praised.",
        ],
      };
    });

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
      const c = decision.answers?.[`coroner_${i}`];
      const v = decision.answers?.[`vc_${i}`];
      const g = decision.answers?.[`gambler_${i}`];

      // Each judge's "copy it" confidence, 0..1 (null = abstained).
      const coroner = c?.type === "noul" && typeof c.noul === "number" ? 1 - c.noul : null;
      const vc =
        v?.type === "choice" && v.probabilities
          ? v.choice === "unknown"
            ? null
            : (v.probabilities.copy ?? 0) /
              Math.max((v.probabilities.copy ?? 0) + (v.probabilities.bury ?? 0), 1e-9)
          : null;
      const gambler = g?.type === "score" && typeof g.score === "number" ? g.score / 2 : null;

      const votes: JudgeVote[] = [
        { judge: JUDGES[0], copy: coroner },
        { judge: JUDGES[1], copy: vc },
        { judge: JUDGES[2], copy: gambler },
      ];
      const cast = votes.filter((x) => x.copy !== null);
      const yes = cast.filter((x) => (x.copy as number) >= 0.5).length;
      const confidence = cast.length
        ? cast.reduce((sum, x) => sum + (x.copy as number), 0) / cast.length
        : null;

      return {
        part,
        startup: startup.name,
        votes,
        confidence,
        // Majority of the judges who voted; a tie or no votes means bury.
        keep: cast.length > 0 && yes > cast.length / 2,
        split: cast.length > 1 && yes > 0 && yes < cast.length,
      };
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

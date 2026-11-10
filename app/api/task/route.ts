import { z } from "zod";
import { parallel } from "@/lib/parallel";
import { BriefSchema, type Brief, type RunResult, type Source } from "@/lib/types";

// Task runs are slow (lite/base: ~10s-2min, core/pro: minutes). Vercel kills
// the function at maxDuration, so keep POLL_LIMIT_MS below it.
export const maxDuration = 300;
const POLL_LIMIT_MS = 280_000;
const POLL_EVERY_MS = 3_000;

// EDIT ME: lite < base < core < pro < ultra (slower = deeper research).
const PROCESSOR = "base";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// POST { query: string } -> RunResult
export async function POST(req: Request) {
  try {
    const { query } = await req.json();
    if (typeof query !== "string" || !query.trim()) {
      return Response.json({ error: "query is required" }, { status: 400 });
    }
    const client = parallel();

    // 1. Start the run with a JSON output schema (same shape as the brief).
    const jsonSchema: Record<string, unknown> = z.toJSONSchema(BriefSchema);
    delete jsonSchema.$schema;
    let run = await client.taskRun.create({
      input: query.trim(),
      processor: PROCESSOR,
      task_spec: { output_schema: { type: "json", json_schema: jsonSchema } },
    });

    // 2. Poll until it leaves queued/running.
    const deadline = Date.now() + POLL_LIMIT_MS;
    while (run.is_active) {
      if (Date.now() > deadline) {
        return Response.json(
          { error: `Task ${run.run_id} still ${run.status} after ${POLL_LIMIT_MS / 1000}s` },
          { status: 504 },
        );
      }
      await sleep(POLL_EVERY_MS);
      run = await client.taskRun.retrieve(run.run_id);
    }
    if (run.status !== "completed") {
      const reason = run.error?.message ?? run.status;
      return Response.json({ error: `Task ${run.status}: ${reason}` }, { status: 502 });
    }

    // 3. Fetch the output. `basis` carries the citations per output field.
    const { output } = await client.taskRun.result(run.run_id);
    if (output.type !== "json") throw new Error("Expected JSON output from task");

    const seen = new Map<string, Source>();
    for (const field of output.basis) {
      for (const c of field.citations ?? []) {
        if (!seen.has(c.url)) seen.set(c.url, { title: c.title ?? c.url, url: c.url });
      }
    }

    const body: RunResult = {
      brief: output.content as Brief,
      sources: [...seen.values()],
      note: `Parallel Task · ${PROCESSOR} · ${run.run_id}`,
    };
    return Response.json(body);
  } catch (err) {
    console.error("/api/task", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}

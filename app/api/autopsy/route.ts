import { z } from "zod";
import { parallel } from "@/lib/parallel";
import { AutopsySchema, type Autopsy } from "@/lib/franken";
import type { Source } from "@/lib/types";

export const maxDuration = 300;
const POLL_LIMIT_MS = 280_000;
const PROCESSOR = process.env.TASK_PROCESSOR ?? "base"; // lite is faster but shallower

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// POST { query } -> { startups, sources }
// Step 1: find dead startups in the space and take them apart (Parallel Task).
export async function POST(req: Request) {
  try {
    const { query } = await req.json();
    if (typeof query !== "string" || !query.trim()) {
      return Response.json({ error: "query is required" }, { status: 400 });
    }
    const client = parallel();

    const jsonSchema: Record<string, unknown> = z.toJSONSchema(AutopsySchema);
    delete jsonSchema.$schema;

    let run = await client.taskRun.create({
      input:
        `The user wants to build: "${query.trim()}". ` +
        `Find failed, shut-down startups in that space with well-documented post-mortems, ` +
        `and break each one down into its concrete product features and business decisions.`,
      processor: PROCESSOR,
      task_spec: { output_schema: { type: "json", json_schema: jsonSchema } },
    });

    const deadline = Date.now() + POLL_LIMIT_MS;
    while (run.is_active) {
      if (Date.now() > deadline) {
        return Response.json({ error: `Task still ${run.status}` }, { status: 504 });
      }
      await sleep(2_000);
      run = await client.taskRun.retrieve(run.run_id);
    }
    if (run.status !== "completed") {
      return Response.json(
        { error: `Task ${run.status}: ${run.error?.message ?? ""}` },
        { status: 502 },
      );
    }

    const { output } = await client.taskRun.result(run.run_id);
    if (output.type !== "json") throw new Error("Expected JSON output from task");

    const seen = new Map<string, Source>();
    for (const field of output.basis) {
      for (const c of field.citations ?? []) {
        if (!seen.has(c.url)) seen.set(c.url, { title: c.title ?? c.url, url: c.url });
      }
    }

    const { startups } = output.content as Autopsy;
    return Response.json({ startups: startups ?? [], sources: [...seen.values()] });
  } catch (err) {
    console.error("/api/autopsy", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}

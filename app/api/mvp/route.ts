import { z } from "zod";
import { MvpSchema } from "@/lib/franken";

export const maxDuration = 120;

type ResponsesOutput = {
  output?: { type: string; content?: { type: string; text?: string }[] }[];
};

// POST { query, parts: [{name, detail, startup}] } -> Mvp
// Step 3: turn the stitched-together parts into one startup idea and the
// content of its landing page (Parallel Responses API, JSON schema output).
export async function POST(req: Request) {
  try {
    const { query, parts } = (await req.json()) as {
      query: string;
      parts: { name: string; detail: string; startup: string }[];
    };
    if (!query || !Array.isArray(parts) || parts.length === 0) {
      return Response.json({ error: "query and parts are required" }, { status: 400 });
    }
    if (!process.env.PARALLEL_API_KEY) throw new Error("PARALLEL_API_KEY is not set");

    const schema: Record<string, unknown> = z.toJSONSchema(MvpSchema);
    delete schema.$schema;

    const res = await fetch("https://api.parallel.ai/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.PARALLEL_API_KEY}`,
      },
      body: JSON.stringify({
        model: "parallel",
        reasoning: { effort: "low" },
        text: { format: { type: "json_schema", name: "mvp", strict: true, schema } },
        input:
          `A founder wants to build: "${query}". They are stitching a new startup together from ` +
          `parts of dead startups. Combine these parts into ONE coherent, genuinely promising startup ` +
          `idea and write the content of its launch landing page. Be punchy and a little funny.\n\n` +
          parts.map((p) => `- ${p.name} (from ${p.startup}): ${p.detail}`).join("\n"),
      }),
    });
    if (!res.ok) throw new Error(`Responses ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as ResponsesOutput;

    const text = (data.output ?? [])
      .filter((o) => o.type === "message")
      .flatMap((o) => o.content ?? [])
      .filter((c) => c.type === "output_text")
      .map((c) => c.text ?? "")
      .join("");
    const parsed = MvpSchema.safeParse(
      JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)),
    );
    if (!parsed.success) throw new Error("The MVP came back in an unexpected shape. Try again.");

    return Response.json(parsed.data);
  } catch (err) {
    console.error("/api/mvp", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}

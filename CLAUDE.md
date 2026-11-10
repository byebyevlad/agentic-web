# Agentic Web Starter

Hackathon starter (Agentic Web Build Night, Parallel Web Systems). Theme: AI with web access.
Goal for the session: turn this into a product demo fast. Keep code small and readable.

@AGENTS.md

## Stack

- Next.js 16 (App Router) + React 19 + TypeScript, Tailwind CSS 4 (no config file, `@import "tailwindcss"` in `app/globals.css`)
- `parallel-web` (official Parallel TS SDK), key in `PARALLEL_API_KEY`
- `@anthropic-ai/sdk` for the optional Claude step, key in `ANTHROPIC_API_KEY`
- `zod` 4 for the brief schema
- Deployed to Vercel with `vercel --prod`

## Layout

```
app/page.tsx              Client page: input, Run, toggles, loading, results panel
app/api/search/route.ts   POST {query, useClaude?} -> Parallel Search (+ Claude brief)
app/api/task/route.ts     POST {query} -> Parallel Task run with JSON schema, polls to completion
lib/types.ts              BriefSchema (zod) and the RunResult type all routes return
lib/parallel.ts           Parallel client + search() wrapper
lib/brief.ts              Claude helper: excerpts -> Brief; plus no-LLM fallback
```

## Conventions

- Every route returns `RunResult` (`{ brief: {title, sections[]}, sources[], note? }`) or `{ error }` with a non-2xx status. The page renders `RunResult` only, so a new route that returns it works with the UI unchanged.
- `BriefSchema` in `lib/types.ts` is the single place to change the output shape. It feeds Claude's structured output, the Parallel Task `output_schema` (via `z.toJSONSchema`), and the UI. If you add fields, render them in `Results` in `app/page.tsx`.
- API keys are server-only: use them in `app/api/**` and `lib/**`, never in client components, never `NEXT_PUBLIC_`.
- Things meant to be tweaked are marked `EDIT ME` (app name, prompt, schema, processor).
- Tailwind utility classes inline; light theme only, large type (projector).

## Parallel API notes (checked against docs.parallel.ai and the installed SDK types)

- Search: `client.search({ objective, search_queries, mode })` -> `{ results: [{ url, title, excerpts }] }`. `search_queries` is required on `/v1/search` (objective alone returns 422). We currently pass the raw input as the only query; the docs say 1-3 short keyword queries work better, so generating them (e.g. with Claude) is an easy quality win. `max_results` etc. go inside `advanced_settings`.
- Task: `client.taskRun.create({ input, processor, task_spec: { output_schema: { type: "json", json_schema } } })`, then `client.taskRun.retrieve(run_id)` until `is_active` is false, then `client.taskRun.result(run_id)` -> `output.content` (JSON) and `output.basis[].citations` (sources). Processors: lite < base < core < pro < ultra.
- Also available and unused: `client.extract` (URL -> markdown), Task events (SSE), FindAll, Monitor. Docs index: https://docs.parallel.ai/llms.txt. Do not guess method names; check the docs or `node_modules/parallel-web/resources/*.d.ts`.

## Claude notes

- Model `claude-opus-5-5`, `client.messages.parse` with `output_config: { effort: "low", format: zodOutputFormat(BriefSchema) }`. Do not send `temperature` or `budget_tokens` (rejected on this model). Result is `res.parsed_output`.

## Commands

- `npm run dev`, `npm run build`, `npm run lint`, `npx tsc --noEmit`
- Vercel function limits: `maxDuration` is 60s for search and 300s for task. A Task run longer than that needs client-side polling (split into start + status routes).

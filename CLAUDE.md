# Agentic Web Starter

Hackathon starter (Agentic Web Build Night, Parallel Web Systems). Theme: AI with web access.
Goal for the session: turn this into a product demo fast. Keep code small and readable.

@AGENTS.md

## Product: Frankenstartup

Vague prompt ("make me a financial product") -> find dead startups in that space, take them apart into parts (features, pricing, team, funding...), ask per part "did this cause the failure?", and stitch the surviving parts into a new product.

- `app/api/autopsy/route.ts`: Parallel Responses API (`POST /v1/responses`, plain fetch, OpenAI-compatible, `reasoning.effort: low`, `text.format` JSON schema from `AutopsySchema` in `lib/franken.ts`) -> 4 dead startups x 4 parts in ~10s. The Task API gave the same data but took ~2 min.
- `app/api/decide/route.ts`: Parallel Decisions API (`POST /v1/decisions`, plain fetch, not in the SDK). One request per startup, three questions per part acting as a jury (`JUDGES` in `lib/franken.ts`): Coroner (`noul`: did it cause the death), VC (`choice`: copy/bury/unknown), Gambler (`score`: mistake..strength). Majority of judges who voted decides; `split` marks disagreement. Under 1s.
- `app/api/mvp/route.ts`: Parallel Responses API with `MvpSchema` -> name, tagline, pitch, 3 features, price, CTA for the stitched startup (~3s).
- `app/page.tsx`: dark "mad scientist lab" game. Idea chips for one-click runs. After the jury, all organs sit on a tray with verdicts hidden; the player drags (or taps) them onto the slab, each drop reveals the verdict and moves the live success rating. "I'm lazy" auto-picks the jury's choices. "Build my MVP" renders the generated landing page in a fake browser with a download button. Styles and animations in `app/globals.css`; display font Creepster via `next/font`.
- Design harvesting: `AutopsySchema` also asks for each dead startup's `design` (hex colours, typeface style, corners, layout, vibe). Each becomes a 🎨 "look" organ judged by the jury like any other part. `app/mvp-site.tsx` mixes the looks on the slab into one skin (`mixSkin`: colours from the first, typeface from the second, shapes from the third, layout from the fourth, wrapping around) and renders the landing page with inline styles in one of three layouts (centered, split, big type). Inline styles are deliberate: "Download site" saves the rendered DOM as standalone HTML. The harvested colours are the model's recollection of the brand, not scraped CSS.
- Dev quirk: Turbopack sometimes misses files changed from the shell; restart `npm run dev` if a change does not show.
- The older `/api/search` and `/api/task` routes and `lib/brief.ts` are unused by the page now.

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
- Tailwind utility classes inline; dark lab theme, large type (projector).

## Parallel API notes (checked against docs.parallel.ai and the installed SDK types)

- Search: `client.search({ objective, search_queries, mode })` -> `{ results: [{ url, title, excerpts }] }`. `search_queries` is required on `/v1/search` (objective alone returns 422). We currently pass the raw input as the only query; the docs say 1-3 short keyword queries work better, so generating them (e.g. with Claude) is an easy quality win. `max_results` etc. go inside `advanced_settings`.
- Task: `client.taskRun.create({ input, processor, task_spec: { output_schema: { type: "json", json_schema } } })`, then `client.taskRun.retrieve(run_id)` until `is_active` is false, then `client.taskRun.result(run_id)` -> `output.content` (JSON) and `output.basis[].citations` (sources). Processors: lite < base < core < pro < ultra.
- Also available and unused: `client.extract` (URL -> markdown), Task events (SSE), FindAll, Monitor. Docs index: https://docs.parallel.ai/llms.txt. Do not guess method names; check the docs or `node_modules/parallel-web/resources/*.d.ts`.

## Claude notes

- Model `claude-opus-5-5`, `client.messages.parse` with `output_config: { effort: "low", format: zodOutputFormat(BriefSchema) }`. Do not send `temperature` or `budget_tokens` (rejected on this model). Result is `res.parsed_output`.

## Commands

- `npm run dev`, `npm run build`, `npm run lint`, `npx tsc --noEmit`
- Vercel function limits: `maxDuration` is 60s for search and 300s for task. A Task run longer than that needs client-side polling (split into start + status routes).

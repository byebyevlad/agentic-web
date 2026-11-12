
# 🧟 Frankenstartup

**Dig up dead startups. Steal the good organs. Leave what killed them.**

One of the winning projects at [Agentic Web Build Night](https://luma.com/rytzr0zh), hosted by [Parallel Web Systems](https://parallel.ai) with The No Agenda Club in London on 11 November 2026: two hours of building, then live demos.

**Live:** https://agentic-web-rho.vercel.app

## What it does

Frankenstartup is a game for founders too lazy to do their own research. Give it a one-line idea, such as "food delivery", and it:

1. **Digs up** real startups in that space that failed, and takes each one apart into organs: features, pricing, business model, go-to-market, funding, and its visual design.
2. **Puts every organ on trial.** A jury of three judges rules on whether it helped or helped kill its host.
3. **Lets you play.** Drag organs onto the slab. Each drop reveals the verdict and moves a live success rating, from "⚰️ Dead on arrival" to "🦄 Unicorn material". Or press "I'm lazy" and the jury picks for you.
4. **Builds the MVP**: a name, pitch, features, pricing and a landing page whose colours, typeface, shapes and layout are stitched together from the dead startups' designs. You can download it as one HTML file.

<img width="1465" height="821" alt="Screenshot 2026-11-12 at 01 24 38" src="https://github.com/user-attachments/assets/8e2ab5ca-ae94-465f-8afd-7c3fcb7501d0" />
<img width="1448" height="835" alt="Screenshot 2026-11-12 at 01 24 59" src="https://github.com/user-attachments/assets/439c3660-69d4-465d-a606-750ad3549a03" />

## How it works

A Next.js app with three server routes. All the research, judging and writing runs on [Parallel's APIs](https://docs.parallel.ai), with no other AI provider.

| Step | Route | Parallel API | Time |
|---|---|---|---|
| Autopsy: find dead startups, their parts and their design | `/api/autopsy` | [Responses](https://docs.parallel.ai/responses-api/responses-quickstart.md), with a JSON schema | ~10–15s |
| Jury: judge every part | `/api/decide` | [Decisions](https://docs.parallel.ai/decisions/decisions-quickstart.md) | ~1s |
| MVP: write the landing page | `/api/mvp` | Responses, with a JSON schema | ~3s |

The jury is three Decisions question types asked about the same part in one request:

| Judge | Question type | Asks |
|---|---|---|
| 🧑‍⚕️ The Coroner | probability | Was it innocent of the death? |
| 🤑 The VC | choice: copy / bury / unknown | Would you copy it? |
| 🎲 The Gambler | score: mistake / neutral / strength | Mistake or strength? |

Each answer becomes a "worth copying" confidence, and the majority of the judges who answered decides. The game, the success rating and the design mixing all run in the browser.

Verdicts are estimates from web evidence, not ground truth, and the harvested design is the research model's account of each brand rather than scraped from the original sites.

## Run locally

```bash
npm install
cp .env.example .env.local   # add PARALLEL_API_KEY from https://platform.parallel.ai
npm run dev                  # http://localhost:3000
```

## Deploy to Vercel

```bash
npm i -g vercel
vercel login
vercel link
vercel env add PARALLEL_API_KEY production
vercel --prod
```

Redeploy with `vercel --prod` after code or env var changes.

## Code

- `app/page.tsx`: the game (tray, slab, success rating, jury card)
- `app/mvp-site.tsx`: the generated landing page and design mixing
- `app/api/autopsy`, `app/api/decide`, `app/api/mvp`: the three Parallel steps
- `lib/franken.ts`: schemas and the jury definition

`CLAUDE.md` has the full layout and conventions. The `/api/search` and `/api/task` routes are left over from the starter the project began as and are not used by the game.

Built with [Claude Code](https://claude.com/claude-code).

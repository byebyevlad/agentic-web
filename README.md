# Agentic Web Starter

Hackathon starter: Next.js + Parallel (web search / deep research) + optional Claude brief.

## Run locally

```bash
npm install
cp .env.example .env.local   # then fill in the keys
npm run dev                  # http://localhost:3000
```

Keys:
- `PARALLEL_API_KEY` (required): https://platform.parallel.ai
- `ANTHROPIC_API_KEY` (optional, enables the Claude summary): https://platform.claude.com

## Test the routes

```bash
curl -s localhost:3000/api/search -H 'content-type: application/json' \
  -d '{"query":"Parallel Web Systems company"}' | jq '.brief, .sources[:3]'

curl -s localhost:3000/api/task -H 'content-type: application/json' \
  -d '{"query":"Parallel Web Systems company"}' | jq
```

`/api/search` takes about 1-10s. `/api/task` polls a Parallel Task run and can take a minute or more.

## Deploy to Vercel

```bash
npm i -g vercel
vercel login
vercel link                              # create/link the project
vercel env add PARALLEL_API_KEY production
vercel env add ANTHROPIC_API_KEY production
vercel --prod
```

Redeploy after code changes with `vercel --prod`. Env var changes also need a redeploy.

## Where to edit

See `CLAUDE.md` for the file layout and conventions.

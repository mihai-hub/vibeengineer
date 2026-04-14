# VibeEngineer — Jeff's Build Context
> Jeff reads this before every VibeEngineer task. This is the source of truth.

---

## What VibeEngineer Is

VibeEngineer is a **consumer AI product** — the "Perplexity Computer for builders."

- **Perplexity Computer** = AI that controls your computer for general tasks
- **VibeEngineer** = AI that builds, ships, and runs software FOR you

Target user: founders, indie hackers, non-technical builders who want to go from idea → live product without hiring engineers.

Live at: `https://vibeengineer-918891972282.europe-west1.run.app`
GitHub: `mihai-hub/vibeengineer`
GCP project: `jeff-asi` (918891972282), region `europe-west1`

---

## Current Stack

- **Frontend**: Next.js 14 + TypeScript, dark theme, deployed on GCP Cloud Run
- **AI routes**: `/api/cto`, `/api/coo`, `/api/vibecode`, `/api/generate`, `/api/operate`, `/api/patch`
- **Pages**: `/` (landing), `/chat` (unified chat), `/builder`, `/advisors`, `/cto`, `/coo`
- **Lib**: `vibe-claw.ts` (security), `preflight-scan.ts`, `prompt-guardian.ts`, `task-checkpoint.ts`
- **Supabase**: same project as Jeff (`sxlgpsrbmkvzjfxitezn`)
- **Deploy**: `cloudbuild.yaml` → GCP Cloud Run

---

## The New Pipeline — FAST PATH + JEFF PATH

This is the core architectural change Jeff must build.

### Problem
Jeff's pipeline (E30→E33→E31→E51) takes 10-40s. That kills consumer UX.

### Solution: Two-lane routing

```
User message
     ↓
 classify (1 LLM call, <200ms)
     ↓
┌──────────────────┬─────────────────────┐
│  FAST LANE       │  BUILD LANE         │
│  chat/explain/   │  create/deploy/fix/ │
│  answer/suggest  │  build/run/ship     │
│                  │                     │
│  Claude direct   │  Jeff E51 agentic   │
│  stream <2s      │  full tool loop     │
│  no pipeline     │  10-40s, worth it   │
└──────────────────┴─────────────────────┘
```

### Fast Lane — what qualifies
- Explaining concepts, answering questions
- Suggesting tech stack or architecture
- Reviewing code snippets
- GTM / business strategy advice
- Any message under ~30 words with no action verb

### Build Lane — what qualifies
- "build me", "create", "generate", "deploy", "fix", "run", "ship", "add feature"
- Anything that requires actual code output or file changes
- Anything that needs tools (read_file, run_command, write_file)

### Implementation target
- New API route: `/api/vibe` — single entry point, replaces all the separate routes
- Intent classifier: 1 Claude Haiku call with simple system prompt → returns `{lane: "fast"|"build", intent: string}`
- Fast lane: streams Claude Sonnet directly, no overhead
- Build lane: calls Jeff backend (`https://api.jeff-asi.com/api/jeff/chat`) with E51 trigger phrase

---

## What Jeff Must Build (Priority Order)

### Phase 1 — The Pipeline (build this first)
1. `/api/vibe/route.ts` — unified entry point with intent classifier + lane router
2. Update `/app/chat/page.tsx` — wire to `/api/vibe`, show step cards (same as Jeff chat)
3. Fast lane: direct Claude stream, no UI overhead
4. Build lane: proxy to Jeff backend, show agentic steps inline

### Phase 2 — Consumer UI
5. Landing page redesign — hero: "Describe what you want. I'll build and ship it."
6. Step visualization — same AgentStepCard style as Jeff chat (already built in wellsassy-control-center)
7. Speed indicator — show users which lane they're in ("Fast answer" vs "Building…")

### Phase 3 — Perplexity Computer features
8. Skills — save reusable build recipes ("deploy to GCP", "add auth", "add Stripe")
9. User memory — remember their stack, their preferences, their previous projects
10. Local agent — downloadable Mac/Windows agent for real computer control

---

## Jeff's Role

Jeff is the **execution engine** behind VibeEngineer's Build Lane.

When VibeEngineer needs to actually build something:
- VibeEngineer calls Jeff's `/api/jeff/chat` with the task
- Jeff runs E51 agentic loop (reads files, writes code, runs commands, deploys)
- VibeEngineer streams Jeff's tool calls back to the user as step cards
- User sees: "Read package.json → Write app.tsx → Run npm build → Deploy to GCP"

Jeff does NOT handle the fast lane — that's direct Claude, no Jeff involved.

---

## Environment Variables Needed

```
ANTHROPIC_API_KEY=        # for fast lane direct Claude calls
JEFF_BACKEND_URL=https://api.jeff-asi.com   # for build lane
JEFF_API_KEY=             # Bearer token for Jeff backend
NEXT_PUBLIC_SUPABASE_URL= # same as Jeff's
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

---

## Key Files Jeff Will Touch

| File | Purpose |
|------|---------|
| `app/api/vibe/route.ts` | NEW — unified pipeline entry point |
| `app/chat/page.tsx` | UPDATE — wire to /api/vibe, add step cards |
| `app/page.tsx` | UPDATE — new landing hero copy |
| `lib/vibe-router.ts` | NEW — intent classifier logic |
| `components/StepCard.tsx` | NEW — copy AgentStepCard from Jeff |

---

## Rules for Jeff Building VibeEngineer

1. **Always run preflight scan** before touching any existing file — read it first
2. **Never break the existing routes** (`/api/cto`, `/api/coo`) until the new `/api/vibe` is tested
3. **TypeScript strict** — no `any`, no type suppressions
4. **Deploy after every working phase** — `gcloud builds submit` via `cloudbuild.yaml`
5. **Test the fast lane first** — get <2s response before touching the build lane
6. **Copy don't rewrite** — AgentStepCard already exists in wellsassy-control-center. Copy it, don't rebuild it.

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Fast lane response | <2s first token |
| Build lane visibility | Steps shown inline like Claude Code |
| Landing conversion | User understands in 5 seconds what it does |
| Perplexity parity | Same UX feel, builder-focused niche |

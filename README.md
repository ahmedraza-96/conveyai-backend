# ConveyAI — Backend

> AI-powered voice interview practice. Candidates speak with an AI interviewer, get an adaptive line of questioning based on the quality of their answers, and receive a scored post-call analysis with strengths and improvement areas.

**🔗 Live demo:** [https://conveyai.live](https://conveyai.live)
**🔗 Frontend repo:** [github.com/ahmedraza-96/conveyai-frontend](https://github.com/ahmedraza-96/conveyai-frontend)

---

## About this repository

This is a **public showcase mirror** of my Final Year Project — about a year of work. The active development repository is kept **private** because its commit history contains environment files with live API credentials (AWS, OpenAI, Vapi, ElevenLabs, Azure Speech, MongoDB Atlas, and others). Rewriting that history was less practical than publishing a clean snapshot, so this repo starts from a single "Initial public release" commit while the private repo continues to receive day-to-day work.

The code you see here is the same code that runs the live demo above — only secrets and deployment-specific values have been removed.

If you're reviewing my work and would like full commit-history access, a walkthrough of specific design decisions, or to pair on a section, reach out — I'm happy to share read access to the private repo.

---

## What it does

- 🎙️ **Voice-first interviews** — real-time spoken dialogue with an AI interviewer via [Vapi](https://vapi.ai). Users speak naturally; the AI replies and follows up.
- 🧠 **Adaptive engine** — question difficulty adjusts based on rolling answer quality. Strong candidates get harder questions; struggling ones get scaffolded ones.
- 📊 **Post-call scoring** — a background BullMQ worker runs an LLM analysis pass against a structured rubric and writes results to the user's dashboard.
- 📄 **Resume-aware preparation** — upload a resume, get tailored prep questions for the role.
- 📈 **Dashboard analytics** — score trends, category breakdowns, session history.
- 🎭 **Multi-modal interview types** — voice (Vapi), and optional video avatar (Tavus CVI).

## What I built (highlighted pieces)

- **Adaptive interview engine** that updates difficulty mid-call based on rolling answer scores — [`src/modules/voice-interview/adaptive-engine.ts`](src/modules/voice-interview/adaptive-engine.ts)
- **LLM-driven post-call analysis pipeline** running on BullMQ, with structured Zod-validated rubric output — [`src/queues/voice-interview-analysis.queue.ts`](src/queues/voice-interview-analysis.queue.ts), [`src/modules/voice-interview/rubric.ts`](src/modules/voice-interview/rubric.ts)
- **Auto-generated OpenAPI/Swagger** from Zod request/response schemas via a custom `MagicRouter` abstraction — every route is documented at definition time — [`src/openapi/magic-router.ts`](src/openapi/magic-router.ts)
- **Real-time Vapi integration** with a custom voice picker that previews ElevenLabs (English) and Azure Speech (Urdu) voices — [`src/lib/vapi.service.ts`](src/lib/vapi.service.ts), [`src/modules/voice-interview/voice-options.ts`](src/modules/voice-interview/voice-options.ts)
- **Production deployment**: AWS EC2 + PM2 + Caddy reverse proxy + GitHub Actions deploy pipeline that runs lint → test → audit → build → deploy on every push to `main`.

## Tech stack

| Layer | Tech |
|---|---|
| HTTP | Express 4, helmet, compression, cookie-parser |
| Language | TypeScript |
| Validation / docs | Zod + `@asteasolutions/zod-to-openapi`, Swagger UI |
| Database | MongoDB (Mongoose 8) |
| Cache / queue store | Redis (ioredis) |
| Background jobs | BullMQ + Bull Board |
| Auth | Passport (JWT), argon2 for password hashing, Google OAuth |
| Storage | AWS S3 (`@aws-sdk/client-s3`) for resume uploads |
| Email | Mailgun (with legacy SMTP fallback), React Email templates |
| LLM | OpenAI (primary), Google Gemini (fallback) |
| Voice | Vapi (orchestration), ElevenLabs + Azure Speech (TTS previews) |
| Avatar (optional) | Tavus CVI |
| Realtime | Socket.IO |
| Build / dev | tsup, tsx, dotenv-cli, concurrently |
| Tests | Vitest |
| Infra | AWS EC2, PM2, Caddy, GitHub Actions |

## Architecture (TL;DR)

Every feature lives under `src/modules/<name>/` and follows a strict layered convention:

```
constants → model → schema → service → controller → router
```

Routers wire into `MagicRouter`, which registers each route with the OpenAPI spec at definition time. This means **the Swagger documentation is always in sync with the code** — there's no manual `swagger.yaml` to drift.

Heavy work runs out-of-band on BullMQ queues defined in `src/queues/`. The flagship queue (`voice-interview-analysis.queue.ts`) is triggered by Vapi's call-ended webhook, runs an LLM scoring pass against a rubric, validates the output with Zod, and writes results back to MongoDB.

Auth is JWT-based via `passport-jwt` with a Redis-backed `express-session` store for OAuth callback flows.

The whole thing runs on a single EC2 instance behind Caddy (HTTPS termination + reverse proxy), managed by PM2.

## Local setup

```bash
pnpm install
cp .env.sample .env.development     # fill in values
pnpm start:dev                      # dev server
pnpm dev                            # ^ + React Email preview server

# Optional: local Mongo + Redis via docker
docker compose up -d
```

Required services for a fully functional local setup:
- MongoDB (or use the docker-compose)
- Redis (or use the docker-compose)
- AWS S3 bucket (for resume uploads)
- OpenAI API key
- Vapi account (private key + public key + webhook secret)
- Mailgun account
- ElevenLabs / Azure Speech (optional — only for voice preview samples)

See [`.env.sample`](.env.sample) for the full list. The Zod schema in [`src/config/config.service.ts`](src/config/config.service.ts) is the source of truth — the server refuses to boot if any required value is missing or malformed.

## Project scripts

| Script | What it does |
|---|---|
| `pnpm start:dev` | Watch-mode dev server (`.env.development`) |
| `pnpm dev` | Dev server + email-template preview |
| `pnpm build` | Bundle with tsup |
| `pnpm start:prod` | Run the built bundle (`.env.production`) |
| `pnpm test` / `pnpm test:watch` / `pnpm test:coverage` | Vitest |
| `pnpm lint` / `pnpm lint:fix` | ESLint |
| `pnpm seeder` | Seed admin / sample data |

## Deployment

The included GitHub Actions workflow (`.github/workflows/deploy-ec2.yml`) runs on every push to `main`:

1. **Lint** (ESLint)
2. **Test** (Vitest + coverage)
3. **Audit** (`pnpm audit --prod`)
4. **Build** (tsup)
5. **Deploy** — SCP the bundle to EC2, run `deploy.sh`, restart PM2, health-check

Deployment secrets required on the GitHub repo:

| Secret | Purpose |
|---|---|
| `EC2_HOST`, `EC2_USER`, `EC2_SSH_KEY` | SSH access to the EC2 host |
| `ENV_PRODUCTION` | Full contents of `.env.production`, written to the artifact at deploy time (this file is **not** committed to the repo) |

## License

MIT — see [`LICENSE`](LICENSE).

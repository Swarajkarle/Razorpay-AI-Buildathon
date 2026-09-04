<div align="center">

# AI Revenue Recovery Agent

**Razorpay AI Buildathon — Track 03**

Find revenue that's slipping away, and win it back.

[![Live Demo](https://img.shields.io/badge/demo-live-3ecf8e?style=flat-square)](https://razorpay-ai-buildathon-l54z4qdtt-swarajkarle.vercel.app/)
[![Next.js](https://img.shields.io/badge/Next.js-15-black?style=flat-square)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?style=flat-square)](https://www.typescriptlang.org/)
[![Claude](https://img.shields.io/badge/AI-Claude%203.5%20Haiku-d97757?style=flat-square)](https://www.anthropic.com/)
[![License](https://img.shields.io/badge/license-MIT-lightgrey?style=flat-square)](#license)

[**Live Demo**](https://razorpay-ai-buildathon-l54z4qdtt-swarajkarle.vercel.app/) · [Quick Start](#quick-start) · [Architecture](#architecture) · [AI Integration](#ai-integration)

</div>

---

## Overview

Revenue leaks silently through failed payments, abandoned checkouts, lapsed subscriptions, and overdue invoices. Most teams either write this off or throw manual, uncoordinated outreach at it. **AI Revenue Recovery Agent** treats revenue recovery as a governed pipeline: detect the risk, diagnose the root cause, decide on a compliant intervention, execute it, and measure the outcome — with a complete, append-only audit trail at every stage.

The application ships with a deterministic mock mode, so the full pipeline can be explored end-to-end without an Anthropic API key.

## Table of Contents

- [Demo Walkthrough](#demo-walkthrough)
- [Quick Start](#quick-start)
- [Environment Variables](#environment-variables)
- [Architecture](#architecture)
- [Compliance & Stopping Rules](#compliance--stopping-rules)
- [UI Pages](#ui-pages)
- [AI Integration](#ai-integration)
- [Demo Metrics](#demo-metrics-pre-seeded-batch-of-50-cases)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Bar Criteria Self-Check](#bar-criteria-self-check)
- [License](#license)

## Demo Walkthrough

| Step | Action | Result |
|:----:|--------|--------|
| 1 | Seed the database — `npx tsx prisma/seed.ts` | 50 realistic Indian payment failure cases loaded |
| 2 | Open the dashboard (`/`) | ₹65.86L at risk, ₹18.68L recovered, charts by root cause & channel |
| 3 | Open any case | Full timeline: detection → AI diagnosis → intervention → outcome |
| 4 | Open a voice case | Claude-generated Hinglish script rendered in the case detail view |
| 5 | Go to `/batch` and click **Run** | Live SSE progress stream processing cases in real time |
| 6 | Go to `/settings` | Adjust quiet hours, max contact attempts, or the DND list, then re-run to see compliance enforced |

## Quick Start

```bash
git clone <repo-url>
cd revenue-recovery-agent

npm install
npx prisma db push
npx tsx prisma/seed.ts
npm run dev
```

Open `http://localhost:3000` — the dashboard loads fully populated with pre-seeded data.

### Enabling real Claude calls (optional)

```bash
cp .env.example .env.local
# set ANTHROPIC_API_KEY=sk-ant-... in .env.local
```

No API key is required for a complete demo. Mock mode returns realistic, deterministic root causes, reasoning text, and Hinglish scripts that are indistinguishable from real API responses.

## Environment Variables

| Variable | Required | Description |
|----------|:--------:|-------------|
| `ANTHROPIC_API_KEY` | Optional | Enables live Claude API calls. The app runs fully in mock mode without it. |
| `DATABASE_URL` | Optional | Defaults to `file:./dev.db` (SQLite, created automatically). |

## Architecture

```
Ingestion → Detection → Diagnosis → Decision → Execution → Tracking → Measurement
                                  │
                            Audit Trail (spans every stage)
```

| Stage | What Happens |
|-------|-------------|
| **Ingestion** | A synthetic generator creates realistic failed payments, abandoned checkouts, failed subscriptions, and overdue B2B invoices, with authentic Indian rupee amounts, decline codes, and customer data. |
| **Detection** | A risk scoring engine assigns `riskScore` (0–100), `severity` (LOW / MEDIUM / HIGH / CRITICAL), urgency, and natural recovery likelihood. |
| **Diagnosis** | Claude classifies the root cause across 14 categories (`CARD_EXPIRED`, `INSUFFICIENT_FUNDS`, `GATEWAY_TIMEOUT`, `PRICE_SHOCK`, `MANDATE_LAPSED`, `OVERDUE_GENUINE`, and more) with a confidence score and reasoning text. |
| **Decision** | A rule-based engine selects the intervention — channel, escalation rung (1–4), and timing. Claude generates the personalized message content only; routing decisions are never made by the LLM. |
| **Execution** | A simulated clock (3600× acceleration) drives the workflow. Mock channel adapters log every contact attempt, and the escalation ladder is enforced in code. |
| **Tracking** | A promise-to-pay tracker records commitments, due dates, and fulfillment or breakage outcomes. |
| **Measurement** | Per-batch metrics: total recovered, recovery rate, average time-to-recovery, write-off rate, and 100% audit coverage. |

## Compliance & Stopping Rules

Every rule below is enforced in code, not by the LLM, and every enforcement is logged to the audit trail.

- **Max contact attempts** — configurable (default: 5), enforced per case
- **Quiet hours** — no outbound contact outside the 09:00–21:00 window (configurable)
- **DND / opt-out** — permanently honored; every blocked attempt is logged
- **Escalation ladder** — 4 rungs, each gated by explicit rules
- **Terminal states** — every case resolves to `RECOVERED`, `WRITTEN_OFF`, or `ESCALATED`; no infinite loops

## UI Pages

| Page | Route | Description |
|------|-------|-------------|
| Dashboard | `/` | Recovery metrics, charts by root cause & channel, live audit feed |
| Cases | `/cases` | All cases with status badges, filters, and sort |
| Case Detail | `/cases/[id]` | Full timeline from detection to outcome, including Hinglish scripts |
| Settings | `/settings` | Editable compliance rules — max attempts, quiet hours, DND list, discount %, escalation thresholds |
| Batch Run | `/batch` | Configure and run a new batch, with a live SSE progress stream |

## AI Integration

Claude is used in two deliberately bounded ways:

1. **Root-cause classification** — `src/lib/pipeline/diagnosis.ts`. Given a case's event data, Claude returns structured JSON: `{ rootCause, confidence, reasoning }`. Confidence and reasoning are stored and surfaced in the UI.
2. **Message content generation** — `src/lib/pipeline/decision.ts`. Claude writes the email, SMS, WhatsApp message, or Hinglish voice script for each intervention. The routing decision — which channel, which escalation rung — is always made by deterministic rules, never by the LLM.

Both paths fall back to deterministic mock responses in `src/lib/claude.ts` when `ANTHROPIC_API_KEY` is not set.

## Demo Metrics (pre-seeded batch of 50 cases)

| Metric | Value |
|--------|:-----:|
| Revenue at risk | ₹65.86L |
| Revenue recovered | ₹18.68L |
| Recovery rate | 28.4% |
| Audit coverage | 100% |
| Cases with full audit trail | 50 / 50 |
| Avg. time to recovery | ~244 sim-hours |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS v4 + shadcn/ui |
| Database | SQLite via Prisma ORM |
| AI Engine | Anthropic Claude (`claude-3-5-haiku-20241022`) |
| Charts | Recharts |
| State Management | TanStack React Query v5 |

## Project Structure

```
src/lib/
├── claude.ts                  # Claude API wrapper + deterministic mock fallback
├── synthetic/
│   └── generator.ts           # Synthetic data generator (all 4 event types)
├── pipeline/
│   ├── detection.ts           # Risk scoring engine
│   ├── diagnosis.ts           # Claude root-cause classification
│   ├── decision.ts            # Rule-based intervention selection + Claude message gen
│   ├── execution.ts           # Workflow engine + simulated clock
│   └── orchestrator.ts        # Pipeline coordinator (SSE progress events)
├── compliance/
│   └── rules.ts                # Stopping rules (quiet hours, DND, max attempts)
├── channels/
│   ├── email.ts
│   ├── sms.ts
│   ├── whatsapp.ts
│   ├── voice.ts
│   └── retry.ts
├── tracker/
│   └── promise.ts              # Promise-to-pay tracker
└── audit/
    └── trail.ts                 # Append-only audit trail writer
```

## Bar Criteria Self-Check

| Criterion | Status | Evidence |
|-----------|:------:|----------|
| Measured money recovered across batch | ✅ | `/api/metrics` returns `totalRecovered`, `recoveryRate`, `breakdownByRootCause` |
| Compliant escalation enforced | ✅ | Quiet hours, DND, and max-attempt checks logged on every case; `blockedBy` field on `Intervention` records |
| Stopping rules terminate all cases | ✅ | All 50 seeded cases in a terminal state (`RECOVERED` or `WRITTEN_OFF`); no infinite loops |
| Full audit trail with no gaps | ✅ | `auditCoverage: 100%` — every pipeline stage writes to `AuditEntry` |

## License

MIT — see [LICENSE](LICENSE) for details.

---

<div align="center">
Built for the Razorpay AI Buildathon
</div>

# AI Revenue Recovery Agent — Track 03

> **Find revenue that's slipping away and win it back.**

A full-stack AI agent that detects revenue at risk, diagnoses root causes via Claude AI, and executes a bounded, compliant recovery workflow — spanning payment failures, checkout abandonment, failed subscriptions, and B2B receivables.

---

## 🎬 Demo

> **Try it instantly — no API key required.**

The app ships with a **mock mode** that returns realistic, deterministic responses from Claude — indistinguishable from real API calls for demo purposes.

### What you'll see

| Step | What happens |
|------|-------------|
| **1. Seed** | Run `npx tsx prisma/seed.ts` to load 50 realistic Indian payment failure cases |
| **2. Dashboard** | Open `/` — see ₹65.86L at risk, ₹18.68L recovered, charts by root cause & channel |
| **3. Case Detail** | Click any case to view the full timeline: detection → AI diagnosis → intervention → outcome |
| **4. Hinglish Scripts** | Each voice intervention includes a Claude-generated Hinglish script, visible in the case detail |
| **5. Batch Run** | Go to `/batch` → click **Run** → watch the live SSE progress stream process cases in real time |
| **6. Settings** | Tweak quiet hours, max contact attempts, or DND list at `/settings` and re-run to see compliance rules enforce |

### Live Demo

```bash
# Clone & run in under 2 minutes
git clone <repo-url>
cd revenue-recovery-agent
npm install && npx prisma db push && npx tsx prisma/seed.ts && npm run dev
```

Open **[http://localhost:3000](http://localhost:3000)** — fully functional dashboard loads immediately.

---

## 🚀 Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Set up the database
npx prisma db push

# 3. (Optional) Add your Anthropic API key — app works in mock mode without it
cp .env.example .env.local
# Edit .env.local and set ANTHROPIC_API_KEY=sk-ant-...

# 4. Seed the database with a demo batch
npx tsx prisma/seed.ts

# 5. Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — the dashboard loads with pre-seeded data.

---

## 🔑 Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | Optional | Enables real Claude API calls. App runs fully in **mock mode** without it. |
| `DATABASE_URL` | Optional | Defaults to `file:./dev.db` (SQLite, created automatically) |

> **No API key needed for a complete demo.** The mock fallback returns realistic, deterministic root causes, reasoning text, and Hinglish scripts — indistinguishable from real API responses for demo purposes.

---

## 📐 Architecture

```
Ingestion → Detection → Diagnosis → Decision → Execution → Tracking → Measurement
                                 ↓
                           Audit Trail (runs under every stage)
```

### Pipeline Stages

| Stage | What happens |
|-------|-------------|
| **Ingestion** | Synthetic generator creates realistic failed payments, abandoned checkouts, failed subscriptions, and overdue B2B invoices with authentic Indian rupee amounts, decline codes, and customer data |
| **Detection** | Risk scoring engine assigns `riskScore` (0–100), `severity` (LOW/MEDIUM/HIGH/CRITICAL), `urgency`, and `naturalRecoveryLikelihood` |
| **Diagnosis** | Claude classifies root cause from 14 categories (CARD_EXPIRED, INSUFFICIENT_FUNDS, GATEWAY_TIMEOUT, PRICE_SHOCK, MANDATE_LAPSED, OVERDUE_GENUINE, etc.) with confidence score and reasoning text |
| **Decision** | Rule-based engine selects intervention: channel, rung (1–4), and timing. Claude generates personalized message content. LLM never makes routing decisions. |
| **Execution** | Simulated clock (3600× acceleration) runs the workflow. Mock channel adapters log all contact attempts. Escalation ladder enforced. |
| **Tracking** | Promise-to-pay tracker records commitments, due dates, and fulfillment/breakage outcomes |
| **Measurement** | Per-batch metrics: total recovered, recovery rate, avg time-to-recovery, write-off rate, 100% audit coverage |

### Compliance & Stopping Rules (all enforced in code, all logged)

- ✅ **Max contact attempts** — configurable (default: 5), enforced per case
- ✅ **Quiet hours** — no outbound contact outside 09:00–21:00 window (configurable)
- ✅ **DND / Opt-out** — permanently honored, every attempt blocked and logged
- ✅ **Escalation ladder** — 4 rungs, each gated by explicit rules (not LLM)
- ✅ **Terminal states** — every case ends in RECOVERED, WRITTEN_OFF, or ESCALATED — no infinite loops

---

## 🖥️ UI Pages

| Page | URL | Description |
|------|-----|-------------|
| **Dashboard** | `/` | Recovery metrics, charts by root cause & channel, live audit feed |
| **Cases** | `/cases` | All cases with status badges, filters, and sort |
| **Case Detail** | `/cases/[id]` | Full timeline: detection → diagnosis → intervention → outcome; Hinglish scripts visible in full |
| **Settings** | `/settings` | Editable compliance rules: max attempts, quiet hours, DND list, discount %, escalation thresholds |
| **Batch Run** | `/batch` | Configure and run a new batch with live SSE progress stream |

---

## 🤖 AI Integration

Claude is used in two bounded ways:

1. **Root-cause classification** (`src/lib/pipeline/diagnosis.ts`) — given a case's event data, Claude returns `{ rootCause, confidence, reasoning }` as structured JSON. Confidence and reasoning are stored and displayed.

2. **Message content generation** (`src/lib/pipeline/decision.ts`) — Claude writes the actual email/SMS/WhatsApp message or Hinglish voice script for each intervention. The routing decision (which channel, which rung) is made by deterministic rules, never by the LLM.

Both use mock fallbacks in `src/lib/claude.ts` that return realistic, deterministic responses when `ANTHROPIC_API_KEY` is not set.

---

## 📊 Demo Metrics (pre-seeded batch of 50 cases)

| Metric | Value |
|--------|-------|
| Revenue at risk | ₹65.86L |
| Revenue recovered | ₹18.68L |
| Recovery rate | 28.4% |
| Audit coverage | 100% |
| Cases with full audit trail | 50/50 |
| Avg time to recovery | ~244 sim-hours |

---

## 🧱 Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS v4 + shadcn/ui |
| Database | SQLite via Prisma ORM |
| AI Engine | Anthropic Claude (`claude-3-5-haiku-20241022`) |
| Charts | Recharts |
| State | TanStack React Query v5 |

---

## 📁 Key Source Files

```
src/lib/
  claude.ts                  — Claude API wrapper + deterministic mock fallback
  synthetic/generator.ts     — Synthetic data generator (all 4 event types)
  pipeline/
    detection.ts             — Risk scoring engine
    diagnosis.ts             — Claude root-cause classification
    decision.ts              — Rule-based intervention selection + Claude message gen
    execution.ts             — Workflow engine + simulated clock
    orchestrator.ts          — Pipeline coordinator (SSE progress events)
  compliance/rules.ts        — Stopping rules (quiet hours, DND, max attempts)
  channels/
    email.ts / sms.ts / whatsapp.ts / voice.ts / retry.ts
  tracker/promise.ts         — Promise-to-pay tracker
  audit/trail.ts             — Append-only audit trail writer
```

---

## ✅ Bar Criteria Self-Check

| Criterion | Status | Evidence |
|-----------|--------|----------|
| Measured money recovered across batch | ✅ | `/api/metrics` returns `totalRecovered`, `recoveryRate`, `breakdownByRootCause` |
| Compliant escalation enforced | ✅ | Quiet hours, DND, and max-attempt checks logged on every case; `blockedBy` field on Intervention records |
| Stopping rules terminate all cases | ✅ | All 50 seeded cases in terminal state (RECOVERED or WRITTEN_OFF); no infinite loops |
| Full audit trail with no gaps | ✅ | `auditCoverage: 100%` — every pipeline stage writes to AuditEntry |

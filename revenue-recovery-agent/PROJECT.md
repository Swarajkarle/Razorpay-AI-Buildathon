# AI Revenue Recovery Agent — PROJECT.md

## Project Context & Mission

**Track:** 03 — AI Revenue Recovery  
**Tagline:** Find revenue that's slipping away and win it back.

**Mission:** Build an agent that detects revenue at risk, determines the right intervention, and executes a bounded recovery workflow — spanning payment failures, checkout abandonment, and overdue receivables.

Revenue loss rarely happens in one clean step. A payment degrades, a checkout gets abandoned, a subscription fails, or an invoice goes overdue. This agent closes the loop: from detecting the problem, diagnosing it with AI, choosing the right intervention via explicit rules, to recovering the money — with a full measured outcome.

---

## Functional Requirements

### 2.1 Pipeline

```
Ingestion → Detection → Diagnosis → Decision → Execution → Tracking → Measurement
                                 ↓
                           Audit Trail (runs under every stage)
```

| Stage | Description |
|-------|-------------|
| **Ingestion** | Synthetic data generator producing failed card payments (with bank decline codes), abandoned checkouts, failed subscription renewals, and overdue B2B invoices. Configurable batch size and scenario mix. |
| **Detection** | Risk scoring: severity (0–100), revenue at stake, urgency tier, likelihood of natural recovery |
| **Diagnosis** | Claude API root-cause classification: card expired, insufficient funds, gateway timeout, bank decline, cart abandonment friction, genuine dispute, etc. Output includes model reasoning. |
| **Decision** | Rule-based intervention engine selects action and channel. Claude generates message content. Never purely LLM routing. |
| **Execution** | Simulated-clock workflow engine. All outbound contact mocked and logged behind channel-adapter interface. |
| **Tracking** | Promise-to-pay: log promises, due dates, fulfillment/breakage outcomes. |
| **Measurement** | Batch dashboard: total at risk, recovered, rate %, breakdowns by root cause and channel, time-to-recovery, write-off rate, audit coverage. |
| **Audit Trail** | Append-only, timestamped, per-event for every stage. Exportable. |

### 2.2 Architecture & Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14+ App Router |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS v4 + shadcn/ui components |
| Database | SQLite via Prisma ORM |
| AI Engine | Anthropic Claude API (`@anthropic-ai/sdk`) |
| Charts | Recharts |
| State | TanStack React Query v5 |
| Validation | Zod |

### 2.3 Required UI Surfaces

1. **Overview Dashboard** — recovered $ vs. at-risk $, recovery rate gauge, breakdown charts by root cause and channel, live audit-trail feed
2. **Case List** — all cases with status badges, filters, and sort
3. **Case Detail** — full timeline: detection → diagnosis (with reasoning) → intervention (with rationale) → actions → outcome → audit entries; Hinglish scripts visible in full
4. **Settings / Rules Panel** — editable: max contact attempts, quiet hours, escalation thresholds, DND list, discount % threshold
5. **Run Batch Control** — regenerate synthetic batch, configure mix, run full pipeline with live progress via SSE, final metrics summary

### 2.4 Compliance & Stopping Rules

All enforced in code, logged to audit trail:

- **Max N contact attempts** per case (configurable, default: 5)
- **Quiet hours** — no outbound contact outside configurable window (default: 09:00–21:00)
- **Opt-out / DND** — permanently honored once triggered; all subsequent attempts blocked and logged
- **Escalation ladder** (gated by explicit rules):
  1. Soft reminder
  2. Firm reminder
  3. Discount/payment-plan offer
  4. Human/collections handoff
- **Terminal states:** `RECOVERED`, `WRITTEN_OFF`, `ESCALATED` — no case loops indefinitely
- Every rule evaluation (pass or block) written to audit trail

### 2.5 Audit Trail

Append-only, timestamped entries for:
- Risk detected
- Diagnosis made (with reasoning)
- Intervention decided (with rationale)
- Action executed (channel, content summary)
- Compliance rule checked (PASS/BLOCK + reason)
- Outcome recorded
- Promise-to-pay logged/fulfilled/broken
- Case closed (terminal state + reason)

---

## Architecture

### Data Model

```
Batch ──< Case ──< Diagnosis
               ──< Intervention
               ──< AuditEntry
               ──< PromiseToPay
Settings (singleton)
```

**Case** fields: id, batchId, type, status, customerId, customerName, customerEmail, customerPhone, amount, currency, riskScore, severity, urgency, contactCount, isDND, createdAt, updatedAt

**Diagnosis** fields: id, caseId, rootCause (enum), confidence, reasoning, model, createdAt

**Intervention** fields: id, caseId, rung, channel, messageContent, scheduledAt, executedAt, outcome, blockedBy, complianceChecks (JSON)

**AuditEntry** fields: id, caseId, batchId, stage, event, details (JSON), timestamp, actor

**PromiseToPay** fields: id, caseId, amount, dueDate, madeAt, fulfilledAt, status

**Settings** fields: id, maxContactAttempts, quietHoursStart, quietHoursEnd, escalationThresholds (JSON), dndList (JSON), discountPct, paymentPlanMinAmount

### Module Breakdown

```
src/lib/
  prisma.ts              — Prisma client singleton
  claude.ts              — Claude API wrapper + mock fallback
  synthetic/
    generator.ts         — Synthetic event generator (all 4 types)
  pipeline/
    detection.ts         — Risk scoring engine
    diagnosis.ts         — Claude root-cause classification
    decision.ts          — Rule-based intervention selection
    execution.ts         — Workflow engine + simulated clock
    orchestrator.ts      — Pipeline coordinator
  compliance/
    rules.ts             — Stopping rules engine (quiet hours, DND, max attempts, escalation gates)
  channels/
    adapter.ts           — IChannelAdapter interface
    email.ts             — Mock email adapter
    sms.ts               — Mock SMS adapter
    whatsapp.ts          — Mock WhatsApp adapter
    voice.ts             — Mock voice/Hinglish adapter
    retry.ts             — Mock payment retry adapter
  tracker/
    promise.ts           — Promise-to-pay tracker
  audit/
    trail.ts             — Audit trail writer
```

### Channel Adapter Pattern

All outbound effects implement `IChannelAdapter`:
```typescript
interface IChannelAdapter {
  send(payload: OutboundPayload): Promise<SendResult>
  name: ChannelType
}
```
Real providers (Twilio, SendGrid) can be injected without changing pipeline logic.

---

## Feature List

- [x] Synthetic data generation (4 scenario types, configurable)
- [x] Risk scoring engine with severity/urgency classification
- [x] Claude-powered root-cause diagnosis with reasoning
- [x] Mock Claude fallback (full demo without API key)
- [x] Rule-based intervention decision engine
- [x] Escalation ladder (4 rungs, all gated)
- [x] Mock channel adapters (email, SMS, WhatsApp, voice, retry)
- [x] Hinglish voice/chat recovery scripts (Claude-generated)
- [x] Simulated clock with configurable acceleration
- [x] Promise-to-pay tracker
- [x] Append-only audit trail
- [x] Compliance engine (quiet hours, DND, max attempts, opt-out)
- [x] Overview dashboard with charts
- [x] Case list with filters
- [x] Case detail timeline (full audit + message text)
- [x] Settings/rules panel (editable thresholds)
- [x] Batch run control with live SSE progress
- [x] Metrics: recovery rate, avg time-to-recovery, write-off rate

---

## Constraints

1. **Mock-only external effects** — no email/SMS/calls actually sent; all mocked and logged
2. **Synthetic data only** — no real PII, no real payment data
3. **No real payment processing** — all payment retries are simulated
4. **No external database** — SQLite only, fully self-contained
5. **Mock AI fallback** — app runs without `ANTHROPIC_API_KEY`; deterministic mock returns realistic data
6. **Local run only** — `npm run dev` is the only command needed after setup

---

## Environment

Copy `.env.example` to `.env.local` and optionally fill in:
- `ANTHROPIC_API_KEY` — enables real Claude API calls; omit for mock mode
- `DATABASE_URL` — defaults to `file:./dev.db` (SQLite)

# PHASES.md — AI Revenue Recovery Agent

Feature-building development phases only. Prerequisite setup (scaffolding, dependency install, git init) is complete before this file exists.

---

## Phase 1 — Data Model & Synthetic Data Generation

### Tasks
- [x] Define Prisma schema: Batch, Case, Diagnosis, Intervention, AuditEntry, PromiseToPay, Settings
- [x] Run `prisma db push` to create SQLite tables
- [x] Seed default Settings row with sensible defaults
- [x] Implement synthetic generator for FAILED_PAYMENT events (with realistic decline codes: `insufficient_funds`, `card_expired`, `do_not_honor`, `gateway_timeout`, `lost_card`, `stolen_card`, `invalid_account`)
- [x] Implement synthetic generator for ABANDONED_CHECKOUT events (with inferred reasons: `price_shock`, `payment_friction`, `distraction`, `shipping_cost`, `trust_concern`)
- [x] Implement synthetic generator for FAILED_SUBSCRIPTION events (with reasons: `card_expired`, `insufficient_funds`, `account_closed`, `bank_decline`)
- [x] Implement synthetic generator for B2B_RECEIVABLE events (overdue invoices with aging: 30/60/90+ days)
- [x] Generator is configurable: batch size (10–200), type mix (%), severity distribution
- [x] Batch entity created and persisted on each run

**Completion criteria:** Running the generator produces a Batch with N Cases in the database, all 4 types present, with realistic fields.

---

## Phase 2 — Detection & Risk-Scoring Engine

### Tasks
- [x] Implement `detectRisk(event)` function computing:
  - `riskScore` (0–100) from amount, type, aging, decline severity
  - `severity`: LOW | MEDIUM | HIGH | CRITICAL
  - `urgency`: LOW | MEDIUM | HIGH (based on time-sensitivity and amount)
  - `naturalRecoveryLikelihood`: LOW | MEDIUM | HIGH (e.g. gateway timeouts have high natural recovery)
- [x] Persist riskScore, severity, urgency on Case
- [x] Write RISK_DETECTED audit entry for each case
- [x] Unit test: deterministic scores for known inputs

**Completion criteria:** Each Case in a batch has a computed riskScore and severity that correlates correctly with amount and type.

---

## Phase 3 — Diagnosis Engine (Claude-Powered)

### Tasks
- [x] Implement `claude.ts` wrapper with real API call + mock fallback
- [x] Mock fallback: deterministic, realistic root-cause by decline code / event type
- [x] Implement `diagnoseCause(case)` function:
  - Builds prompt from case fields
  - Calls Claude (or mock) for root-cause classification
  - Parses structured JSON response: `{ rootCause, confidence, reasoning }`
- [x] Root causes: CARD_EXPIRED, INSUFFICIENT_FUNDS, GATEWAY_TIMEOUT, BANK_DECLINE, LOST_STOLEN_CARD, ACCOUNT_CLOSED, PRICE_SHOCK, PAYMENT_FRICTION, SHIPPING_COST, TRUST_CONCERN, DISTRACTION, INVOICE_DISPUTE, OVERDUE_GENUINE, MANDATE_LAPSED
- [x] Persist Diagnosis record with reasoning text
- [x] Write DIAGNOSIS_MADE audit entry with reasoning
- [x] Case status updated to DIAGNOSING → (stays at DIAGNOSING until decision)

**Completion criteria:** Every case in a batch has a Diagnosis with rootCause, confidence (0–1), and non-empty reasoning. Works without API key.

---

## Phase 4 — Intervention Decision Engine + Compliance

### Tasks
- [x] Implement `decideIntervention(case, diagnosis, settings)`:
  - Rule table maps rootCause → preferred channel(s) and rung
  - CARD_EXPIRED → email with update-card link (rung 1)
  - INSUFFICIENT_FUNDS → soft SMS/WhatsApp nudge (rung 1), then offer payment plan (rung 3)
  - GATEWAY_TIMEOUT → immediate silent retry (rung 1), no contact
  - BANK_DECLINE → retry after 24h sim-hours, then email (rung 2)
  - PRICE_SHOCK / SHIPPING_COST → discount offer email (rung 3)
  - INVOICE_DISPUTE → email with invoice link + escalation (rung 2–4)
  - OVERDUE_GENUINE → B2B escalation ladder
  - MANDATE_LAPSED → eNACH re-registration flow
- [x] Implement compliance rules engine `checkCompliance(case, settings, simulatedTime)`:
  - `checkMaxAttempts(case)` — block if contactCount ≥ maxContactAttempts
  - `checkQuietHours(simulatedTime, settings)` — block if outside window
  - `checkDND(case)` — block permanently if isDND
  - Each check returns `{ allowed: boolean, rule: string, reason: string }`
- [x] All rule evaluations written to audit trail (PASS and BLOCK)
- [x] Write INTERVENTION_DECIDED audit entry with rationale
- [x] Case status updated to INTERVENING

**Completion criteria:** Different root causes select different channels/rungs. Compliance blocks are logged. DND cases never proceed to execution.

---

## Phase 5 — Execution Engine (Mock Adapters + Simulated Clock)

### Tasks
- [x] Implement `SimulatedClock`: wraps a start time with acceleration factor (default 3600× = 1 real second = 1 sim hour)
- [x] Implement `IChannelAdapter` interface
- [x] Implement mock adapters: EmailAdapter, SMSAdapter, WhatsAppAdapter, VoiceAdapter, RetryAdapter
  - Each logs to AuditEntry and returns `{ success: boolean, messageId: string, simulatedAt: Date }`
  - VoiceAdapter generates Hinglish script via Claude (or mock)
  - RetryAdapter simulates payment retry with configurable success probability per decline code
- [x] Implement `executeIntervention(case, intervention, adapters, clock)`:
  - Respects simulated schedule (waits sim-hours before firing)
  - On execution: calls adapter, logs result, increments contactCount
  - On success: updates case to RECOVERED, logs outcome
  - On failure: schedules next rung or terminal state
- [x] Escalation ladder state machine:
  - Rung 1 → Rung 2 (after sim N hours if no response)
  - Rung 2 → Rung 3 (after sim M hours)
  - Rung 3 → Rung 4 (offer made, no response)
  - Rung 4 → ESCALATED terminal state
- [x] If maxAttempts hit: set status to WRITTEN_OFF, log terminal audit entry
- [x] Hinglish scripts generated by Claude prompt; mock returns canned Hinglish+Hindi script

**Completion criteria:** A batch runs through all rungs in sim-time. Cases terminate in RECOVERED, WRITTEN_OFF, or ESCALATED. No case loops.

---

## Phase 6 — Promise-to-Pay Tracker

### Tasks
- [x] Implement `recordPromise(caseId, amount, dueDate)` — creates PromiseToPay record, logs audit entry
- [x] Implement `checkPromises(clock)` — evaluates all PENDING promises against simulated time:
  - If simulated now > dueDate and no fulfillment: mark BROKEN, schedule follow-up intervention
  - If payment confirmed: mark FULFILLED, set case to RECOVERED
- [x] B2B cases: promise-to-pay offered at rung 3
- [x] Subscription cases: promise offered after payment plan proposed
- [x] Dashboard shows: promises made, fulfilled, broken, pending

**Completion criteria:** Promises are tracked with correct terminal outcomes; broken promises trigger follow-up.

---

## Phase 7 — Audit Trail System

### Tasks
- [x] `AuditTrail.append(entry)` — writes immutable entry (never updates, only inserts)
- [x] Covers all stages: RISK_DETECTED, DIAGNOSIS_MADE, INTERVENTION_DECIDED, ACTION_EXECUTED, COMPLIANCE_CHECKED, OUTCOME_RECORDED, PROMISE_LOGGED, PROMISE_FULFILLED, PROMISE_BROKEN, CASE_CLOSED
- [x] API: `GET /api/audit?caseId=X` — per-case entries
- [x] API: `GET /api/audit?batchId=X` — batch-wide entries
- [x] API: `GET /api/audit/export?batchId=X` — JSON export
- [x] Audit coverage metric: % of cases with complete audit trail
- [x] UI: live audit feed on dashboard, full timeline on case detail

**Completion criteria:** Every pipeline event produces an audit entry. No gaps. Export produces valid JSON.

---

## Phase 8 — Dashboard UI

### Tasks
- [x] **Overview page** (`/`):
  - Recovered $ vs. At-risk $ cards with trend indicator
  - Recovery rate gauge/progress bar
  - Donut chart: breakdown by root cause
  - Bar chart: breakdown by channel/intervention
  - Live audit trail feed (last 20 entries, auto-refresh)
  - Batch selector (recent batches)
- [x] **Case list page** (`/cases`):
  - Table with: ID, type, customer, amount, root cause, status badge, last action, riskScore
  - Filter by status, type, severity
  - Sort by amount, riskScore, updatedAt
  - Pagination
- [x] **Case detail page** (`/cases/[id]`):
  - Header: customer info, amount, status badge
  - Timeline component: chronological events with icons
  - Diagnosis card: rootCause, confidence bar, full reasoning text
  - Intervention cards: rung, channel, message content (full text, incl. Hinglish)
  - Promise-to-pay section (if applicable)
  - Full audit log table
- [x] **Settings page** (`/settings`):
  - Form fields: maxContactAttempts, quietHoursStart, quietHoursEnd
  - DND list editor
  - Discount % threshold, payment plan minimum amount
  - Escalation rung timing (hours between rungs)
  - Save button with optimistic update
- [x] **Batch run page** (`/batch`):
  - Config: batch size, type mix sliders, severity distribution
  - Run button → SSE progress stream
  - Live log of cases being processed
  - Final results summary card

**Completion criteria:** All 5 pages render without error. Data flows correctly from API to UI. Charts display.

---

## Phase 9 — Batch Run Orchestration + End-to-End Validation

### Tasks
- [x] `POST /api/batch/run` — accepts config, runs full pipeline synchronously, returns batchId
- [x] `GET /api/batch/[id]/progress` — SSE stream of pipeline events
- [x] `GET /api/metrics?batchId=X` — returns: totalAtRisk, totalRecovered, recoveryRate, avgTimeToRecovery, costToRecoverPerCase, writeOffRate, auditCoverage, breakdownByRootCause, breakdownByChannel
- [x] Validate all bar criteria:
  - ✅ Measured money recovered across batch
  - ✅ Compliant escalation enforced (quiet hours, DND, max attempts logged)
  - ✅ Stopping rules terminate all cases
  - ✅ Full audit trail with no gaps
- [x] End-to-end test: generate batch of 50, run pipeline, assert all cases in terminal state

**Completion criteria:** Running a batch of 50 cases produces complete metrics with non-zero recovery amount and 100% audit coverage.

---

## Phase 10 — Polish & Demo Readiness

### Tasks
- [x] Seed a compelling default batch (50 cases, realistic mix, pre-run so dashboard has data on first load)
- [x] Write `README.md` for judges: setup, env vars, demo walkthrough
- [x] Final self-check against bar:
  - Measured money recovered ✅
  - Compliant escalation ✅
  - Stopping rules ✅
  - Full audit trail ✅
- [x] Visual polish: consistent design system, dark mode support, loading states, empty states
- [x] Performance: batch of 100 cases completes pipeline in < 30 seconds in mock mode

**Completion criteria:** App starts with `npm run dev`, dashboard shows pre-seeded results, all 4 bar criteria verified.

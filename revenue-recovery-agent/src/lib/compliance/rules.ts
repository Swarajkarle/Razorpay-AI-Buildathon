/**
 * Compliance & Stopping Rules Engine
 * All rules are enforced here. Never relies on LLM for compliance decisions.
 * Every check result is returned for audit trail logging.
 */

import type { ComplianceCheck } from '@/types';

export interface ComplianceContext {
  caseId: string;
  contactCount: number;
  isDND: boolean;
  currentRung: number;
  simulatedHour: number; // 0-23, local hour in simulated time
  settings: {
    maxContactAttempts: number;
    quietHoursStart: number;
    quietHoursEnd: number;
    dndList: string[];
    rung1DelayHours: number;
    rung2DelayHours: number;
    rung3DelayHours: number;
    rung4DelayHours: number;
  };
  customerId: string;
  amount: number;
  hoursOnCurrentRung: number; // how many sim-hours since last rung attempt
}

export interface ComplianceResult {
  allowed: boolean;
  checks: ComplianceCheck[];
  blockedBy?: string;
  blockedReason?: string;
}

// ─── Individual rule checks ──────────────────────────────────────────────────

function checkMaxAttempts(ctx: ComplianceContext): ComplianceCheck {
  const allowed = ctx.contactCount < ctx.settings.maxContactAttempts;
  return {
    rule: 'MAX_CONTACT_ATTEMPTS',
    allowed,
    reason: allowed
      ? `Contact count ${ctx.contactCount} is below max ${ctx.settings.maxContactAttempts}`
      : `Contact count ${ctx.contactCount} has reached max ${ctx.settings.maxContactAttempts} — case must be escalated or written off`,
    checkedAt: new Date().toISOString(),
  };
}

function checkDND(ctx: ComplianceContext): ComplianceCheck {
  const inDNDList = ctx.settings.dndList.includes(ctx.customerId);
  const isDND = ctx.isDND || inDNDList;
  return {
    rule: 'DND_CHECK',
    allowed: !isDND,
    reason: isDND
      ? `Customer ${ctx.customerId} is on DND/opt-out list — all outbound contact permanently blocked`
      : `Customer ${ctx.customerId} is not on DND list`,
    checkedAt: new Date().toISOString(),
  };
}

function checkQuietHours(ctx: ComplianceContext): ComplianceCheck {
  const { quietHoursStart, quietHoursEnd } = ctx.settings;
  const hour = ctx.simulatedHour;
  const allowed = hour >= quietHoursStart && hour < quietHoursEnd;
  return {
    rule: 'QUIET_HOURS',
    allowed,
    reason: allowed
      ? `Simulated hour ${hour}:00 is within contact window ${quietHoursStart}:00–${quietHoursEnd}:00`
      : `Simulated hour ${hour}:00 is outside quiet-hours window ${quietHoursStart}:00–${quietHoursEnd}:00 — contact deferred`,
    checkedAt: new Date().toISOString(),
  };
}

function checkRungDelay(ctx: ComplianceContext): ComplianceCheck {
  const rungDelays = [0, ctx.settings.rung1DelayHours, ctx.settings.rung2DelayHours, ctx.settings.rung3DelayHours, ctx.settings.rung4DelayHours];
  const nextRung = Math.min(ctx.currentRung + 1, 4);
  const requiredDelay = rungDelays[nextRung] ?? ctx.settings.rung4DelayHours;
  const allowed = ctx.hoursOnCurrentRung >= requiredDelay;
  return {
    rule: 'ESCALATION_GATE',
    allowed,
    reason: allowed
      ? `${ctx.hoursOnCurrentRung.toFixed(1)} hours elapsed since rung ${ctx.currentRung}, required ${requiredDelay}h — gate open`
      : `Only ${ctx.hoursOnCurrentRung.toFixed(1)} hours elapsed since rung ${ctx.currentRung}, required ${requiredDelay}h — gate closed`,
    checkedAt: new Date().toISOString(),
  };
}

// ─── Main compliance check ───────────────────────────────────────────────────

export function checkCompliance(ctx: ComplianceContext): ComplianceResult {
  const checks: ComplianceCheck[] = [];

  // 1. DND check (highest priority — always first)
  const dndCheck = checkDND(ctx);
  checks.push(dndCheck);
  if (!dndCheck.allowed) {
    return { allowed: false, checks, blockedBy: 'DND_CHECK', blockedReason: dndCheck.reason };
  }

  // 2. Max contact attempts
  const maxCheck = checkMaxAttempts(ctx);
  checks.push(maxCheck);
  if (!maxCheck.allowed) {
    return { allowed: false, checks, blockedBy: 'MAX_CONTACT_ATTEMPTS', blockedReason: maxCheck.reason };
  }

  // 3. Quiet hours (for rung 1+)
  if (ctx.currentRung >= 0) {
    const quietCheck = checkQuietHours(ctx);
    checks.push(quietCheck);
    if (!quietCheck.allowed) {
      return { allowed: false, checks, blockedBy: 'QUIET_HOURS', blockedReason: quietCheck.reason };
    }
  }

  // 4. Escalation gate timing (for rung 2+)
  if (ctx.currentRung >= 1) {
    const rungCheck = checkRungDelay(ctx);
    checks.push(rungCheck);
    if (!rungCheck.allowed) {
      return { allowed: false, checks, blockedBy: 'ESCALATION_GATE', blockedReason: rungCheck.reason };
    }
  }

  return { allowed: true, checks };
}

// ─── Terminal state check ────────────────────────────────────────────────────

export interface TerminalDecision {
  shouldTerminate: boolean;
  terminalState?: 'WRITTEN_OFF' | 'ESCALATED';
  reason?: string;
}

export function shouldTerminate(params: {
  contactCount: number;
  currentRung: number;
  maxContactAttempts: number;
  simDaysSinceEvent: number;
  writeOffAfterDays: number;
}): TerminalDecision {
  // Exceeded max contact attempts
  if (params.contactCount >= params.maxContactAttempts) {
    return {
      shouldTerminate: true,
      terminalState: 'WRITTEN_OFF',
      reason: `Reached max contact attempts (${params.contactCount}/${params.maxContactAttempts}) with no recovery`,
    };
  }

  // Exceeded write-off time window
  if (params.simDaysSinceEvent >= params.writeOffAfterDays) {
    return {
      shouldTerminate: true,
      terminalState: 'WRITTEN_OFF',
      reason: `Case age ${params.simDaysSinceEvent} sim-days exceeds write-off threshold of ${params.writeOffAfterDays} days`,
    };
  }

  // Reached rung 4 (human handoff is the terminal action)
  if (params.currentRung >= 4) {
    return {
      shouldTerminate: true,
      terminalState: 'ESCALATED',
      reason: `Case escalated to human collections team after ${params.contactCount} automated attempts across all escalation rungs`,
    };
  }

  return { shouldTerminate: false };
}

/**
 * Detection & Risk-Scoring Engine
 * Scores each incoming case for severity, urgency, and recovery likelihood.
 */

import type { CaseType, Severity, Urgency, NaturalRecoveryLikelihood, DeclineCode } from '@/types';

export interface RiskAssessment {
  riskScore: number; // 0-100
  severity: Severity;
  urgency: Urgency;
  naturalRecoveryLikelihood: NaturalRecoveryLikelihood;
}

// ─── Severity rules ──────────────────────────────────────────────────────────

function computeSeverity(amount: number, caseType: CaseType): Severity {
  if (caseType === 'B2B_RECEIVABLE') {
    if (amount >= 1000000) return 'CRITICAL';
    if (amount >= 250000) return 'HIGH';
    if (amount >= 50000) return 'MEDIUM';
    return 'LOW';
  }
  if (amount >= 75000) return 'CRITICAL';
  if (amount >= 15000) return 'HIGH';
  if (amount >= 2000) return 'MEDIUM';
  return 'LOW';
}

// ─── Urgency rules ───────────────────────────────────────────────────────────

function computeUrgency(
  caseType: CaseType,
  eventMetadata: Record<string, unknown>,
  eventOccurredAt: Date
): Urgency {
  const hoursOld = (Date.now() - eventOccurredAt.getTime()) / (1000 * 60 * 60);

  if (caseType === 'ABANDONED_CHECKOUT') {
    // Checkout abandonment recoveries degrade rapidly
    if (hoursOld < 1) return 'HIGH';
    if (hoursOld < 6) return 'HIGH';
    if (hoursOld < 24) return 'MEDIUM';
    return 'LOW';
  }

  if (caseType === 'B2B_RECEIVABLE') {
    const agingDays = (eventMetadata.agingDays as number) || 30;
    if (agingDays >= 90) return 'HIGH';
    if (agingDays >= 60) return 'HIGH';
    if (agingDays >= 30) return 'MEDIUM';
    return 'LOW';
  }

  if (caseType === 'FAILED_PAYMENT') {
    const declineCode = eventMetadata.declineCode as DeclineCode;
    // Gateway timeouts are urgent but self-heal; card issues are less urgent
    if (declineCode === 'gateway_timeout') return 'HIGH'; // Retry NOW
    if (declineCode === 'insufficient_funds') return 'MEDIUM'; // Wait a few days
    if (declineCode === 'card_expired') return 'MEDIUM'; // Customer action needed
    return 'LOW';
  }

  if (caseType === 'FAILED_SUBSCRIPTION') {
    const planInterval = eventMetadata.planInterval as string;
    if (planInterval === 'ANNUAL') return 'HIGH'; // Large annual sum
    if (planInterval === 'QUARTERLY') return 'MEDIUM';
    return 'MEDIUM';
  }

  return 'MEDIUM';
}

// ─── Natural recovery likelihood ─────────────────────────────────────────────

function computeNaturalRecoveryLikelihood(
  caseType: CaseType,
  eventMetadata: Record<string, unknown>
): NaturalRecoveryLikelihood {
  if (caseType === 'FAILED_PAYMENT' || caseType === 'FAILED_SUBSCRIPTION') {
    const declineCode = eventMetadata.declineCode as DeclineCode;
    const highNatural: DeclineCode[] = ['gateway_timeout', 'restricted_card'];
    const medNatural: DeclineCode[] = ['insufficient_funds', 'do_not_honor'];
    if (highNatural.includes(declineCode)) return 'HIGH';
    if (medNatural.includes(declineCode)) return 'MEDIUM';
    return 'LOW';
  }

  if (caseType === 'ABANDONED_CHECKOUT') {
    const reason = eventMetadata.abandonmentReason as string;
    if (reason === 'distraction') return 'MEDIUM'; // May come back on own
    return 'LOW'; // Needs intervention
  }

  if (caseType === 'B2B_RECEIVABLE') {
    const agingDays = (eventMetadata.agingDays as number) || 30;
    if (agingDays < 30) return 'MEDIUM';
    return 'LOW';
  }

  return 'LOW';
}

// ─── Risk score computation ───────────────────────────────────────────────────

function computeRiskScore(
  amount: number,
  severity: Severity,
  urgency: Urgency,
  naturalRecovery: NaturalRecoveryLikelihood,
  caseType: CaseType,
  eventMetadata: Record<string, unknown>
): number {
  // Base score from amount (0-40 points)
  const maxAmount = caseType === 'B2B_RECEIVABLE' ? 5000000 : 500000;
  const amountScore = Math.min(40, (amount / maxAmount) * 40);

  // Severity score (0-25 points)
  const severityScores: Record<Severity, number> = { LOW: 5, MEDIUM: 12, HIGH: 20, CRITICAL: 25 };
  const severityScore = severityScores[severity];

  // Urgency score (0-20 points)
  const urgencyScores: Record<Urgency, number> = { LOW: 5, MEDIUM: 12, HIGH: 20 };
  const urgencyScore = urgencyScores[urgency];

  // Natural recovery penalty (-15 to 0 points) — high natural recovery = lower risk score
  const recoveryPenalties: Record<NaturalRecoveryLikelihood, number> = { LOW: 0, MEDIUM: -7, HIGH: -15 };
  const recoveryPenalty = recoveryPenalties[naturalRecovery];

  // Type-specific modifiers
  let typeBonus = 0;
  if (caseType === 'B2B_RECEIVABLE') {
    const aging = (eventMetadata.agingDays as number) || 30;
    typeBonus = Math.min(15, (aging / 120) * 15); // Up to 15 bonus for aging
  }

  const raw = amountScore + severityScore + urgencyScore + recoveryPenalty + typeBonus;
  return Math.min(100, Math.max(0, Math.round(raw)));
}

// ─── Main export ─────────────────────────────────────────────────────────────

export function detectRisk(params: {
  amount: number;
  caseType: CaseType;
  eventOccurredAt: Date;
  eventMetadata: Record<string, unknown>;
}): RiskAssessment {
  const { amount, caseType, eventOccurredAt, eventMetadata } = params;

  const severity = computeSeverity(amount, caseType);
  const urgency = computeUrgency(caseType, eventMetadata, eventOccurredAt);
  const naturalRecoveryLikelihood = computeNaturalRecoveryLikelihood(caseType, eventMetadata);
  const riskScore = computeRiskScore(amount, severity, urgency, naturalRecoveryLikelihood, caseType, eventMetadata);

  return { riskScore, severity, urgency, naturalRecoveryLikelihood };
}

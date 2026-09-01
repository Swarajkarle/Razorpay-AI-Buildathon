/**
 * Audit Trail System
 * Append-only, timestamped log for every pipeline event.
 * Never updates existing entries — only inserts.
 */

import prisma from '@/lib/prisma';
import type { AuditStage, AuditEvent, Actor } from '@/types';

export interface AuditEntryInput {
  caseId?: string;
  batchId?: string;
  stage: AuditStage;
  event: AuditEvent;
  details: Record<string, unknown>;
  actor?: Actor;
  simulatedAt?: Date;
}

/**
 * Append an entry to the audit trail. Never modifies existing entries.
 */
export async function appendAuditEntry(input: AuditEntryInput): Promise<void> {
  await prisma.auditEntry.create({
    data: {
      caseId: input.caseId ?? null,
      batchId: input.batchId ?? null,
      stage: input.stage,
      event: input.event,
      details: JSON.stringify(input.details),
      actor: input.actor ?? 'SYSTEM',
      simulatedAt: input.simulatedAt ?? null,
      // timestamp is set by @default(now()) — immutable
    },
  });
}

/**
 * Get all audit entries for a case, ordered chronologically.
 */
export async function getCaseAuditTrail(caseId: string) {
  return prisma.auditEntry.findMany({
    where: { caseId },
    orderBy: { timestamp: 'asc' },
  });
}

/**
 * Get all audit entries for a batch, ordered chronologically.
 */
export async function getBatchAuditTrail(batchId: string) {
  return prisma.auditEntry.findMany({
    where: { batchId },
    orderBy: { timestamp: 'asc' },
  });
}

/**
 * Get recent audit entries (for live feed on dashboard).
 */
export async function getRecentAuditEntries(limit = 50) {
  return prisma.auditEntry.findMany({
    orderBy: { timestamp: 'desc' },
    take: limit,
    include: { case: { select: { customerName: true, amount: true, type: true } } },
  });
}

/**
 * Compute audit coverage for a batch:
 * % of cases that have all key audit events recorded.
 */
export async function computeAuditCoverage(batchId: string): Promise<number> {
  const cases = await prisma.case.findMany({
    where: { batchId },
    select: { id: true },
  });

  if (cases.length === 0) return 0;

  let coveredCount = 0;
  for (const c of cases) {
    const events = await prisma.auditEntry.findMany({
      where: { caseId: c.id },
      select: { event: true },
    });
    const eventSet = new Set(events.map(e => e.event));

    // A case is "covered" if it has at least these events
    const required: AuditEvent[] = ['RISK_DETECTED', 'DIAGNOSIS_MADE', 'CASE_CLOSED'];
    const hasCoverage = required.every(e => eventSet.has(e));
    if (hasCoverage) coveredCount++;
  }

  return Math.round((coveredCount / cases.length) * 100);
}

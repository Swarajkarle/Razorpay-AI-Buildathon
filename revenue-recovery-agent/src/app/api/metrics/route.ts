import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { computeAuditCoverage } from '@/lib/audit/trail';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const batchId = searchParams.get('batchId');

  if (!batchId) {
    // Return metrics for the latest batch
    const latestBatch = await prisma.batch.findFirst({ orderBy: { createdAt: 'desc' } });
    if (!latestBatch) {
      return NextResponse.json({ error: 'No batches found' }, { status: 404 });
    }
    return computeMetrics(latestBatch.id);
  }

  return computeMetrics(batchId);
}

async function computeMetrics(batchId: string) {
  const batch = await prisma.batch.findUnique({ where: { id: batchId } });
  if (!batch) return NextResponse.json({ error: 'Batch not found' }, { status: 404 });

  const cases = await prisma.case.findMany({
    where: { batchId },
    include: {
      diagnosis: { select: { rootCause: true } },
      interventions: { select: { channel: true, outcome: true } },
    },
  });

  // Recovery time analysis
  const recoveredCases = cases.filter(c => c.status === 'RECOVERED' && c.recoveredAt && c.eventOccurredAt);
  const avgTimeToRecoveryHours = recoveredCases.length > 0
    ? recoveredCases.reduce((sum, c) => {
        const diff = (c.recoveredAt!.getTime() - c.eventOccurredAt.getTime()) / (1000 * 60 * 60);
        return sum + diff;
      }, 0) / recoveredCases.length
    : 0;

  // Breakdown by root cause
  const breakdownByRootCause: Record<string, { count: number; recovered: number; atRisk: number }> = {};
  for (const c of cases) {
    const rc = c.diagnosis?.rootCause ?? 'UNKNOWN';
    if (!breakdownByRootCause[rc]) breakdownByRootCause[rc] = { count: 0, recovered: 0, atRisk: 0 };
    breakdownByRootCause[rc].count++;
    breakdownByRootCause[rc].atRisk += c.amount;
    if (c.status === 'RECOVERED') breakdownByRootCause[rc].recovered += c.recoveredAmount ?? c.amount;
  }

  // Breakdown by channel
  const breakdownByChannel: Record<string, { count: number; successCount: number }> = {};
  for (const c of cases) {
    for (const inv of c.interventions) {
      const ch = inv.channel;
      if (!breakdownByChannel[ch]) breakdownByChannel[ch] = { count: 0, successCount: 0 };
      breakdownByChannel[ch].count++;
      if (inv.outcome === 'PAYMENT_SUCCEEDED' || inv.outcome === 'DELIVERED') {
        breakdownByChannel[ch].successCount++;
      }
    }
  }

  // Breakdown by type
  const breakdownByType: Record<string, { count: number; recovered: number; atRisk: number }> = {};
  for (const c of cases) {
    if (!breakdownByType[c.type]) breakdownByType[c.type] = { count: 0, recovered: 0, atRisk: 0 };
    breakdownByType[c.type].count++;
    breakdownByType[c.type].atRisk += c.amount;
    if (c.status === 'RECOVERED') breakdownByType[c.type].recovered += c.recoveredAmount ?? c.amount;
  }

  const auditCoverage = await computeAuditCoverage(batchId);

  // Cost-to-recover estimation (mock: $0.50 per contact attempt in operational cost)
  const totalContactAttempts = cases.reduce((sum, c) => sum + c.contactCount, 0);
  const costToRecoverPerCase = batch.recoveredCount > 0
    ? (totalContactAttempts * 0.5) / batch.recoveredCount
    : 0;

  return NextResponse.json({
    batchId,
    totalAtRisk: batch.totalAtRisk,
    totalRecovered: batch.totalRecovered,
    recoveryRate: batch.totalAtRisk > 0 ? (batch.totalRecovered / batch.totalAtRisk) * 100 : 0,
    caseCount: batch.caseCount,
    recoveredCount: batch.recoveredCount,
    writtenOffCount: batch.writtenOffCount,
    escalatedCount: batch.escalatedCount,
    avgTimeToRecoveryHours: Math.round(avgTimeToRecoveryHours * 10) / 10,
    writeOffRate: batch.caseCount > 0 ? (batch.writtenOffCount / batch.caseCount) * 100 : 0,
    auditCoverage,
    costToRecoverPerCase: Math.round(costToRecoverPerCase * 100) / 100,
    breakdownByRootCause,
    breakdownByChannel,
    breakdownByType,
    startedAt: batch.startedAt,
    completedAt: batch.completedAt,
  });
}

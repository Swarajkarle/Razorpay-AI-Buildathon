import { NextRequest, NextResponse } from 'next/server';
import { runBatchPipeline } from '@/lib/pipeline/orchestrator';
import type { BatchConfig } from '@/types';
import { DEFAULT_BATCH_CONFIG } from '@/types';

export const maxDuration = 300; // 5 minutes for batch processing

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const config: BatchConfig = {
      batchSize: body.batchSize ?? DEFAULT_BATCH_CONFIG.batchSize,
      typeMix: body.typeMix ?? DEFAULT_BATCH_CONFIG.typeMix,
      severityDist: body.severityDist ?? DEFAULT_BATCH_CONFIG.severityDist,
    };

    // Validate
    const totalMix = Object.values(config.typeMix).reduce((a, b) => a + b, 0);
    if (totalMix === 0) {
      return NextResponse.json({ error: 'typeMix percentages must sum to > 0' }, { status: 400 });
    }
    if (config.batchSize < 1 || config.batchSize > 200) {
      return NextResponse.json({ error: 'batchSize must be between 1 and 200' }, { status: 400 });
    }

    // Run pipeline synchronously (for SSE use /api/batch/stream instead)
    const batchId = await runBatchPipeline(config);

    return NextResponse.json({ success: true, batchId });
  } catch (error) {
    console.error('[API/batch] Error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function GET() {
  const { prisma } = await import('@/lib/prisma');
  const batches = await prisma.batch.findMany({
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: {
      id: true,
      config: true,
      startedAt: true,
      completedAt: true,
      totalAtRisk: true,
      totalRecovered: true,
      caseCount: true,
      recoveredCount: true,
      writtenOffCount: true,
      escalatedCount: true,
    },
  });

  return NextResponse.json(batches.map(b => ({
    ...b,
    recoveryRate: b.totalAtRisk > 0 ? (b.totalRecovered / b.totalAtRisk) * 100 : 0,
  })));
}

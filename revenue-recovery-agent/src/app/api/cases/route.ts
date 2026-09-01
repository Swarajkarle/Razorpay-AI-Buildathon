import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const batchId = searchParams.get('batchId');
  const status = searchParams.get('status');
  const type = searchParams.get('type');
  const severity = searchParams.get('severity');
  const page = parseInt(searchParams.get('page') ?? '1');
  const limit = parseInt(searchParams.get('limit') ?? '20');
  const sortBy = searchParams.get('sortBy') ?? 'updatedAt';
  const sortDir = searchParams.get('sortDir') === 'asc' ? 'asc' : 'desc';

  const where: Record<string, unknown> = {};
  if (batchId) where.batchId = batchId;
  if (status) where.status = status;
  if (type) where.type = type;
  if (severity) where.severity = severity;

  const [cases, total] = await Promise.all([
    prisma.case.findMany({
      where,
      include: {
        diagnosis: { select: { rootCause: true, confidence: true } },
        interventions: { select: { channel: true, rung: true, outcome: true, executedAt: true }, orderBy: { rung: 'desc' }, take: 1 },
        promises: { select: { status: true, amount: true }, take: 1 },
      },
      orderBy: { [sortBy]: sortDir },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.case.count({ where }),
  ]);

  return NextResponse.json({
    cases: cases.map(c => ({
      ...c,
      eventMetadata: JSON.parse(c.eventMetadata),
    })),
    total,
    page,
    totalPages: Math.ceil(total / limit),
  });
}

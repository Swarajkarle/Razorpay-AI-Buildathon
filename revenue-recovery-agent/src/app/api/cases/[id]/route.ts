import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const c = await prisma.case.findUnique({
    where: { id },
    include: {
      diagnosis: true,
      interventions: { orderBy: { rung: 'asc' } },
      auditEntries: { orderBy: { timestamp: 'asc' } },
      promises: { orderBy: { createdAt: 'asc' } },
    },
  });

  if (!c) {
    return NextResponse.json({ error: 'Case not found' }, { status: 404 });
  }

  return NextResponse.json({
    ...c,
    eventMetadata: JSON.parse(c.eventMetadata),
    auditEntries: c.auditEntries.map(e => ({
      ...e,
      details: JSON.parse(e.details),
    })),
    interventions: c.interventions.map(i => ({
      ...i,
      complianceChecks: JSON.parse(i.complianceChecks),
    })),
  });
}

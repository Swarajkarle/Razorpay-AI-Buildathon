import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getRecentAuditEntries, getCaseAuditTrail, getBatchAuditTrail } from '@/lib/audit/trail';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const caseId = searchParams.get('caseId');
  const batchId = searchParams.get('batchId');
  const limit = parseInt(searchParams.get('limit') ?? '50');

  if (caseId) {
    const entries = await getCaseAuditTrail(caseId);
    return NextResponse.json(entries.map(e => ({ ...e, details: JSON.parse(e.details) })));
  }

  if (batchId) {
    const entries = await getBatchAuditTrail(batchId);
    return NextResponse.json(entries.map(e => ({ ...e, details: JSON.parse(e.details) })));
  }

  const entries = await getRecentAuditEntries(limit);
  return NextResponse.json(entries.map(e => ({ ...e, details: JSON.parse(e.details) })));
}

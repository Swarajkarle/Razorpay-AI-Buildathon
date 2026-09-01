import { NextRequest, NextResponse } from 'next/server';
import { getBatchAuditTrail } from '@/lib/audit/trail';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const batchId = searchParams.get('batchId');

  if (!batchId) {
    return NextResponse.json({ error: 'batchId required' }, { status: 400 });
  }

  const entries = await getBatchAuditTrail(batchId);
  const exportData = {
    exportedAt: new Date().toISOString(),
    batchId,
    totalEntries: entries.length,
    entries: entries.map(e => ({
      ...e,
      details: JSON.parse(e.details),
    })),
  };

  return new Response(JSON.stringify(exportData, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="audit-${batchId}.json"`,
    },
  });
}

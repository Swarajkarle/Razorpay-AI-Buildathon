import { NextRequest } from 'next/server';
import { runBatchPipeline, type PipelineEvent } from '@/lib/pipeline/orchestrator';
import { DEFAULT_BATCH_CONFIG, type BatchConfig } from '@/types';

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const config: BatchConfig = {
    batchSize: body.batchSize ?? DEFAULT_BATCH_CONFIG.batchSize,
    typeMix: body.typeMix ?? DEFAULT_BATCH_CONFIG.typeMix,
    severityDist: body.severityDist ?? DEFAULT_BATCH_CONFIG.severityDist,
  };

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: PipelineEvent) => {
        const data = `data: ${JSON.stringify(event)}\n\n`;
        controller.enqueue(encoder.encode(data));
      };

      try {
        await runBatchPipeline(config, send);
      } catch (err) {
        send({ type: 'error', error: String(err) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}

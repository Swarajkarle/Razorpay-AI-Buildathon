/**
 * Database seed — creates a compelling default batch so the dashboard
 * has interesting data on first load without needing to run a batch.
 */

import { PrismaClient } from '@prisma/client';
import { runBatchPipeline, type PipelineEvent } from '../pipeline/orchestrator';
import type { BatchConfig } from '../../types';

const prisma = new PrismaClient();

async function seed() {
  console.log('🌱 Seeding database...');

  // Ensure settings exist
  await prisma.settings.upsert({
    where: { id: 'singleton' },
    update: {},
    create: {
      id: 'singleton',
      maxContactAttempts: 5,
      quietHoursStart: 9,
      quietHoursEnd: 21,
      dndList: '[]',
      rung1DelayHours: 2,
      rung2DelayHours: 24,
      rung3DelayHours: 48,
      rung4DelayHours: 72,
      discountPct: 10,
      paymentPlanMinAmount: 5000,
      writeOffAfterDays: 30,
    },
  });
  console.log('✅ Settings initialized');

  // Check if we already have data
  const existingBatches = await prisma.batch.count();
  if (existingBatches > 0) {
    console.log(`ℹ️  Database already has ${existingBatches} batch(es). Skipping seed.`);
    await prisma.$disconnect();
    return;
  }

  // Run a compelling default batch
  const config: BatchConfig = {
    batchSize: 50,
    typeMix: {
      FAILED_PAYMENT: 35,
      ABANDONED_CHECKOUT: 30,
      FAILED_SUBSCRIPTION: 25,
      B2B_RECEIVABLE: 10,
    },
    severityDist: {
      LOW: 10,
      MEDIUM: 35,
      HIGH: 35,
      CRITICAL: 20,
    },
  };

  console.log('🚀 Running default batch of 50 cases...');
  const batchId = await runBatchPipeline(config, (event) => {
    if (event.type === 'case_completed') {
      process.stdout.write(event.status === 'RECOVERED' ? '💰' : event.status === 'ESCALATED' ? '📋' : '✗');
    }
  });

  console.log(`\n✅ Seed complete! Batch ID: ${batchId}`);

  const batch = await prisma.batch.findUnique({ where: { id: batchId } });
  if (batch) {
    const rate = batch.totalAtRisk > 0 ? (batch.totalRecovered / batch.totalAtRisk) * 100 : 0;
    console.log(`\n📊 Results:`);
    console.log(`   Total at risk:  ₹${batch.totalAtRisk.toLocaleString('en-IN')}`);
    console.log(`   Total recovered: ₹${batch.totalRecovered.toLocaleString('en-IN')}`);
    console.log(`   Recovery rate:   ${rate.toFixed(1)}%`);
    console.log(`   Cases: ${batch.caseCount} total | ${batch.recoveredCount} recovered | ${batch.writtenOffCount} written off | ${batch.escalatedCount} escalated`);
  }

  await prisma.$disconnect();
}

seed().catch((e) => {
  console.error('Seed failed:', e);
  process.exit(1);
});

/**
 * Promise-to-Pay Tracker
 * Logs customer payment commitments and tracks fulfillment/breakage.
 */

import prisma from '@/lib/prisma';
import { appendAuditEntry } from '@/lib/audit/trail';

export async function recordPromise(params: {
  caseId: string;
  amount: number;
  dueDate: Date;
  madeAt: Date;
  notes?: string;
}) {
  const promise = await prisma.promiseToPay.create({
    data: {
      caseId: params.caseId,
      amount: params.amount,
      dueDate: params.dueDate,
      madeAt: params.madeAt,
      notes: params.notes ?? '',
      status: 'PENDING',
    },
  });

  // Update case status to PROMISED
  await prisma.case.update({
    where: { id: params.caseId },
    data: { status: 'PROMISED' },
  });

  await appendAuditEntry({
    caseId: params.caseId,
    stage: 'TRACKING',
    event: 'PROMISE_LOGGED',
    details: {
      promiseId: promise.id,
      amount: params.amount,
      dueDate: params.dueDate.toISOString(),
      madeAt: params.madeAt.toISOString(),
    },
    actor: 'SYSTEM',
    simulatedAt: params.madeAt,
  });

  return promise;
}

export async function fulfillPromise(params: {
  promiseId: string;
  caseId: string;
  fulfilledAt: Date;
}) {
  const promise = await prisma.promiseToPay.update({
    where: { id: params.promiseId },
    data: {
      status: 'FULFILLED',
      fulfilledAt: params.fulfilledAt,
    },
  });

  const c = await prisma.case.findUnique({ where: { id: params.caseId } });

  // Mark case as recovered
  await prisma.case.update({
    where: { id: params.caseId },
    data: {
      status: 'RECOVERED',
      recoveredAmount: promise.amount,
      recoveredAt: params.fulfilledAt,
      terminatedAt: params.fulfilledAt,
      terminalReason: 'Promise to pay fulfilled',
    },
  });

  await appendAuditEntry({
    caseId: params.caseId,
    stage: 'TRACKING',
    event: 'PROMISE_FULFILLED',
    details: {
      promiseId: params.promiseId,
      amount: promise.amount,
      fulfilledAt: params.fulfilledAt.toISOString(),
    },
    actor: 'SYSTEM',
    simulatedAt: params.fulfilledAt,
  });

  await appendAuditEntry({
    caseId: params.caseId,
    stage: 'TRACKING',
    event: 'CASE_CLOSED',
    details: {
      terminalState: 'RECOVERED',
      reason: 'Promise to pay fulfilled',
      recoveredAmount: promise.amount,
      originalAmount: c?.amount,
    },
    actor: 'SYSTEM',
    simulatedAt: params.fulfilledAt,
  });

  return promise;
}

export async function breakPromise(params: {
  promiseId: string;
  caseId: string;
  brokenAt: Date;
}) {
  const promise = await prisma.promiseToPay.update({
    where: { id: params.promiseId },
    data: {
      status: 'BROKEN',
      brokenAt: params.brokenAt,
    },
  });

  // Revert case to INTERVENING for follow-up
  await prisma.case.update({
    where: { id: params.caseId },
    data: { status: 'INTERVENING' },
  });

  await appendAuditEntry({
    caseId: params.caseId,
    stage: 'TRACKING',
    event: 'PROMISE_BROKEN',
    details: {
      promiseId: params.promiseId,
      amount: promise.amount,
      dueDate: promise.dueDate.toISOString(),
      brokenAt: params.brokenAt.toISOString(),
    },
    actor: 'SYSTEM',
    simulatedAt: params.brokenAt,
  });

  return promise;
}

export async function getPendingPromises(batchId?: string) {
  const where = batchId
    ? { status: 'PENDING' as const, case: { batchId } }
    : { status: 'PENDING' as const };

  return prisma.promiseToPay.findMany({
    where,
    include: { case: { select: { customerName: true, amount: true, status: true } } },
    orderBy: { dueDate: 'asc' },
  });
}

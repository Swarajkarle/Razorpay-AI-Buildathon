import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  let settings = await prisma.settings.findUnique({ where: { id: 'singleton' } });
  if (!settings) {
    settings = await prisma.settings.create({
      data: {
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
  }

  return NextResponse.json({
    ...settings,
    dndList: JSON.parse(settings.dndList),
    recoveryProbabilities: JSON.parse(settings.recoveryProbabilities),
  });
}

export async function PUT(request: NextRequest) {
  const body = await request.json();

  const updated = await prisma.settings.upsert({
    where: { id: 'singleton' },
    update: {
      maxContactAttempts: body.maxContactAttempts,
      quietHoursStart: body.quietHoursStart,
      quietHoursEnd: body.quietHoursEnd,
      dndList: JSON.stringify(body.dndList ?? []),
      rung1DelayHours: body.rung1DelayHours,
      rung2DelayHours: body.rung2DelayHours,
      rung3DelayHours: body.rung3DelayHours,
      rung4DelayHours: body.rung4DelayHours,
      discountPct: body.discountPct,
      paymentPlanMinAmount: body.paymentPlanMinAmount,
      writeOffAfterDays: body.writeOffAfterDays,
    },
    create: {
      id: 'singleton',
      maxContactAttempts: body.maxContactAttempts ?? 5,
      quietHoursStart: body.quietHoursStart ?? 9,
      quietHoursEnd: body.quietHoursEnd ?? 21,
      dndList: JSON.stringify(body.dndList ?? []),
      rung1DelayHours: body.rung1DelayHours ?? 2,
      rung2DelayHours: body.rung2DelayHours ?? 24,
      rung3DelayHours: body.rung3DelayHours ?? 48,
      rung4DelayHours: body.rung4DelayHours ?? 72,
      discountPct: body.discountPct ?? 10,
      paymentPlanMinAmount: body.paymentPlanMinAmount ?? 5000,
      writeOffAfterDays: body.writeOffAfterDays ?? 30,
    },
  });

  return NextResponse.json({
    ...updated,
    dndList: JSON.parse(updated.dndList),
  });
}

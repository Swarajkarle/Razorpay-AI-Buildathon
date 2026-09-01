/**
 * Pipeline Orchestrator
 * Coordinates all pipeline stages for a batch of cases.
 * Ingestion → Detection → Diagnosis → Decision → Execution → Tracking → Measurement
 */

import prisma from '@/lib/prisma';
import { generateSyntheticBatch } from '@/lib/synthetic/generator';
import { detectRisk } from '@/lib/pipeline/detection';
import { diagnoseCase } from '@/lib/claude';
import { decideIntervention } from '@/lib/pipeline/decision';
import { checkCompliance, shouldTerminate } from '@/lib/compliance/rules';
import { createAdapters } from '@/lib/channels/adapter';
import { appendAuditEntry } from '@/lib/audit/trail';
import { recordPromise, fulfillPromise, breakPromise } from '@/lib/tracker/promise';
import { generateMessage } from '@/lib/claude';
import type { BatchConfig, RootCause, CaseType } from '@/types';

// ─── Settings loader ─────────────────────────────────────────────────────────

async function loadSettings() {
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
  return settings;
}

// ─── Progress event emitter ───────────────────────────────────────────────────

export type PipelineEvent =
  | { type: 'batch_started'; batchId: string; totalCases: number }
  | { type: 'case_started'; caseId: string; caseIndex: number; totalCases: number; customerName: string; caseType: string }
  | { type: 'case_detected'; caseId: string; riskScore: number; severity: string }
  | { type: 'case_diagnosed'; caseId: string; rootCause: string; confidence: number }
  | { type: 'case_intervened'; caseId: string; channel: string; rung: number }
  | { type: 'case_completed'; caseId: string; status: string; recoveredAmount?: number }
  | { type: 'batch_completed'; batchId: string; totalRecovered: number; totalAtRisk: number; recoveryRate: number }
  | { type: 'error'; caseId?: string; error: string };

export type ProgressCallback = (event: PipelineEvent) => void;

// ─── Main orchestrator ────────────────────────────────────────────────────────

export async function runBatchPipeline(
  config: BatchConfig,
  onProgress?: ProgressCallback
): Promise<string> {
  const settings = await loadSettings();
  const dndList: string[] = JSON.parse(settings.dndList || '[]');
  const adapters = createAdapters();

  const emit = (event: PipelineEvent) => onProgress?.(event);

  // ── INGESTION: Generate synthetic cases ──────────────────────────────────
  const syntheticCases = generateSyntheticBatch(config);

  // Create Batch record
  const batch = await prisma.batch.create({
    data: {
      config: JSON.stringify(config),
      caseCount: syntheticCases.length,
      totalAtRisk: syntheticCases.reduce((sum, c) => sum + c.amount, 0),
    },
  });

  await appendAuditEntry({
    batchId: batch.id,
    stage: 'INGESTION',
    event: 'BATCH_STARTED',
    details: {
      batchId: batch.id,
      config,
      totalCases: syntheticCases.length,
      totalAtRisk: batch.totalAtRisk,
    },
    actor: 'SYSTEM',
  });

  emit({ type: 'batch_started', batchId: batch.id, totalCases: syntheticCases.length });

  // Track metrics
  let totalRecovered = 0;
  let recoveredCount = 0;
  let writtenOffCount = 0;
  let escalatedCount = 0;

  // ── Process each case ────────────────────────────────────────────────────
  for (let i = 0; i < syntheticCases.length; i++) {
    const synCase = syntheticCases[i];

    try {
      // Simulate a spread of times across the batch
      // Each case is processed at a different simulated time
      const simOffset = i * 4; // 4 sim-hours between cases
      const simNow = new Date(Date.now() + simOffset * 60 * 60 * 1000);
      const simHour = 10 + (i % 12); // Business hours: 10am–10pm spread

      // Create Case record
      const dbCase = await prisma.case.create({
        data: {
          batchId: batch.id,
          type: synCase.type,
          status: 'DETECTED',
          customerId: synCase.customerId,
          customerName: synCase.customerName,
          customerEmail: synCase.customerEmail,
          customerPhone: synCase.customerPhone,
          customerSegment: synCase.customerSegment,
          amount: synCase.amount,
          currency: synCase.currency,
          eventMetadata: JSON.stringify(synCase.eventMetadata),
          eventOccurredAt: synCase.eventOccurredAt,
        },
      });

      emit({ type: 'case_started', caseId: dbCase.id, caseIndex: i + 1, totalCases: syntheticCases.length, customerName: synCase.customerName, caseType: synCase.type });

      // ── DETECTION: Risk scoring ─────────────────────────────────────────
      const risk = detectRisk({
        amount: synCase.amount,
        caseType: synCase.type,
        eventOccurredAt: synCase.eventOccurredAt,
        eventMetadata: synCase.eventMetadata,
      });

      await prisma.case.update({
        where: { id: dbCase.id },
        data: {
          riskScore: risk.riskScore,
          severity: risk.severity,
          urgency: risk.urgency,
          naturalRecoveryLikelihood: risk.naturalRecoveryLikelihood,
        },
      });

      await appendAuditEntry({
        caseId: dbCase.id,
        batchId: batch.id,
        stage: 'DETECTION',
        event: 'RISK_DETECTED',
        details: {
          riskScore: risk.riskScore,
          severity: risk.severity,
          urgency: risk.urgency,
          naturalRecoveryLikelihood: risk.naturalRecoveryLikelihood,
          amount: synCase.amount,
        },
        actor: 'SYSTEM',
        simulatedAt: simNow,
      });

      emit({ type: 'case_detected', caseId: dbCase.id, riskScore: risk.riskScore, severity: risk.severity });

      // ── DIAGNOSIS: Claude root-cause classification ──────────────────────
      await prisma.case.update({ where: { id: dbCase.id }, data: { status: 'DIAGNOSING' } });

      const diagnosis = await diagnoseCase({
        caseType: synCase.type,
        amount: synCase.amount,
        eventMetadata: synCase.eventMetadata,
        customerSegment: synCase.customerSegment,
      });

      const dbDiagnosis = await prisma.diagnosis.create({
        data: {
          caseId: dbCase.id,
          rootCause: diagnosis.rootCause,
          confidence: diagnosis.confidence,
          reasoning: diagnosis.reasoning,
          modelUsed: diagnosis.modelUsed,
          isMock: diagnosis.isMock,
          actionability: diagnosis.actionability,
          subCategory: diagnosis.subCategory ?? null,
        },
      });

      await appendAuditEntry({
        caseId: dbCase.id,
        batchId: batch.id,
        stage: 'DIAGNOSIS',
        event: 'DIAGNOSIS_MADE',
        details: {
          rootCause: diagnosis.rootCause,
          confidence: diagnosis.confidence,
          reasoning: diagnosis.reasoning,
          modelUsed: diagnosis.modelUsed,
          isMock: diagnosis.isMock,
          actionability: diagnosis.actionability,
        },
        actor: diagnosis.isMock ? 'MOCK_ADAPTER' : 'CLAUDE',
        simulatedAt: simNow,
      });

      emit({ type: 'case_diagnosed', caseId: dbCase.id, rootCause: diagnosis.rootCause, confidence: diagnosis.confidence });

      // ── DECISION + EXECUTION: Escalation ladder ─────────────────────────
      let currentRung = 0;
      let contactCount = 0;
      let caseStatus = 'INTERVENING';
      let recoveredAmount: number | undefined;

      await prisma.case.update({ where: { id: dbCase.id }, data: { status: 'INTERVENING' } });

      // Simulate up to 4 rungs of the escalation ladder
      for (let rungAttempt = 0; rungAttempt < 4; rungAttempt++) {
        const hoursOnCurrentRung = rungAttempt === 0 ? 999 : [0, 2, 24, 48, 72][currentRung] + 1;
        const simDaysSinceEvent = Math.floor(rungAttempt * 7); // Simulate spread over days

        // ── Terminal check ─────────────────────────────────────────────────
        const terminal = shouldTerminate({
          contactCount,
          currentRung,
          maxContactAttempts: settings.maxContactAttempts,
          simDaysSinceEvent,
          writeOffAfterDays: settings.writeOffAfterDays,
        });

        if (terminal.shouldTerminate && terminal.terminalState) {
          caseStatus = terminal.terminalState;
          await prisma.case.update({
            where: { id: dbCase.id },
            data: {
              status: terminal.terminalState,
              terminatedAt: simNow,
              terminalReason: terminal.reason,
              contactCount,
            },
          });

          await appendAuditEntry({
            caseId: dbCase.id,
            batchId: batch.id,
            stage: 'EXECUTION',
            event: 'CASE_CLOSED',
            details: {
              terminalState: terminal.terminalState,
              reason: terminal.reason,
              contactCount,
              currentRung,
            },
            actor: 'COMPLIANCE_ENGINE',
            simulatedAt: simNow,
          });
          break;
        }

        // ── Decide intervention ────────────────────────────────────────────
        const decision = decideIntervention({
          rootCause: diagnosis.rootCause as RootCause,
          caseType: synCase.type as CaseType,
          currentRung,
          amount: synCase.amount,
          settings: {
            discountPct: settings.discountPct,
            paymentPlanMinAmount: settings.paymentPlanMinAmount,
          },
        });

        // ── Compliance check ───────────────────────────────────────────────
        const compliance = checkCompliance({
          caseId: dbCase.id,
          contactCount,
          isDND: dndList.includes(synCase.customerId),
          currentRung,
          simulatedHour: simHour,
          settings: {
            maxContactAttempts: settings.maxContactAttempts,
            quietHoursStart: settings.quietHoursStart,
            quietHoursEnd: settings.quietHoursEnd,
            dndList,
            rung1DelayHours: settings.rung1DelayHours,
            rung2DelayHours: settings.rung2DelayHours,
            rung3DelayHours: settings.rung3DelayHours,
            rung4DelayHours: settings.rung4DelayHours,
          },
          customerId: synCase.customerId,
          amount: synCase.amount,
          hoursOnCurrentRung,
        });

        // Log every compliance check (pass AND block)
        await appendAuditEntry({
          caseId: dbCase.id,
          batchId: batch.id,
          stage: 'DECISION',
          event: 'COMPLIANCE_CHECKED',
          details: {
            allowed: compliance.allowed,
            checks: compliance.checks,
            blockedBy: compliance.blockedBy,
            blockedReason: compliance.blockedReason,
            channel: decision.channel,
            rung: decision.rung,
          },
          actor: 'COMPLIANCE_ENGINE',
          simulatedAt: simNow,
        });

        if (!compliance.allowed) {
          // If DND — immediately terminal
          if (compliance.blockedBy === 'DND_CHECK') {
            caseStatus = 'WRITTEN_OFF';
            await prisma.case.update({
              where: { id: dbCase.id },
              data: {
                status: 'WRITTEN_OFF',
                isDND: true,
                terminatedAt: simNow,
                terminalReason: 'Customer on DND list — all contact permanently blocked',
                contactCount,
              },
            });

            await appendAuditEntry({
              caseId: dbCase.id,
              batchId: batch.id,
              stage: 'EXECUTION',
              event: 'CASE_CLOSED',
              details: {
                terminalState: 'WRITTEN_OFF',
                reason: 'DND permanent block',
                contactCount,
              },
              actor: 'COMPLIANCE_ENGINE',
              simulatedAt: simNow,
            });
            break;
          }
          // Other blocks (quiet hours, gate timing) — skip this rung, continue to next loop
          continue;
        }

        // ── Generate message content via Claude ────────────────────────────
        const messageResult = await generateMessage({
          channel: decision.channel,
          rung: decision.rung,
          caseType: synCase.type as CaseType,
          customerName: synCase.customerName,
          amount: synCase.amount,
          rootCause: diagnosis.rootCause as RootCause,
          discountPct: decision.requiresDiscountOffer ? settings.discountPct : undefined,
          isHinglish: decision.isHinglish,
        });

        // ── Log intervention decision ──────────────────────────────────────
        await appendAuditEntry({
          caseId: dbCase.id,
          batchId: batch.id,
          stage: 'DECISION',
          event: 'INTERVENTION_DECIDED',
          details: {
            channel: decision.channel,
            rung: decision.rung,
            rationale: decision.rationale,
            isHinglish: decision.isHinglish,
            requiresDiscountOffer: decision.requiresDiscountOffer,
            requiresPaymentPlanOffer: decision.requiresPaymentPlanOffer,
          },
          actor: 'SYSTEM',
          simulatedAt: simNow,
        });

        // ── Execute intervention ───────────────────────────────────────────
        const adapter = adapters[decision.channel];
        const sendResult = await adapter.send({
          to: decision.channel === 'EMAIL' ? synCase.customerEmail : synCase.customerPhone,
          customerName: synCase.customerName,
          subject: decision.channel === 'EMAIL' ? `Action Required: Payment of ₹${synCase.amount.toLocaleString('en-IN')}` : undefined,
          content: messageResult.content,
          caseId: dbCase.id,
          channel: decision.channel,
          simulatedAt: simNow,
        });

        currentRung = decision.rung;
        if (decision.channel !== 'RETRY' && decision.channel !== 'NONE') {
          contactCount++;
        }

        // Create Intervention record
        const intervention = await prisma.intervention.create({
          data: {
            caseId: dbCase.id,
            rung: decision.rung,
            channel: decision.channel,
            messageContent: messageResult.content,
            decisionRationale: decision.rationale,
            complianceChecks: JSON.stringify(compliance.checks),
            scheduledAt: simNow,
            executedAt: simNow,
            outcome: sendResult.paymentSucceeded
              ? 'PAYMENT_SUCCEEDED'
              : sendResult.success
              ? 'DELIVERED'
              : 'BOUNCED',
            externalId: sendResult.messageId,
            simulatedAt: simNow,
          },
        });

        await prisma.case.update({
          where: { id: dbCase.id },
          data: { currentRung, contactCount },
        });

        // ── Log execution outcome ──────────────────────────────────────────
        await appendAuditEntry({
          caseId: dbCase.id,
          batchId: batch.id,
          stage: 'EXECUTION',
          event: 'ACTION_EXECUTED',
          details: {
            interventionId: intervention.id,
            channel: decision.channel,
            rung: decision.rung,
            outcome: intervention.outcome,
            messageId: sendResult.messageId,
            paymentSucceeded: sendResult.paymentSucceeded,
            contentPreview: messageResult.content.slice(0, 200),
          },
          actor: 'MOCK_ADAPTER',
          simulatedAt: simNow,
        });

        emit({ type: 'case_intervened', caseId: dbCase.id, channel: decision.channel, rung: decision.rung });

        // ── Check if payment succeeded ─────────────────────────────────────
        if (decision.channel === 'RETRY' && sendResult.paymentSucceeded) {
          recoveredAmount = synCase.amount;
          caseStatus = 'RECOVERED';

          await prisma.case.update({
            where: { id: dbCase.id },
            data: {
              status: 'RECOVERED',
              recoveredAmount: synCase.amount,
              recoveredAt: simNow,
              terminatedAt: simNow,
              terminalReason: 'Payment retry succeeded',
              contactCount,
            },
          });

          await appendAuditEntry({
            caseId: dbCase.id,
            batchId: batch.id,
            stage: 'EXECUTION',
            event: 'OUTCOME_RECORDED',
            details: { outcome: 'PAYMENT_SUCCEEDED', recoveredAmount: synCase.amount },
            actor: 'MOCK_ADAPTER',
            simulatedAt: simNow,
          });

          await appendAuditEntry({
            caseId: dbCase.id,
            batchId: batch.id,
            stage: 'EXECUTION',
            event: 'CASE_CLOSED',
            details: {
              terminalState: 'RECOVERED',
              reason: 'Payment retry succeeded',
              recoveredAmount: synCase.amount,
            },
            actor: 'SYSTEM',
            simulatedAt: simNow,
          });
          break;
        }

        // ── Promise-to-pay flow (B2B / Subscription rung 3) ───────────────
        if ((decision.requiresPaymentPlanOffer) && sendResult.success) {
          const promiseDue = new Date(simNow.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 sim-days
          await recordPromise({
            caseId: dbCase.id,
            amount: synCase.amount,
            dueDate: promiseDue,
            madeAt: simNow,
            notes: `Payment plan offered at rung ${decision.rung}`,
          });

          // Simulate 50% promise fulfillment for demo
          const willFulfill = Math.random() > 0.5;
          if (willFulfill) {
            recoveredAmount = synCase.amount;
            caseStatus = 'RECOVERED';
            const promises = await prisma.promiseToPay.findMany({ where: { caseId: dbCase.id }, orderBy: { createdAt: 'desc' }, take: 1 });
            if (promises[0]) {
              await fulfillPromise({
                promiseId: promises[0].id,
                caseId: dbCase.id,
                fulfilledAt: promiseDue,
              });
            }
            break;
          } else {
            const promises = await prisma.promiseToPay.findMany({ where: { caseId: dbCase.id }, orderBy: { createdAt: 'desc' }, take: 1 });
            if (promises[0]) {
              await breakPromise({
                promiseId: promises[0].id,
                caseId: dbCase.id,
                brokenAt: new Date(promiseDue.getTime() + 24 * 60 * 60 * 1000),
              });
            }
          }
        }

        // ── Non-retry channels: simulate response ──────────────────────────
        if (decision.channel !== 'RETRY' && sendResult.success) {
          // Simulate customer response probability based on root cause and rung
          const responseProbs: Record<string, number[]> = {
            CARD_EXPIRED: [0.45, 0.35, 0.2, 0.1],
            INSUFFICIENT_FUNDS: [0.2, 0.25, 0.35, 0.15],
            DISTRACTION: [0.55, 0.3, 0.15, 0.05],
            PRICE_SHOCK: [0.15, 0.25, 0.45, 0.1],
            PAYMENT_FRICTION: [0.5, 0.3, 0.15, 0.05],
            SHIPPING_COST: [0.2, 0.35, 0.3, 0.1],
            TRUST_CONCERN: [0.15, 0.25, 0.35, 0.2],
            BANK_DECLINE: [0.0, 0.3, 0.25, 0.15],
            MANDATE_LAPSED: [0.35, 0.3, 0.2, 0.1],
            OVERDUE_GENUINE: [0.25, 0.3, 0.35, 0.2],
            INVOICE_DISPUTE: [0.1, 0.2, 0.25, 0.15],
            LOST_STOLEN_CARD: [0.3, 0.25, 0.2, 0.1],
            ACCOUNT_CLOSED: [0.15, 0.2, 0.15, 0.05],
            GATEWAY_TIMEOUT: [0.0, 0.0, 0.0, 0.0],
          };

          const probs = responseProbs[diagnosis.rootCause] ?? [0.25, 0.25, 0.25, 0.1];
          const probIdx = Math.min(rungAttempt, probs.length - 1);
          const willRespond = Math.random() < probs[probIdx];

          if (willRespond) {
            recoveredAmount = synCase.amount;
            caseStatus = 'RECOVERED';

            await prisma.case.update({
              where: { id: dbCase.id },
              data: {
                status: 'RECOVERED',
                recoveredAmount: synCase.amount,
                recoveredAt: simNow,
                terminatedAt: simNow,
                terminalReason: `Customer responded to ${decision.channel} outreach at rung ${decision.rung}`,
                contactCount,
              },
            });

            await appendAuditEntry({
              caseId: dbCase.id,
              batchId: batch.id,
              stage: 'EXECUTION',
              event: 'OUTCOME_RECORDED',
              details: {
                outcome: 'PAYMENT_SUCCEEDED',
                channel: decision.channel,
                rung: decision.rung,
                recoveredAmount: synCase.amount,
              },
              actor: 'SYSTEM',
              simulatedAt: simNow,
            });

            await appendAuditEntry({
              caseId: dbCase.id,
              batchId: batch.id,
              stage: 'EXECUTION',
              event: 'CASE_CLOSED',
              details: {
                terminalState: 'RECOVERED',
                reason: `Customer responded to ${decision.channel} at rung ${decision.rung}`,
                recoveredAmount: synCase.amount,
              },
              actor: 'SYSTEM',
              simulatedAt: simNow,
            });
            break;
          }
        }

        // If we're at rung 4, case is escalated
        if (decision.rung >= 4) {
          caseStatus = 'ESCALATED';
          await prisma.case.update({
            where: { id: dbCase.id },
            data: {
              status: 'ESCALATED',
              terminatedAt: simNow,
              terminalReason: 'Escalated to human collections team after exhausting all automated rungs',
              contactCount,
            },
          });

          await appendAuditEntry({
            caseId: dbCase.id,
            batchId: batch.id,
            stage: 'EXECUTION',
            event: 'CASE_CLOSED',
            details: {
              terminalState: 'ESCALATED',
              reason: 'Reached rung 4 — human handoff',
              contactCount,
            },
            actor: 'SYSTEM',
            simulatedAt: simNow,
          });
          break;
        }
      }

      // If no terminal state set after all rungs, write off
      if (!['RECOVERED', 'ESCALATED', 'WRITTEN_OFF'].includes(caseStatus)) {
        caseStatus = 'WRITTEN_OFF';
        await prisma.case.update({
          where: { id: dbCase.id },
          data: {
            status: 'WRITTEN_OFF',
            terminatedAt: simNow,
            terminalReason: `Written off after ${contactCount} contact attempts with no recovery`,
            contactCount,
          },
        });

        await appendAuditEntry({
          caseId: dbCase.id,
          batchId: batch.id,
          stage: 'EXECUTION',
          event: 'CASE_CLOSED',
          details: {
            terminalState: 'WRITTEN_OFF',
            reason: `No recovery after ${contactCount} attempts`,
            contactCount,
          },
          actor: 'SYSTEM',
          simulatedAt: simNow,
        });
      }

      // Update metrics
      if (caseStatus === 'RECOVERED') {
        totalRecovered += recoveredAmount ?? synCase.amount;
        recoveredCount++;
      } else if (caseStatus === 'WRITTEN_OFF') {
        writtenOffCount++;
      } else if (caseStatus === 'ESCALATED') {
        escalatedCount++;
      }

      emit({
        type: 'case_completed',
        caseId: dbCase.id,
        status: caseStatus,
        recoveredAmount,
      });
    } catch (err) {
      console.error(`[Pipeline] Error processing case ${i}:`, err);
      emit({ type: 'error', error: String(err) });
    }
  }

  // ── Update batch metrics ─────────────────────────────────────────────────
  const totalAtRisk = syntheticCases.reduce((sum, c) => sum + c.amount, 0);
  const recoveryRate = totalAtRisk > 0 ? (totalRecovered / totalAtRisk) * 100 : 0;

  await prisma.batch.update({
    where: { id: batch.id },
    data: {
      completedAt: new Date(),
      totalAtRisk,
      totalRecovered,
      recoveredCount,
      writtenOffCount,
      escalatedCount,
    },
  });

  await appendAuditEntry({
    batchId: batch.id,
    stage: 'MEASUREMENT',
    event: 'BATCH_COMPLETED',
    details: {
      totalAtRisk,
      totalRecovered,
      recoveryRate,
      caseCount: syntheticCases.length,
      recoveredCount,
      writtenOffCount,
      escalatedCount,
    },
    actor: 'SYSTEM',
  });

  emit({
    type: 'batch_completed',
    batchId: batch.id,
    totalRecovered,
    totalAtRisk,
    recoveryRate,
  });

  return batch.id;
}

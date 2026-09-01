/**
 * Intervention Decision Engine
 * Rule-based routing: given a diagnosis, select channel, rung, and action.
 * Claude is ONLY used for message content generation — never for routing decisions.
 */

import type { RootCause, CaseType, ChannelType } from '@/types';

export interface InterventionDecision {
  channel: ChannelType;
  rung: number; // 1-4
  rationale: string;
  isRetry: boolean;
  isHinglish: boolean;
  requiresPaymentPlanOffer: boolean;
  requiresDiscountOffer: boolean;
}

// ─── Decision rule table ─────────────────────────────────────────────────────

const DECISION_RULES: Record<RootCause, (rung: number, amount: number, settings: { discountPct: number; paymentPlanMinAmount: number }) => Omit<InterventionDecision, 'rung'>> = {
  GATEWAY_TIMEOUT: (_, amount, _s) => ({
    channel: 'RETRY',
    rationale: 'Gateway timeout is a transient technical failure with 85% retry success rate. Immediate silent retry before any customer contact — no friction, no notification needed.',
    isRetry: true,
    isHinglish: false,
    requiresPaymentPlanOffer: false,
    requiresDiscountOffer: false,
  }),

  CARD_EXPIRED: (rung, _amount, _s) => ({
    channel: rung <= 2 ? 'EMAIL' : 'WHATSAPP',
    rationale: `Card expired — customer needs to update their payment method. ${rung <= 2 ? 'Email with direct update link has highest conversion for this root cause.' : 'Escalating to WhatsApp for higher visibility after email attempts.'}`,
    isRetry: false,
    isHinglish: rung >= 3,
    requiresPaymentPlanOffer: false,
    requiresDiscountOffer: false,
  }),

  INSUFFICIENT_FUNDS: (rung, amount, s) => {
    const canOfferPlan = amount >= s.paymentPlanMinAmount;
    return {
      channel: rung === 1 ? 'SMS' : rung === 2 ? 'WHATSAPP' : rung === 3 ? 'VOICE' : 'EMAIL',
      rationale: `Insufficient funds — customer has temporary cash-flow constraint. ${rung === 1 ? 'Soft SMS nudge to avoid embarrassment.' : ''} ${rung >= 3 && canOfferPlan ? 'Offering payment plan to reduce barrier.' : ''}`,
      isRetry: false,
      isHinglish: rung >= 2,
      requiresPaymentPlanOffer: rung >= 3 && canOfferPlan,
      requiresDiscountOffer: false,
    };
  },

  BANK_DECLINE: (rung, _amount, _s) => ({
    channel: rung === 1 ? 'RETRY' : rung === 2 ? 'EMAIL' : rung === 3 ? 'SMS' : 'VOICE',
    rationale: `Generic bank decline — retry after delay has 40% success. ${rung === 1 ? 'Silent retry after 24h.' : 'If retry fails, contact customer to try alternate payment method.'}`,
    isRetry: rung === 1,
    isHinglish: rung >= 3,
    requiresPaymentPlanOffer: false,
    requiresDiscountOffer: false,
  }),

  LOST_STOLEN_CARD: (rung, _amount, _s) => ({
    channel: rung <= 2 ? 'EMAIL' : 'WHATSAPP',
    rationale: 'Lost/stolen card — card permanently blocked. Customer needs to provide new payment details. Sensitive situation; email is less intrusive than phone contact.',
    isRetry: false,
    isHinglish: false,
    requiresPaymentPlanOffer: false,
    requiresDiscountOffer: false,
  }),

  ACCOUNT_CLOSED: (rung, _amount, _s) => ({
    channel: 'EMAIL',
    rationale: 'Account closed — customer needs to provide completely new payment method. Email with clear instructions and support link.',
    isRetry: false,
    isHinglish: false,
    requiresPaymentPlanOffer: false,
    requiresDiscountOffer: false,
  }),

  MANDATE_LAPSED: (rung, _amount, _s) => ({
    channel: rung === 1 ? 'EMAIL' : rung === 2 ? 'SMS' : 'WHATSAPP',
    rationale: `eNACH mandate lapsed — re-registration requires customer action. ${rung === 1 ? 'Email with mandate re-registration link.' : 'Follow up via SMS/WhatsApp with direct link.'}`,
    isRetry: false,
    isHinglish: rung >= 2,
    requiresPaymentPlanOffer: false,
    requiresDiscountOffer: false,
  }),

  PRICE_SHOCK: (rung, amount, s) => ({
    channel: rung === 1 ? 'EMAIL' : rung === 2 ? 'WHATSAPP' : 'EMAIL',
    rationale: `Price shock abandonment — customer balked at total price. ${rung >= 2 ? `Offering ${s.discountPct}% discount to reduce barrier.` : 'First contact: highlight value, offer free shipping if applicable.'}`,
    isRetry: false,
    isHinglish: rung >= 2,
    requiresPaymentPlanOffer: amount >= s.paymentPlanMinAmount && rung >= 3,
    requiresDiscountOffer: rung >= 2,
  }),

  PAYMENT_FRICTION: (rung, _amount, _s) => ({
    channel: rung === 1 ? 'EMAIL' : 'WHATSAPP',
    rationale: 'Payment friction abandonment — customer failed at payment form. Send one-click payment link to bypass friction. Email first, then WhatsApp for higher open rates.',
    isRetry: false,
    isHinglish: rung >= 2,
    requiresPaymentPlanOffer: false,
    requiresDiscountOffer: false,
  }),

  SHIPPING_COST: (rung, _amount, s) => ({
    channel: rung === 1 ? 'EMAIL' : 'WHATSAPP',
    rationale: `Shipping cost friction — offer free/reduced shipping. ${rung >= 2 ? `Additional ${s.discountPct}% discount on order total.` : 'First contact: offer free shipping to close the deal.'}`,
    isRetry: false,
    isHinglish: rung >= 2,
    requiresPaymentPlanOffer: false,
    requiresDiscountOffer: rung >= 2,
  }),

  TRUST_CONCERN: (rung, _amount, _s) => ({
    channel: rung === 1 ? 'EMAIL' : rung === 2 ? 'EMAIL' : 'VOICE',
    rationale: 'Trust concern abandonment — customer is uncertain about security. Email reinforcing security certifications and return policy. Voice call at rung 3 to address concerns personally.',
    isRetry: false,
    isHinglish: rung >= 3,
    requiresPaymentPlanOffer: false,
    requiresDiscountOffer: false,
  }),

  DISTRACTION: (rung, _amount, _s) => ({
    channel: rung === 1 ? 'EMAIL' : rung === 2 ? 'SMS' : 'WHATSAPP',
    rationale: 'Distraction abandonment — customer was interrupted. Simple one-click recovery link. High natural recovery; keep messaging light and helpful, not pushy.',
    isRetry: false,
    isHinglish: rung >= 2,
    requiresPaymentPlanOffer: false,
    requiresDiscountOffer: false,
  }),

  INVOICE_DISPUTE: (rung, _amount, _s) => ({
    channel: rung <= 2 ? 'EMAIL' : rung === 3 ? 'EMAIL' : 'EMAIL', // Always email for disputes (paper trail)
    rationale: `Invoice dispute — requires documentation and formal communication. Always use email for audit trail. ${rung >= 3 ? 'Escalating to senior account manager.' : 'Sending supporting documents (PO, delivery confirmation, SOW).'}`,
    isRetry: false,
    isHinglish: false,
    requiresPaymentPlanOffer: false,
    requiresDiscountOffer: false,
  }),

  OVERDUE_GENUINE: (rung, amount, s) => ({
    channel: rung === 1 ? 'EMAIL' : rung === 2 ? 'EMAIL' : rung === 3 ? 'WHATSAPP' : 'VOICE',
    rationale: `Overdue B2B receivable — genuine non-payment. ${rung === 1 ? 'Professional reminder with invoice PDF.' : ''} ${rung >= 3 && amount >= s.paymentPlanMinAmount ? 'Offering structured payment plan.' : ''} ${rung >= 4 ? 'Escalating to senior collections team.' : ''}`,
    isRetry: false,
    isHinglish: rung >= 3,
    requiresPaymentPlanOffer: rung >= 3 && amount >= s.paymentPlanMinAmount,
    requiresDiscountOffer: false,
  }),
};

// ─── Main decision function ───────────────────────────────────────────────────

export function decideIntervention(params: {
  rootCause: RootCause;
  caseType: CaseType;
  currentRung: number; // current rung (0 = not started)
  amount: number;
  settings: {
    discountPct: number;
    paymentPlanMinAmount: number;
  };
}): InterventionDecision {
  const { rootCause, currentRung, amount, settings } = params;
  const nextRung = Math.min(currentRung + 1, 4);
  const rule = DECISION_RULES[rootCause];

  if (!rule) {
    // Fallback for unknown root causes
    return {
      channel: 'EMAIL',
      rung: nextRung,
      rationale: `Unknown root cause ${rootCause} — defaulting to email outreach.`,
      isRetry: false,
      isHinglish: false,
      requiresPaymentPlanOffer: false,
      requiresDiscountOffer: false,
    };
  }

  const decision = rule(nextRung, amount, settings);
  return { ...decision, rung: nextRung };
}

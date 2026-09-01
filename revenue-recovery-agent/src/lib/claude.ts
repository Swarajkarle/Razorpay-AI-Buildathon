/**
 * Claude API wrapper with mock fallback.
 *
 * If ANTHROPIC_API_KEY is not set (or FORCE_MOCK_MODE=true),
 * all calls return deterministic, realistic mock responses.
 * This allows full demo without API credentials.
 */

import Anthropic from '@anthropic-ai/sdk';
import type { RootCause, CaseType, DeclineCode, AbandonmentReason } from '@/types';

// ─── Client singleton ───────────────────────────────────────────────────────

let _client: Anthropic | null = null;

function getClient(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const forceMock = process.env.FORCE_MOCK_MODE === 'true';

  if (forceMock || !apiKey || apiKey.trim() === '') {
    return null; // use mock mode
  }

  if (!_client) {
    _client = new Anthropic({ apiKey });
  }
  return _client;
}

export function isMockMode(): boolean {
  return getClient() === null;
}

// ─── Types ──────────────────────────────────────────────────────────────────

export interface DiagnosisResult {
  rootCause: RootCause;
  confidence: number;
  reasoning: string;
  subCategory?: string;
  actionability: 'LOW' | 'MEDIUM' | 'HIGH';
  modelUsed: string;
  isMock: boolean;
}

export interface MessageGenResult {
  content: string;
  modelUsed: string;
  isMock: boolean;
}

// ─── Diagnosis: root-cause classification ───────────────────────────────────

const DIAGNOSIS_SYSTEM_PROMPT = `You are a revenue recovery AI analyst for a fintech company. Your job is to diagnose the root cause of revenue loss events and classify them precisely.

You must respond with a valid JSON object only, no markdown, no explanation outside JSON.

Root cause options:
- Payment failures: CARD_EXPIRED, INSUFFICIENT_FUNDS, GATEWAY_TIMEOUT, BANK_DECLINE, LOST_STOLEN_CARD, ACCOUNT_CLOSED, MANDATE_LAPSED
- Checkout abandonments: PRICE_SHOCK, PAYMENT_FRICTION, SHIPPING_COST, TRUST_CONCERN, DISTRACTION
- Invoice/B2B: INVOICE_DISPUTE, OVERDUE_GENUINE

Response format:
{
  "rootCause": "<ROOT_CAUSE>",
  "confidence": <0.0-1.0>,
  "reasoning": "<2-3 sentence explanation of why this root cause fits, citing specific evidence from the event data>",
  "subCategory": "<optional extra detail>",
  "actionability": "LOW|MEDIUM|HIGH"
}`;

export async function diagnoseCase(params: {
  caseType: CaseType;
  amount: number;
  eventMetadata: Record<string, unknown>;
  customerSegment: string;
}): Promise<DiagnosisResult> {
  const client = getClient();

  if (!client) {
    return mockDiagnosis(params);
  }

  const userMessage = `Diagnose this revenue loss event:

Case Type: ${params.caseType}
Amount at Risk: ₹${params.amount.toLocaleString('en-IN')}
Customer Segment: ${params.customerSegment}
Event Details: ${JSON.stringify(params.eventMetadata, null, 2)}

Provide your diagnosis as JSON.`;

  try {
    const response = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 512,
      system: DIAGNOSIS_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const parsed = JSON.parse(text);

    return {
      rootCause: parsed.rootCause as RootCause,
      confidence: Math.min(1, Math.max(0, parsed.confidence)),
      reasoning: parsed.reasoning,
      subCategory: parsed.subCategory,
      actionability: parsed.actionability as 'LOW' | 'MEDIUM' | 'HIGH',
      modelUsed: 'claude-opus-4-5',
      isMock: false,
    };
  } catch (err) {
    console.error('[Claude] Diagnosis failed, falling back to mock:', err);
    return mockDiagnosis(params);
  }
}

// ─── Message generation ──────────────────────────────────────────────────────

const MESSAGE_SYSTEM_PROMPT = `You are a collections and customer recovery specialist for a fintech company in India. You write effective, empathetic, and compliant recovery messages.

Guidelines:
- Be professional but warm
- Never threaten or use aggressive language
- For Hinglish (voice/WhatsApp): mix Hindi and English naturally, as Indians actually speak
- Keep emails under 200 words, SMS under 160 chars, WhatsApp under 300 words
- Always include a clear call to action
- For B2B: more formal tone, reference invoice numbers
- For subscriptions: emphasize what they'll lose/miss

Respond with the message content only, no metadata.`;

export async function generateMessage(params: {
  channel: string;
  rung: number;
  caseType: CaseType;
  customerName: string;
  amount: number;
  rootCause: RootCause;
  discountPct?: number;
  isHinglish?: boolean;
}): Promise<MessageGenResult> {
  const client = getClient();

  if (!client) {
    return mockMessage(params);
  }

  const rungLabel = ['', 'soft reminder', 'firm reminder', 'discount/payment-plan offer', 'final notice / human handoff'][params.rung] || 'reminder';
  const langNote = params.isHinglish ? 'Write in Hinglish (Hindi-English mix) for voice/WhatsApp delivery.' : '';

  const userMessage = `Write a ${params.channel.toLowerCase()} recovery message.

Escalation rung: ${params.rung} (${rungLabel})
Customer name: ${params.customerName}
Amount owed: ₹${params.amount.toLocaleString('en-IN')}
Root cause: ${params.rootCause}
Case type: ${params.caseType}
${params.discountPct ? `Discount offered: ${params.discountPct}%` : ''}
${langNote}

Write the message now:`;

  try {
    const response = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 400,
      system: MESSAGE_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';

    return {
      content: text.trim(),
      modelUsed: 'claude-opus-4-5',
      isMock: false,
    };
  } catch (err) {
    console.error('[Claude] Message generation failed, falling back to mock:', err);
    return mockMessage(params);
  }
}

// ─── Mock implementations ────────────────────────────────────────────────────

function mockDiagnosis(params: {
  caseType: CaseType;
  amount: number;
  eventMetadata: Record<string, unknown>;
  customerSegment: string;
}): DiagnosisResult {
  const { caseType, eventMetadata } = params;

  let rootCause: RootCause;
  let confidence: number;
  let reasoning: string;
  let actionability: 'LOW' | 'MEDIUM' | 'HIGH';

  if (caseType === 'FAILED_PAYMENT' || caseType === 'FAILED_SUBSCRIPTION') {
    const declineCode = (eventMetadata.declineCode as DeclineCode) || 'do_not_honor';
    const mapping: Record<DeclineCode, { rootCause: RootCause; confidence: number; reasoning: string; actionability: 'LOW' | 'MEDIUM' | 'HIGH' }> = {
      insufficient_funds: {
        rootCause: 'INSUFFICIENT_FUNDS',
        confidence: 0.92,
        reasoning: 'The decline code `insufficient_funds` directly indicates the customer\'s account lacked the required balance at time of transaction. This is a transient condition that often resolves within 1–3 business days as payroll or transfers arrive. Recovery is achievable with a well-timed retry after 48–72 hours or a payment plan offer.',
        actionability: 'HIGH',
      },
      card_expired: {
        rootCause: 'CARD_EXPIRED',
        confidence: 0.97,
        reasoning: 'The decline code `card_expired` confirms the card on file has passed its expiry date. Banks issue replacement cards automatically but customers often forget to update saved payment methods. Recovery requires customer action to update card details; a direct link to the payment update page significantly improves conversion.',
        actionability: 'HIGH',
      },
      do_not_honor: {
        rootCause: 'BANK_DECLINE',
        confidence: 0.78,
        reasoning: 'The `do_not_honor` code is a generic bank-side decline without a specific sub-reason. This may be due to fraud scoring, unusual transaction pattern, or bank policy. The issuing bank is blocking the transaction. Customer should be advised to contact their bank or try an alternate payment method.',
        actionability: 'MEDIUM',
      },
      gateway_timeout: {
        rootCause: 'GATEWAY_TIMEOUT',
        confidence: 0.95,
        reasoning: 'The `gateway_timeout` indicates a network or processing timeout at the payment gateway layer, not a bank-side decline. This is a technical transient failure with high natural recovery probability. An immediate silent retry within 30 minutes has an ~85% success rate without any customer contact required.',
        actionability: 'HIGH',
      },
      lost_card: {
        rootCause: 'LOST_STOLEN_CARD',
        confidence: 0.98,
        reasoning: 'The `lost_card` decline code indicates the customer has reported this card as lost. The card is permanently blocked by the issuing bank. The customer will have received a replacement card. Recovery requires the customer to update their payment details with the new card number.',
        actionability: 'MEDIUM',
      },
      stolen_card: {
        rootCause: 'LOST_STOLEN_CARD',
        confidence: 0.98,
        reasoning: 'The `stolen_card` code confirms this card has been reported stolen and is permanently blocked. The customer will receive a new card from their bank. Recovery path is to request the customer update payment details with their new card, with appropriate sensitivity given the stressful nature of card theft.',
        actionability: 'MEDIUM',
      },
      invalid_account: {
        rootCause: 'ACCOUNT_CLOSED',
        confidence: 0.89,
        reasoning: 'The `invalid_account` decline indicates the bank account linked to this payment method no longer exists or is invalid. This could be due to account closure or a bank change. Recovery requires the customer to provide a new, valid payment method entirely.',
        actionability: 'LOW',
      },
      restricted_card: {
        rootCause: 'BANK_DECLINE',
        confidence: 0.82,
        reasoning: 'The `restricted_card` code indicates the card has usage restrictions imposed by the bank, possibly for international transactions, online payments, or certain merchant categories. Customer should be advised to use an alternate card or contact their bank to enable online payments.',
        actionability: 'MEDIUM',
      },
      pickup_card: {
        rootCause: 'LOST_STOLEN_CARD',
        confidence: 0.93,
        reasoning: 'The `pickup_card` decline code, typically used in card-present scenarios but occasionally returned for card-not-present, indicates the bank wants the card confiscated. This is associated with fraud flags or account issues. Recovery probability is low; customer should use alternate payment method.',
        actionability: 'LOW',
      },
      transaction_not_permitted: {
        rootCause: 'BANK_DECLINE',
        confidence: 0.76,
        reasoning: 'The `transaction_not_permitted` code indicates the bank or card network is blocking this specific transaction type. This may be due to merchant category restrictions, international transaction blocks, or cardholder spending limits. Customer should try an alternate payment method or contact their bank.',
        actionability: 'MEDIUM',
      },
    };
    const result = mapping[declineCode] || mapping['do_not_honor'];
    rootCause = result.rootCause;
    confidence = result.confidence;
    reasoning = result.reasoning;
    actionability = result.actionability;

    // Handle mandate lapsed for subscriptions
    if (caseType === 'FAILED_SUBSCRIPTION' && eventMetadata.mandateId) {
      rootCause = 'MANDATE_LAPSED';
      confidence = 0.88;
      reasoning = 'The subscription payment failed with a mandate identifier present but inactive. The eNACH/NACH mandate has likely expired or been cancelled by the customer at the bank. The mandate needs to be re-registered with fresh customer consent before any future subscription payments can auto-debit.';
      actionability = 'MEDIUM';
    }
  } else if (caseType === 'ABANDONED_CHECKOUT') {
    const reason = (eventMetadata.abandonmentReason as AbandonmentReason) || 'distraction';
    const mapping: Record<AbandonmentReason, { rootCause: RootCause; confidence: number; reasoning: string; actionability: 'LOW' | 'MEDIUM' | 'HIGH' }> = {
      price_shock: {
        rootCause: 'PRICE_SHOCK',
        confidence: 0.83,
        reasoning: 'Cart analysis shows the customer spent significant time on the price breakdown page before abandoning. The order total likely exceeded their mental price anchor, triggering price sensitivity. A targeted discount coupon or EMI option has a 55% recovery rate for this pattern within 2 hours of abandonment.',
        actionability: 'HIGH',
      },
      payment_friction: {
        rootCause: 'PAYMENT_FRICTION',
        confidence: 0.79,
        reasoning: 'Session analysis shows the customer abandoned at the payment entry step after multiple failed form interactions. The payment UI likely presented friction (OTP delays, card form errors, or UPI app switch failures). A simplified payment link with pre-filled details improves conversion by 65% for this pattern.',
        actionability: 'HIGH',
      },
      distraction: {
        rootCause: 'DISTRACTION',
        confidence: 0.72,
        reasoning: 'The session ended abruptly with a short session duration and no interaction with price or shipping pages, suggesting the customer was simply interrupted or distracted. This is a high-recovery scenario — a simple reminder with one-click checkout link typically recovers 70% of distraction-abandonment cases.',
        actionability: 'HIGH',
      },
      shipping_cost: {
        rootCause: 'SHIPPING_COST',
        confidence: 0.85,
        reasoning: 'The customer spent time on the shipping cost breakdown and abandoned immediately after seeing the total with shipping. This is a classic shipping-cost friction case. Offering free shipping (above a threshold) or a reduced shipping fee recovers approximately 60% of such abandonments.',
        actionability: 'HIGH',
      },
      trust_concern: {
        rootCause: 'TRUST_CONCERN',
        confidence: 0.68,
        reasoning: 'Session data shows the customer navigated to terms, return policy, or security pages before abandoning — a trust-verification pattern. The customer is interested but uncertain. Recovery messaging should emphasize security badges, easy return policy, and customer support availability.',
        actionability: 'MEDIUM',
      },
    };
    const result = mapping[reason] || mapping['distraction'];
    rootCause = result.rootCause;
    confidence = result.confidence;
    reasoning = result.reasoning;
    actionability = result.actionability;
  } else {
    // B2B_RECEIVABLE
    const agingDays = (eventMetadata.agingDays as number) || 30;
    const disputeRaised = (eventMetadata.disputeRaised as boolean) || false;

    if (disputeRaised) {
      rootCause = 'INVOICE_DISPUTE';
      confidence = 0.91;
      reasoning = `The debtor has formally raised a dispute on this invoice. With ${agingDays} days of aging and an active dispute flag, this is a contested receivable requiring documentation review and structured negotiation. The recovery path involves sending supporting documentation (PO, delivery confirmation, SOW), followed by a structured call with the accounts payable contact.`;
      actionability = 'LOW';
    } else if (agingDays >= 90) {
      rootCause = 'OVERDUE_GENUINE';
      confidence = 0.86;
      reasoning = `This invoice is ${agingDays} days overdue with no dispute raised, suggesting this is a genuine non-payment likely due to cash flow constraints or internal approval delays at the debtor organization. With ${(eventMetadata.previousReminders as number) || 0} previous reminders sent, escalation to a senior contact and a structured payment plan offer is the optimal recovery path.`;
      actionability = 'MEDIUM';
    } else {
      rootCause = 'OVERDUE_GENUINE';
      confidence = 0.81;
      reasoning = `This invoice is ${agingDays} days overdue, which falls within the first-reminder window. No dispute has been raised, indicating this may simply be an oversight in the AP process or approval queue at the client organization. A professional, non-threatening reminder with the invoice PDF and payment link has a high recovery probability at this aging stage.`;
      actionability = 'HIGH';
    }
  }

  return {
    rootCause,
    confidence,
    reasoning,
    actionability,
    modelUsed: 'MOCK',
    isMock: true,
  };
}

// Mock messages keyed by channel/rung/rootCause
function mockMessage(params: {
  channel: string;
  rung: number;
  caseType: CaseType;
  customerName: string;
  amount: number;
  rootCause: RootCause;
  discountPct?: number;
  isHinglish?: boolean;
}): MessageGenResult {
  const { channel, rung, customerName, amount, rootCause, discountPct, isHinglish } = params;
  const amountStr = `₹${amount.toLocaleString('en-IN')}`;
  const firstName = customerName.split(' ')[0];

  if (isHinglish || channel === 'VOICE') {
    const hinglishScripts: Record<number, string> = {
      1: `Namaste ${firstName} ji! Aapka payment ${amountStr} ka complete nahi hua hai. Koi tension nahi — aap sirf ek minute mein apna payment complete kar sakte hain. Humara secure link check karein. Koi bhi help chahiye toh hum yahan hain!`,
      2: `Hello ${firstName} ji, yeh ek important reminder hai. Aapka ${amountStr} ka payment abhi bhi pending hai. Aapke account mein koi issue toh nahi? Agar koi problem hai toh please humse baat karein — hum help karne ke liye ready hain. Payment link aapke phone pe bheja hai.`,
      3: `${firstName} ji, hum jaante hain ki sometimes financial situation tight hoti hai. Isliye hum aapko ek special offer de rahe hain — aaj payment karein toh ${discountPct || 10}% discount milega! Ya aap apne payments ko aasaan installments mein tod sakte hain. Yeh offer sirf 24 ghante ke liye valid hai.`,
      4: `${firstName} ji, yeh hamare collections team se last attempt hai. Aapka account review ke liye hamare senior team ke paas gaya hai. Please is matter ko resolve karein — humse abhi contact karein taaki hum ek solution nikal sakein jisse aapko aur hamare dono ko benefit ho.`,
    };
    return {
      content: hinglishScripts[rung] || hinglishScripts[1],
      modelUsed: 'MOCK',
      isMock: true,
    };
  }

  if (channel === 'EMAIL') {
    const emailTemplates: Record<number, string> = {
      1: `Subject: Action Required: Complete Your Payment of ${amountStr}

Dear ${customerName},

We noticed that your recent payment of ${amountStr} was unable to process${rootCause === 'CARD_EXPIRED' ? ' because your card on file has expired' : rootCause === 'INSUFFICIENT_FUNDS' ? ' due to insufficient funds' : ''}.

Please update your payment details at your earliest convenience to avoid any service interruption.

👉 Update Payment: [SECURE PAYMENT LINK]

If you have any questions, our support team is available 24/7.

Best regards,
Revenue Recovery Team`,
      2: `Subject: Reminder: Payment of ${amountStr} Still Pending

Dear ${customerName},

This is a follow-up regarding your outstanding payment of ${amountStr}. Despite our previous notification, we haven't received your payment yet.

Please complete your payment within 24 hours to avoid further escalation.

👉 Pay Now: [SECURE PAYMENT LINK]

If you're experiencing financial difficulties, please contact us — we're happy to discuss options.

Regards,
Collections Team`,
      3: `Subject: Special Offer: Pay Today & Save ${discountPct || 10}%

Dear ${customerName},

We understand that circumstances can make payments challenging. As a valued customer, we'd like to offer you:

✨ ${discountPct || 10}% discount if you pay within 48 hours
📅 OR flexible payment installment plan

Your outstanding balance is ${amountStr}. With the discount: ${amountStr.replace('₹', '₹')} → ₹${(amount * (1 - (discountPct || 10) / 100)).toLocaleString('en-IN')}

👉 Claim Offer: [PAYMENT LINK WITH DISCOUNT]

This offer expires in 48 hours.

Best regards,
Customer Care Team`,
      4: `Subject: Final Notice — Account Review Required

Dear ${customerName},

Despite multiple attempts, your payment of ${amountStr} remains outstanding. Your account has been escalated to our senior collections team for review.

To avoid further action, please contact us immediately at collections@company.com or call 1800-XXX-XXXX.

This is our final automated notice. A human collections representative will be in touch shortly.

Regards,
Senior Collections Team`,
    };
    return { content: emailTemplates[rung] || emailTemplates[1], modelUsed: 'MOCK', isMock: true };
  }

  if (channel === 'SMS') {
    const smsTemplates: Record<number, string> = {
      1: `Hi ${firstName}, your payment of ${amountStr} failed. Please update payment: [LINK]. Help: 1800-XXX-XXXX`,
      2: `Reminder: ${amountStr} payment still pending on your account. Please pay now: [LINK] to avoid disruption.`,
      3: `${firstName}, pay ${amountStr} today & get ${discountPct || 10}% off! Limited 48hr offer. Click: [DISCOUNT LINK]`,
      4: `FINAL NOTICE: Your ${amountStr} payment is overdue. Contact us immediately at 1800-XXX-XXXX or reply HELP.`,
    };
    return { content: smsTemplates[rung] || smsTemplates[1], modelUsed: 'MOCK', isMock: true };
  }

  if (channel === 'WHATSAPP') {
    const wpTemplates: Record<number, string> = {
      1: `Hello ${firstName} 👋\n\nYour payment of *${amountStr}* could not be processed.\n\n${rootCause === 'CARD_EXPIRED' ? '📋 Your card may have expired. ' : ''}Please complete your payment using the secure link below:\n\n🔗 [PAYMENT LINK]\n\nNeed help? Reply to this message anytime.`,
      2: `Hi ${firstName},\n\nThis is a friendly reminder that your payment of *${amountStr}* is still pending.\n\nPlease pay at your earliest convenience:\n🔗 [PAYMENT LINK]\n\nFacing any issues? We're here to help! 🙏`,
      3: `Hi ${firstName} 🎁\n\nSpecial offer just for you:\n\n*Pay today and get ${discountPct || 10}% off!*\nYour amount: ${amountStr} → *₹${(amount * (1 - (discountPct || 10) / 100)).toLocaleString('en-IN')}*\n\nOr choose a flexible payment plan 📅\n\n👉 [CLAIM OFFER LINK]\n\nOffer valid for 48 hours only!`,
      4: `Hello ${firstName},\n\nWe've made several attempts to reach you regarding your outstanding payment of *${amountStr}*.\n\nThis matter requires urgent attention. Please contact our team:\n📞 1800-XXX-XXXX\n📧 collections@company.com\n\nA representative will be in touch shortly.`,
    };
    return { content: wpTemplates[rung] || wpTemplates[1], modelUsed: 'MOCK', isMock: true };
  }

  // RETRY channel - no customer message, just internal log
  return {
    content: `[SYSTEM] Initiating payment retry for ${customerName} — ${amountStr} — Root cause: ${rootCause}`,
    modelUsed: 'MOCK',
    isMock: true,
  };
}

/**
 * Channel Adapter interface + mock adapters
 * All outbound effects are mocked — never actually sent.
 * Real providers (Twilio, SendGrid) can be plugged in by implementing IChannelAdapter.
 */

import type { ChannelType } from '@/types';

// ─── Core interface ───────────────────────────────────────────────────────────

export interface OutboundPayload {
  to: string;         // email or phone
  customerName: string;
  subject?: string;   // email only
  content: string;    // message/script text
  caseId: string;
  channel: ChannelType;
  simulatedAt: Date;
}

export interface SendResult {
  success: boolean;
  messageId: string;
  channel: ChannelType;
  simulatedAt: Date;
  error?: string;
  // For RETRY channel
  paymentSucceeded?: boolean;
}

export interface IChannelAdapter {
  name: ChannelType;
  send(payload: OutboundPayload): Promise<SendResult>;
}

// ─── Mock email adapter ───────────────────────────────────────────────────────

export class MockEmailAdapter implements IChannelAdapter {
  name: ChannelType = 'EMAIL';

  async send(payload: OutboundPayload): Promise<SendResult> {
    // Simulate 95% delivery rate
    const success = Math.random() > 0.05;
    const messageId = `MOCK_EMAIL_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    console.log(`[MockEmail] ${success ? '✅' : '❌'} To: ${payload.to} | Case: ${payload.caseId}`);

    return {
      success,
      messageId,
      channel: 'EMAIL',
      simulatedAt: payload.simulatedAt,
      error: success ? undefined : 'SMTP_BOUNCE: Address not found',
    };
  }
}

// ─── Mock SMS adapter ─────────────────────────────────────────────────────────

export class MockSMSAdapter implements IChannelAdapter {
  name: ChannelType = 'SMS';

  async send(payload: OutboundPayload): Promise<SendResult> {
    // Simulate 90% delivery rate (carriers sometimes filter)
    const success = Math.random() > 0.10;
    const messageId = `MOCK_SMS_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    console.log(`[MockSMS] ${success ? '✅' : '❌'} To: ${payload.to} | Case: ${payload.caseId}`);

    return {
      success,
      messageId,
      channel: 'SMS',
      simulatedAt: payload.simulatedAt,
      error: success ? undefined : 'DLR_FAILED: Number unreachable',
    };
  }
}

// ─── Mock WhatsApp adapter ────────────────────────────────────────────────────

export class MockWhatsAppAdapter implements IChannelAdapter {
  name: ChannelType = 'WHATSAPP';

  async send(payload: OutboundPayload): Promise<SendResult> {
    // 88% delivery rate (some users block business accounts)
    const success = Math.random() > 0.12;
    const messageId = `MOCK_WA_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    console.log(`[MockWhatsApp] ${success ? '✅' : '❌'} To: ${payload.to} | Case: ${payload.caseId}`);

    return {
      success,
      messageId,
      channel: 'WHATSAPP',
      simulatedAt: payload.simulatedAt,
      error: success ? undefined : 'WA_UNDELIVERED: User blocked business number',
    };
  }
}

// ─── Mock Voice adapter (Hinglish IVR/call) ──────────────────────────────────

export class MockVoiceAdapter implements IChannelAdapter {
  name: ChannelType = 'VOICE';

  async send(payload: OutboundPayload): Promise<SendResult> {
    // 70% answer rate for outbound calls
    const success = Math.random() > 0.30;
    const messageId = `MOCK_VOICE_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    console.log(`[MockVoice] ${success ? '📞 Connected' : '📵 No answer'} | To: ${payload.to} | Case: ${payload.caseId}`);

    return {
      success,
      messageId,
      channel: 'VOICE',
      simulatedAt: payload.simulatedAt,
      error: success ? undefined : 'CALL_UNANSWERED: No answer after 30 seconds',
    };
  }
}

// ─── Mock Payment Retry adapter ───────────────────────────────────────────────

// Recovery probability by decline code
const RETRY_SUCCESS_RATES: Record<string, number> = {
  gateway_timeout: 0.85,
  insufficient_funds: 0.30,
  card_expired: 0.10,
  do_not_honor: 0.40,
  lost_card: 0.05,
  stolen_card: 0.05,
  invalid_account: 0.08,
  restricted_card: 0.35,
  transaction_not_permitted: 0.30,
  MANDATE_LAPSED: 0.15,
  CARD_EXPIRED: 0.10,
  INSUFFICIENT_FUNDS: 0.30,
  GATEWAY_TIMEOUT: 0.85,
  BANK_DECLINE: 0.40,
};

export class MockRetryAdapter implements IChannelAdapter {
  name: ChannelType = 'RETRY';

  async send(payload: OutboundPayload): Promise<SendResult> {
    // Extract decline code from content (it's logged as internal message)
    const declineMatch = payload.content.match(/Root cause: (\w+)/);
    const declineCode = declineMatch?.[1] || 'do_not_honor';
    const successRate = RETRY_SUCCESS_RATES[declineCode] ?? 0.35;

    const paymentSucceeded = Math.random() < successRate;
    const messageId = `MOCK_RETRY_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    console.log(`[MockRetry] ${paymentSucceeded ? '💰 Payment succeeded' : '❌ Payment failed'} | Decline: ${declineCode} | Rate: ${(successRate * 100).toFixed(0)}% | Case: ${payload.caseId}`);

    return {
      success: true, // The retry attempt itself succeeded (even if payment failed)
      messageId,
      channel: 'RETRY',
      simulatedAt: payload.simulatedAt,
      paymentSucceeded,
      error: paymentSucceeded ? undefined : `RETRY_FAILED: Decline persists for ${declineCode}`,
    };
  }
}

// ─── Adapter registry ─────────────────────────────────────────────────────────

export function createAdapters(): Record<ChannelType, IChannelAdapter> {
  return {
    EMAIL: new MockEmailAdapter(),
    SMS: new MockSMSAdapter(),
    WHATSAPP: new MockWhatsAppAdapter(),
    VOICE: new MockVoiceAdapter(),
    RETRY: new MockRetryAdapter(),
    NONE: {
      name: 'NONE',
      async send(_payload: OutboundPayload): Promise<SendResult> {
        return { success: false, messageId: 'NONE', channel: 'NONE', simulatedAt: _payload.simulatedAt };
      },
    },
  };
}

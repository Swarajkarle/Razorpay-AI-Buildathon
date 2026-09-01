// Central type definitions for the Revenue Recovery Agent

export type CaseType =
  | 'FAILED_PAYMENT'
  | 'ABANDONED_CHECKOUT'
  | 'FAILED_SUBSCRIPTION'
  | 'B2B_RECEIVABLE';

export type CaseStatus =
  | 'DETECTED'
  | 'DIAGNOSING'
  | 'INTERVENING'
  | 'PROMISED'
  | 'RECOVERED'
  | 'ESCALATED'
  | 'WRITTEN_OFF';

export type Severity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type Urgency = 'LOW' | 'MEDIUM' | 'HIGH';
export type NaturalRecoveryLikelihood = 'LOW' | 'MEDIUM' | 'HIGH';
export type Actionability = 'LOW' | 'MEDIUM' | 'HIGH';

export type RootCause =
  // Payment root causes
  | 'CARD_EXPIRED'
  | 'INSUFFICIENT_FUNDS'
  | 'GATEWAY_TIMEOUT'
  | 'BANK_DECLINE'
  | 'LOST_STOLEN_CARD'
  | 'ACCOUNT_CLOSED'
  | 'MANDATE_LAPSED'
  // Checkout root causes
  | 'PRICE_SHOCK'
  | 'PAYMENT_FRICTION'
  | 'SHIPPING_COST'
  | 'TRUST_CONCERN'
  | 'DISTRACTION'
  // Invoice root causes
  | 'INVOICE_DISPUTE'
  | 'OVERDUE_GENUINE';

export type ChannelType =
  | 'EMAIL'
  | 'SMS'
  | 'WHATSAPP'
  | 'VOICE'
  | 'RETRY'
  | 'NONE';

export type InterventionOutcome =
  | 'DELIVERED'
  | 'BOUNCED'
  | 'PAYMENT_SUCCEEDED'
  | 'PAYMENT_FAILED'
  | 'NO_RESPONSE'
  | 'BLOCKED'
  | 'OPTED_OUT';

export type PromiseStatus = 'PENDING' | 'FULFILLED' | 'BROKEN' | 'FOLLOW_UP';

export type AuditStage =
  | 'INGESTION'
  | 'DETECTION'
  | 'DIAGNOSIS'
  | 'DECISION'
  | 'EXECUTION'
  | 'TRACKING'
  | 'MEASUREMENT';

export type AuditEvent =
  | 'RISK_DETECTED'
  | 'DIAGNOSIS_MADE'
  | 'INTERVENTION_DECIDED'
  | 'ACTION_EXECUTED'
  | 'COMPLIANCE_CHECKED'
  | 'OUTCOME_RECORDED'
  | 'PROMISE_LOGGED'
  | 'PROMISE_FULFILLED'
  | 'PROMISE_BROKEN'
  | 'CASE_CLOSED'
  | 'BATCH_STARTED'
  | 'BATCH_COMPLETED';

export type Actor = 'SYSTEM' | 'CLAUDE' | 'COMPLIANCE_ENGINE' | 'MOCK_ADAPTER';

// Decline codes for failed payments
export type DeclineCode =
  | 'insufficient_funds'
  | 'card_expired'
  | 'do_not_honor'
  | 'gateway_timeout'
  | 'lost_card'
  | 'stolen_card'
  | 'invalid_account'
  | 'restricted_card'
  | 'pickup_card'
  | 'transaction_not_permitted';

// Checkout abandonment reasons
export type AbandonmentReason =
  | 'price_shock'
  | 'payment_friction'
  | 'distraction'
  | 'shipping_cost'
  | 'trust_concern';

// Event metadata types
export interface FailedPaymentMetadata {
  declineCode: DeclineCode;
  gatewayCode: string;
  bankName: string;
  cardLast4?: string;
  cardBrand?: string;
  attemptCount: number;
  lastAttemptAt: string;
  transactionId: string;
}

export interface AbandonedCheckoutMetadata {
  abandonmentReason: AbandonmentReason;
  cartItemCount: number;
  cartItems: Array<{ name: string; price: number; qty: number }>;
  shippingCost: number;
  discountApplied: number;
  sessionDurationSeconds: number;
  lastPageVisited: string;
  checkoutStep: string;
}

export interface FailedSubscriptionMetadata {
  declineCode: DeclineCode;
  planName: string;
  planInterval: 'MONTHLY' | 'QUARTERLY' | 'ANNUAL';
  subscriptionAge: number; // days
  previousSuccessfulPayments: number;
  mandateId?: string;
  nextRetryAt?: string;
}

export interface B2BReceivableMetadata {
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  agingDays: number; // 30 | 60 | 90 | 120+
  invoiceItems: Array<{ description: string; amount: number }>;
  contactPerson: string;
  contactTitle: string;
  previousReminders: number;
  disputeRaised: boolean;
  disputeReason?: string;
}

// Compliance check result
export interface ComplianceCheck {
  rule: string;
  allowed: boolean;
  reason: string;
  checkedAt: string;
}

// Synthetic generator config
export interface BatchConfig {
  batchSize: number;
  typeMix: {
    FAILED_PAYMENT: number;       // percentage 0-100
    ABANDONED_CHECKOUT: number;
    FAILED_SUBSCRIPTION: number;
    B2B_RECEIVABLE: number;
  };
  severityDist: {
    LOW: number;
    MEDIUM: number;
    HIGH: number;
    CRITICAL: number;
  };
}

export const DEFAULT_BATCH_CONFIG: BatchConfig = {
  batchSize: 50,
  typeMix: {
    FAILED_PAYMENT: 35,
    ABANDONED_CHECKOUT: 30,
    FAILED_SUBSCRIPTION: 25,
    B2B_RECEIVABLE: 10,
  },
  severityDist: {
    LOW: 15,
    MEDIUM: 40,
    HIGH: 30,
    CRITICAL: 15,
  },
};

// Metrics types
export interface BatchMetrics {
  batchId: string;
  totalAtRisk: number;
  totalRecovered: number;
  recoveryRate: number;
  caseCount: number;
  recoveredCount: number;
  writtenOffCount: number;
  escalatedCount: number;
  avgTimeToRecoveryHours: number;
  writeOffRate: number;
  auditCoverage: number;
  breakdownByRootCause: Record<string, { count: number; recovered: number; atRisk: number }>;
  breakdownByChannel: Record<string, { count: number; successCount: number }>;
  breakdownByType: Record<string, { count: number; recovered: number; atRisk: number }>;
}

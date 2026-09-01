import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency = 'INR'): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatPercent(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`;
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-IN').format(value);
}

export const STATUS_COLORS: Record<string, string> = {
  DETECTED: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  DIAGNOSING: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  INTERVENING: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  PROMISED: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  RECOVERED: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  ESCALATED: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  WRITTEN_OFF: 'bg-red-500/20 text-red-300 border-red-500/30',
};

export const SEVERITY_COLORS: Record<string, string> = {
  LOW: 'bg-slate-500/20 text-slate-300',
  MEDIUM: 'bg-yellow-500/20 text-yellow-300',
  HIGH: 'bg-orange-500/20 text-orange-300',
  CRITICAL: 'bg-red-500/20 text-red-300',
};

export const TYPE_LABELS: Record<string, string> = {
  FAILED_PAYMENT: 'Failed Payment',
  ABANDONED_CHECKOUT: 'Abandoned Checkout',
  FAILED_SUBSCRIPTION: 'Failed Subscription',
  B2B_RECEIVABLE: 'B2B Receivable',
};

export const ROOT_CAUSE_LABELS: Record<string, string> = {
  CARD_EXPIRED: 'Card Expired',
  INSUFFICIENT_FUNDS: 'Insufficient Funds',
  GATEWAY_TIMEOUT: 'Gateway Timeout',
  BANK_DECLINE: 'Bank Decline',
  LOST_STOLEN_CARD: 'Lost/Stolen Card',
  ACCOUNT_CLOSED: 'Account Closed',
  MANDATE_LAPSED: 'Mandate Lapsed',
  PRICE_SHOCK: 'Price Shock',
  PAYMENT_FRICTION: 'Payment Friction',
  SHIPPING_COST: 'Shipping Cost',
  TRUST_CONCERN: 'Trust Concern',
  DISTRACTION: 'Distraction',
  INVOICE_DISPUTE: 'Invoice Dispute',
  OVERDUE_GENUINE: 'Overdue (Genuine)',
};

export const CHANNEL_ICONS: Record<string, string> = {
  EMAIL: '📧',
  SMS: '💬',
  WHATSAPP: '💚',
  VOICE: '📞',
  RETRY: '🔄',
  NONE: '—',
};

export const AUDIT_EVENT_LABELS: Record<string, string> = {
  RISK_DETECTED: 'Risk Detected',
  DIAGNOSIS_MADE: 'Diagnosis Made',
  INTERVENTION_DECIDED: 'Intervention Decided',
  ACTION_EXECUTED: 'Action Executed',
  COMPLIANCE_CHECKED: 'Compliance Checked',
  OUTCOME_RECORDED: 'Outcome Recorded',
  PROMISE_LOGGED: 'Promise Logged',
  PROMISE_FULFILLED: 'Promise Fulfilled',
  PROMISE_BROKEN: 'Promise Broken',
  CASE_CLOSED: 'Case Closed',
  BATCH_STARTED: 'Batch Started',
  BATCH_COMPLETED: 'Batch Completed',
};

export const ROOT_CAUSE_COLORS: Record<string, string> = {
  CARD_EXPIRED: '#f59e0b',
  INSUFFICIENT_FUNDS: '#ef4444',
  GATEWAY_TIMEOUT: '#10b981',
  BANK_DECLINE: '#f97316',
  LOST_STOLEN_CARD: '#dc2626',
  ACCOUNT_CLOSED: '#7f1d1d',
  MANDATE_LAPSED: '#d97706',
  PRICE_SHOCK: '#8b5cf6',
  PAYMENT_FRICTION: '#3b82f6',
  SHIPPING_COST: '#06b6d4',
  TRUST_CONCERN: '#6366f1',
  DISTRACTION: '#84cc16',
  INVOICE_DISPUTE: '#ec4899',
  OVERDUE_GENUINE: '#f43f5e',
};

export const CHANNEL_COLORS: Record<string, string> = {
  EMAIL: '#3b82f6',
  SMS: '#10b981',
  WHATSAPP: '#25d366',
  VOICE: '#f59e0b',
  RETRY: '#8b5cf6',
};

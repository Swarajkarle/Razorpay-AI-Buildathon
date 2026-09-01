/**
 * Synthetic data generator for revenue-risk events.
 * Produces realistic batches of all 4 case types with configurable mix.
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  BatchConfig,
  CaseType,
  DeclineCode,
  AbandonmentReason,
  FailedPaymentMetadata,
  AbandonedCheckoutMetadata,
  FailedSubscriptionMetadata,
  B2BReceivableMetadata,
} from '@/types';

// ─── Name pools ─────────────────────────────────────────────────────────────

const FIRST_NAMES = [
  'Rahul', 'Priya', 'Amit', 'Sneha', 'Vikram', 'Ananya', 'Rohit', 'Kavya',
  'Arjun', 'Pooja', 'Sanjay', 'Meera', 'Kiran', 'Divya', 'Suresh', 'Nisha',
  'Rajesh', 'Sunita', 'Arun', 'Deepa', 'Manish', 'Rekha', 'Vijay', 'Geeta',
  'Ravi', 'Shilpa', 'Sunil', 'Vandana', 'Ajay', 'Preeti', 'Nitin', 'Swati',
  'Harsh', 'Ritu', 'Gaurav', 'Neha', 'Vishal', 'Anjali', 'Manoj', 'Simran',
];

const LAST_NAMES = [
  'Sharma', 'Patel', 'Singh', 'Gupta', 'Kumar', 'Joshi', 'Agarwal', 'Mehta',
  'Shah', 'Verma', 'Nair', 'Reddy', 'Rao', 'Iyer', 'Pillai', 'Chopra',
  'Malhotra', 'Saxena', 'Bose', 'Mukherjee', 'Chaudhary', 'Tiwari', 'Srivastava',
  'Mishra', 'Pandey', 'Chauhan', 'Dubey', 'Yadav', 'Jain', 'Kapoor',
];

const COMPANIES = [
  'Nexus Tech Solutions', 'Apex Digital Services', 'Prime Retail Pvt Ltd',
  'Horizon Logistics', 'Zenith Manufacturing', 'Pinnacle Consultants',
  'Sterling Finance', 'Crescent Exports', 'Vantage Systems', 'Meridian Pharma',
  'Atlas Industries', 'Vertex Solutions', 'Summit Enterprises', 'Cascade Tech',
  'Orion Dynamics', 'Nova Retail', 'Eclipse Partners', 'Spectrum Global',
];

const BANKS = [
  'HDFC Bank', 'ICICI Bank', 'SBI', 'Axis Bank', 'Kotak Mahindra Bank',
  'Yes Bank', 'IDFC First Bank', 'IndusInd Bank', 'Federal Bank', 'PNB',
];

const DOMAINS = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'rediffmail.com'];
const CORP_DOMAINS = ['company.com', 'corp.in', 'biz.com', 'enterprise.co', 'solutions.in'];

// ─── Utility functions ───────────────────────────────────────────────────────

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomBetween(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function randomInt(min: number, max: number): number {
  return Math.floor(randomBetween(min, max + 1));
}

function weightedPick<T>(items: T[], weights: number[]): T {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

function generatePhone(): string {
  const prefixes = ['98', '97', '96', '95', '94', '93', '90', '89', '88', '87', '86', '85'];
  return `+91${pick(prefixes)}${randomInt(10000000, 99999999)}`;
}

function generateEmail(name: string, isCorperate = false): string {
  const cleaned = name.toLowerCase().replace(/\s+/g, '.');
  const domain = isCorperate ? pick(CORP_DOMAINS) : pick(DOMAINS);
  return `${cleaned}${randomInt(1, 999)}@${domain}`;
}

function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

// ─── Amount generators by severity ──────────────────────────────────────────

function generateAmount(
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
  caseType: CaseType
): number {
  const ranges: Record<typeof severity, [number, number]> = {
    LOW: [500, 2000],
    MEDIUM: [2000, 15000],
    HIGH: [15000, 75000],
    CRITICAL: [75000, 500000],
  };

  if (caseType === 'B2B_RECEIVABLE') {
    const b2bRanges: Record<typeof severity, [number, number]> = {
      LOW: [10000, 50000],
      MEDIUM: [50000, 250000],
      HIGH: [250000, 1000000],
      CRITICAL: [1000000, 5000000],
    };
    const [min, max] = b2bRanges[severity];
    return Math.round(randomBetween(min, max) / 100) * 100;
  }

  const [min, max] = ranges[severity];
  return Math.round(randomBetween(min, max) / 10) * 10;
}

// ─── Generator: FAILED_PAYMENT ────────────────────────────────────────────────

function generateFailedPayment(severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL') {
  const firstName = pick(FIRST_NAMES);
  const lastName = pick(LAST_NAMES);
  const customerName = `${firstName} ${lastName}`;
  const amount = generateAmount(severity, 'FAILED_PAYMENT');

  const declineCodes: DeclineCode[] = [
    'insufficient_funds', 'card_expired', 'do_not_honor', 'gateway_timeout',
    'lost_card', 'stolen_card', 'invalid_account', 'restricted_card', 'transaction_not_permitted',
  ];
  const declineWeights = [25, 20, 20, 15, 5, 3, 5, 4, 3];
  const declineCode = weightedPick(declineCodes, declineWeights);

  const cardBrands = ['Visa', 'Mastercard', 'RuPay', 'Amex'];
  const metadata: FailedPaymentMetadata = {
    declineCode,
    gatewayCode: `GW_${declineCode.toUpperCase()}_${randomInt(1000, 9999)}`,
    bankName: pick(BANKS),
    cardLast4: `${randomInt(1000, 9999)}`,
    cardBrand: pick(cardBrands),
    attemptCount: randomInt(1, 3),
    lastAttemptAt: daysAgo(randomInt(0, 3)).toISOString(),
    transactionId: `TXN_${uuidv4().replace(/-/g, '').toUpperCase().slice(0, 16)}`,
  };

  return {
    customerId: `CUST_${uuidv4().slice(0, 8).toUpperCase()}`,
    customerName,
    customerEmail: generateEmail(customerName),
    customerPhone: generatePhone(),
    customerSegment: 'CONSUMER' as const,
    type: 'FAILED_PAYMENT' as CaseType,
    amount,
    currency: 'INR',
    severity,
    eventOccurredAt: daysAgo(randomInt(0, 5)),
    eventMetadata: metadata,
  };
}

// ─── Generator: ABANDONED_CHECKOUT ───────────────────────────────────────────

function generateAbandonedCheckout(severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL') {
  const firstName = pick(FIRST_NAMES);
  const lastName = pick(LAST_NAMES);
  const customerName = `${firstName} ${lastName}`;
  const amount = generateAmount(severity, 'ABANDONED_CHECKOUT');

  const abandonmentReasons: AbandonmentReason[] = [
    'price_shock', 'payment_friction', 'distraction', 'shipping_cost', 'trust_concern',
  ];
  const reasonWeights = [25, 20, 30, 15, 10];
  const abandonmentReason = weightedPick(abandonmentReasons, reasonWeights);

  const productNames = [
    'Premium Wireless Headphones', 'Smart Watch Series X', 'Running Shoes Pro',
    'Coffee Maker Deluxe', 'Laptop Stand Ergonomic', 'Portable Charger 20000mAh',
    'Bluetooth Speaker Waterproof', 'Air Purifier HEPA', 'Fitness Tracker Band',
    'Gaming Mouse RGB', 'Mechanical Keyboard', 'Webcam 4K Ultra',
  ];

  const itemCount = randomInt(1, 4);
  const cartItems = Array.from({ length: itemCount }, () => ({
    name: pick(productNames),
    price: Math.round(randomBetween(200, amount * 0.7) / 10) * 10,
    qty: randomInt(1, 2),
  }));

  const checkoutSteps = ['cart', 'address', 'shipping', 'payment', 'review'];

  const metadata: AbandonedCheckoutMetadata = {
    abandonmentReason,
    cartItemCount: itemCount,
    cartItems,
    shippingCost: abandonmentReason === 'shipping_cost' ? randomInt(199, 599) : randomInt(0, 99),
    discountApplied: randomInt(0, 200),
    sessionDurationSeconds: randomInt(60, 600),
    lastPageVisited: abandonmentReason === 'trust_concern' ? 'security-policy' : 'checkout',
    checkoutStep: abandonmentReason === 'payment_friction' ? 'payment' : pick(checkoutSteps),
  };

  return {
    customerId: `CUST_${uuidv4().slice(0, 8).toUpperCase()}`,
    customerName,
    customerEmail: generateEmail(customerName),
    customerPhone: generatePhone(),
    customerSegment: 'CONSUMER' as const,
    type: 'ABANDONED_CHECKOUT' as CaseType,
    amount,
    currency: 'INR',
    severity,
    eventOccurredAt: daysAgo(randomInt(0, 2)), // Checkouts are recent
    eventMetadata: metadata,
  };
}

// ─── Generator: FAILED_SUBSCRIPTION ─────────────────────────────────────────

function generateFailedSubscription(severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL') {
  const firstName = pick(FIRST_NAMES);
  const lastName = pick(LAST_NAMES);
  const customerName = `${firstName} ${lastName}`;
  const amount = generateAmount(severity, 'FAILED_SUBSCRIPTION');

  const declineCodes: DeclineCode[] = [
    'card_expired', 'insufficient_funds', 'invalid_account', 'do_not_honor',
  ];
  const declineWeights = [35, 30, 20, 15];
  const declineCode = weightedPick(declineCodes, declineWeights);

  const plans = [
    { name: 'Basic Monthly', interval: 'MONTHLY' as const },
    { name: 'Pro Monthly', interval: 'MONTHLY' as const },
    { name: 'Business Quarterly', interval: 'QUARTERLY' as const },
    { name: 'Enterprise Annual', interval: 'ANNUAL' as const },
    { name: 'Premium Monthly', interval: 'MONTHLY' as const },
  ];
  const plan = pick(plans);
  const hasMandateId = Math.random() > 0.4;

  const metadata: FailedSubscriptionMetadata = {
    declineCode,
    planName: plan.name,
    planInterval: plan.interval,
    subscriptionAge: randomInt(30, 730), // days
    previousSuccessfulPayments: randomInt(1, 24),
    mandateId: hasMandateId ? `MANDATE_${uuidv4().slice(0, 8).toUpperCase()}` : undefined,
    nextRetryAt: daysAgo(-1).toISOString(),
  };

  return {
    customerId: `CUST_${uuidv4().slice(0, 8).toUpperCase()}`,
    customerName,
    customerEmail: generateEmail(customerName),
    customerPhone: generatePhone(),
    customerSegment: 'CONSUMER' as const,
    type: 'FAILED_SUBSCRIPTION' as CaseType,
    amount,
    currency: 'INR',
    severity,
    eventOccurredAt: daysAgo(randomInt(0, 7)),
    eventMetadata: metadata,
  };
}

// ─── Generator: B2B_RECEIVABLE ────────────────────────────────────────────────

function generateB2BReceivable(severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL') {
  const companyName = pick(COMPANIES);
  const firstName = pick(FIRST_NAMES);
  const lastName = pick(LAST_NAMES);
  const contactPerson = `${firstName} ${lastName}`;
  const amount = generateAmount(severity, 'B2B_RECEIVABLE');

  const agingBuckets = [30, 45, 60, 90, 120];
  const agingWeights = severity === 'CRITICAL' ? [5, 5, 20, 35, 35]
    : severity === 'HIGH' ? [10, 15, 30, 30, 15]
    : severity === 'MEDIUM' ? [20, 25, 30, 20, 5]
    : [40, 30, 20, 8, 2];
  const agingDays = weightedPick(agingBuckets, agingWeights);

  const services = [
    'Software Development Services', 'Cloud Infrastructure', 'IT Consulting',
    'Digital Marketing', 'Data Analytics Platform', 'Managed Security Services',
    'Training & Development', 'API Integration Services',
  ];
  const itemCount = randomInt(1, 3);
  const invoiceItems = Array.from({ length: itemCount }, () => ({
    description: pick(services),
    amount: Math.round(amount / itemCount / 100) * 100,
  }));

  const disputeRaised = agingDays > 60 && Math.random() > 0.7;
  const disputeReasons = [
    'Services not delivered as per SLA', 'Invoice amount mismatch',
    'Duplicate billing', 'Services partially delivered',
  ];

  const contactTitles = ['CFO', 'Finance Manager', 'Accounts Payable Manager', 'VP Finance', 'Director Finance'];

  const invoiceDate = daysAgo(agingDays + randomInt(5, 15));
  const dueDate = daysAgo(agingDays);

  const metadata: B2BReceivableMetadata = {
    invoiceNumber: `INV-${new Date().getFullYear()}-${randomInt(1000, 9999)}`,
    invoiceDate: invoiceDate.toISOString(),
    dueDate: dueDate.toISOString(),
    agingDays,
    invoiceItems,
    contactPerson,
    contactTitle: pick(contactTitles),
    previousReminders: Math.min(3, Math.floor(agingDays / 15)),
    disputeRaised,
    disputeReason: disputeRaised ? pick(disputeReasons) : undefined,
  };

  return {
    customerId: `CORP_${uuidv4().slice(0, 8).toUpperCase()}`,
    customerName: companyName,
    customerEmail: generateEmail(contactPerson, true),
    customerPhone: generatePhone(),
    customerSegment: amount > 500000 ? 'ENTERPRISE' : 'SMB' as const,
    type: 'B2B_RECEIVABLE' as CaseType,
    amount,
    currency: 'INR',
    severity,
    eventOccurredAt: dueDate,
    eventMetadata: metadata,
  };
}

// ─── Main generator ──────────────────────────────────────────────────────────

export interface SyntheticCase {
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerSegment: string;
  type: CaseType;
  amount: number;
  currency: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  eventOccurredAt: Date;
  eventMetadata: Record<string, unknown>;
}

export function generateSyntheticBatch(config: BatchConfig): SyntheticCase[] {
  const { batchSize, typeMix, severityDist } = config;
  const cases: SyntheticCase[] = [];

  // Calculate counts per type
  const totalMix = Object.values(typeMix).reduce((a, b) => a + b, 0);
  const typeCounts = {
    FAILED_PAYMENT: Math.round((typeMix.FAILED_PAYMENT / totalMix) * batchSize),
    ABANDONED_CHECKOUT: Math.round((typeMix.ABANDONED_CHECKOUT / totalMix) * batchSize),
    FAILED_SUBSCRIPTION: Math.round((typeMix.FAILED_SUBSCRIPTION / totalMix) * batchSize),
    B2B_RECEIVABLE: 0,
  };
  // Assign remainder to B2B
  typeCounts.B2B_RECEIVABLE = batchSize - typeCounts.FAILED_PAYMENT - typeCounts.ABANDONED_CHECKOUT - typeCounts.FAILED_SUBSCRIPTION;

  // Calculate severity distribution
  const totalSev = Object.values(severityDist).reduce((a, b) => a + b, 0);
  const severities: Array<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'> = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
  const sevWeights = severities.map(s => severityDist[s] / totalSev);

  const pickSeverity = () => weightedPick(severities, sevWeights.map(w => w * 100));

  // Generate each type
  for (let i = 0; i < typeCounts.FAILED_PAYMENT; i++) {
    const c = generateFailedPayment(pickSeverity());
    cases.push({ ...c, eventMetadata: c.eventMetadata as unknown as Record<string, unknown> });
  }
  for (let i = 0; i < typeCounts.ABANDONED_CHECKOUT; i++) {
    const c = generateAbandonedCheckout(pickSeverity());
    cases.push({ ...c, eventMetadata: c.eventMetadata as unknown as Record<string, unknown> });
  }
  for (let i = 0; i < typeCounts.FAILED_SUBSCRIPTION; i++) {
    const c = generateFailedSubscription(pickSeverity());
    cases.push({ ...c, eventMetadata: c.eventMetadata as unknown as Record<string, unknown> });
  }
  for (let i = 0; i < typeCounts.B2B_RECEIVABLE; i++) {
    const c = generateB2BReceivable(pickSeverity());
    cases.push({ ...c, eventMetadata: c.eventMetadata as unknown as Record<string, unknown> });
  }

  // Shuffle for realistic ordering
  return cases.sort(() => Math.random() - 0.5);
}

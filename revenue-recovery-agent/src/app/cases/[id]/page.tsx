'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Mail, MessageSquare, Phone, RefreshCw, ExternalLink } from 'lucide-react';
import {
  formatCurrency, STATUS_COLORS, SEVERITY_COLORS, ROOT_CAUSE_LABELS,
  CHANNEL_ICONS, AUDIT_EVENT_LABELS, TYPE_LABELS
} from '@/lib/utils';

interface CaseDetail {
  id: string;
  type: string;
  status: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerSegment: string;
  amount: number;
  currency: string;
  riskScore: number;
  severity: string;
  urgency: string;
  naturalRecoveryLikelihood: string;
  contactCount: number;
  currentRung: number;
  isDND: boolean;
  recoveredAmount?: number;
  recoveredAt?: string;
  terminatedAt?: string;
  terminalReason?: string;
  eventOccurredAt: string;
  createdAt: string;
  updatedAt: string;
  eventMetadata: Record<string, unknown>;
  diagnosis?: {
    rootCause: string;
    confidence: number;
    reasoning: string;
    modelUsed: string;
    isMock: boolean;
    actionability: string;
    subCategory?: string;
  } | null;
  interventions: Array<{
    id: string;
    rung: number;
    channel: string;
    messageContent: string;
    decisionRationale: string;
    complianceChecks: Array<{ rule: string; allowed: boolean; reason: string }>;
    executedAt?: string;
    outcome?: string;
    blockedBy?: string;
    blockedReason?: string;
  }>;
  auditEntries: Array<{
    id: string;
    stage: string;
    event: string;
    details: Record<string, unknown>;
    actor: string;
    timestamp: string;
    simulatedAt?: string;
  }>;
  promises: Array<{
    id: string;
    amount: number;
    dueDate: string;
    madeAt: string;
    status: string;
    notes: string;
  }>;
}

function ChannelIcon({ channel }: { channel: string }) {
  const icons: Record<string, React.ReactNode> = {
    EMAIL: <Mail size={12} />, SMS: <MessageSquare size={12} />,
    WHATSAPP: <MessageSquare size={12} color="#25d366" />, VOICE: <Phone size={12} />,
    RETRY: <RefreshCw size={12} />,
  };
  return <span>{icons[channel] ?? CHANNEL_ICONS[channel]}</span>;
}

export default function CaseDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [caseData, setCaseData] = useState<CaseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch(`/api/cases/${id}`)
      .then(r => r.json())
      .then(setCaseData)
      .finally(() => setLoading(false));
  }, [id]);

  const toggleMessage = (id: string) => {
    setExpandedMessages(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  };

  if (loading) {
    return (
      <div style={{ padding: '24px 28px' }}>
        {[...Array(6)].map((_, i) => (
          <div key={i} className="skeleton" style={{ height: i === 0 ? 80 : 120, marginBottom: 16, borderRadius: 12 }} />
        ))}
      </div>
    );
  }

  if (!caseData) {
    return (
      <div style={{ padding: '24px 28px', textAlign: 'center', color: 'var(--text-muted)' }}>
        Case not found.
      </div>
    );
  }

  const metadata = caseData.eventMetadata;

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1100, margin: '0 auto' }}>
      {/* Back */}
      <Link href="/cases" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontSize: 13, textDecoration: 'none', marginBottom: 16 }}>
        <ArrowLeft size={14} /> Back to Cases
      </Link>

      {/* Case Header */}
      <div className="glass-card" style={{ padding: 20, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>{caseData.customerName}</h1>
              <span className={`badge ${STATUS_COLORS[caseData.status] ?? ''}`}>{caseData.status.replace(/_/g, ' ')}</span>
              <span className={`badge ${SEVERITY_COLORS[caseData.severity] ?? ''}`}>{caseData.severity}</span>
            </div>
            <div style={{ display: 'flex', gap: 16, color: 'var(--text-secondary)', fontSize: 13 }}>
              <span>✉️ {caseData.customerEmail}</span>
              <span>📱 {caseData.customerPhone}</span>
              <span>🏢 {caseData.customerSegment}</span>
            </div>
            <div style={{ marginTop: 8, fontSize: 13, color: 'var(--text-muted)' }}>
              {TYPE_LABELS[caseData.type]} · Event: {new Date(caseData.eventOccurredAt).toLocaleDateString()}
              {caseData.isDND && <span style={{ marginLeft: 12, color: '#ef4444', fontWeight: 600 }}>🚫 DND</span>}
            </div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div className="gradient-text" style={{ fontSize: 32, fontWeight: 800 }}>
              {formatCurrency(caseData.amount)}
            </div>
            {caseData.status === 'RECOVERED' && caseData.recoveredAmount && (
              <div style={{ color: '#10b981', fontSize: 14, fontWeight: 600, marginTop: 4 }}>
                💰 Recovered: {formatCurrency(caseData.recoveredAmount)}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 8, justifyContent: 'flex-end', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Risk Score:</span>
              <div style={{ width: 60, height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ width: `${caseData.riskScore}%`, height: '100%', borderRadius: 3, background: caseData.riskScore >= 80 ? '#ef4444' : '#f59e0b' }} />
              </div>
              <span style={{ fontSize: 12, fontWeight: 600 }}>{Math.round(caseData.riskScore)}</span>
            </div>
          </div>
        </div>

        {/* Event Metadata */}
        <div style={{ marginTop: 16, padding: '12px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: 8, border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Event Details</div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {Object.entries(metadata).map(([k, v]) => {
              if (typeof v === 'object') return null;
              return (
                <div key={k}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{k.replace(/([A-Z])/g, ' $1').trim()}: </span>
                  <span style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 500 }}>{String(v)}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Diagnosis */}
        <div className="glass-card" style={{ padding: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
            🧠 Diagnosis
          </div>
          {caseData.diagnosis ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
                  {ROOT_CAUSE_LABELS[caseData.diagnosis.rootCause] ?? caseData.diagnosis.rootCause}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Confidence</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: caseData.diagnosis.confidence > 0.8 ? '#10b981' : '#f59e0b' }}>
                    {(caseData.diagnosis.confidence * 100).toFixed(0)}%
                  </div>
                </div>
              </div>
              <div style={{ marginBottom: 10 }}>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${caseData.diagnosis.confidence * 100}%` }} />
                </div>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 10 }}>
                {caseData.diagnosis.reasoning}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <span style={{ fontSize: 10, background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: 9999, color: 'var(--text-muted)' }}>
                  {caseData.diagnosis.isMock ? '🤖 Mock Mode' : `✨ ${caseData.diagnosis.modelUsed}`}
                </span>
                <span style={{ fontSize: 10, background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: 9999, color: 'var(--text-muted)' }}>
                  Actionability: {caseData.diagnosis.actionability}
                </span>
              </div>
            </>
          ) : (
            <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>No diagnosis yet</div>
          )}
        </div>

        {/* Promises */}
        <div className="glass-card" style={{ padding: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
            🤝 Promise-to-Pay Tracker
          </div>
          {caseData.promises.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>No promises recorded</div>
          ) : caseData.promises.map(p => (
            <div key={p.id} style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, marginBottom: 8, border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>{formatCurrency(p.amount)}</span>
                <span className={`badge ${p.status === 'FULFILLED' ? 'bg-emerald-500/20 text-emerald-300' : p.status === 'BROKEN' ? 'bg-red-500/20 text-red-300' : 'bg-amber-500/20 text-amber-300'}`}>
                  {p.status}
                </span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Due: {new Date(p.dueDate).toLocaleDateString()} · Made: {new Date(p.madeAt).toLocaleDateString()}
              </div>
              {p.notes && <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>{p.notes}</div>}
            </div>
          ))}
          {caseData.terminalReason && (
            <div style={{ marginTop: 8, padding: '8px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
              <strong>Terminal:</strong> {caseData.terminalReason}
            </div>
          )}
        </div>
      </div>

      {/* Interventions Timeline */}
      <div className="glass-card" style={{ padding: 20, marginTop: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 16 }}>
          📋 Intervention Timeline ({caseData.interventions.length} actions)
        </div>
        {caseData.interventions.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>No interventions executed</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {caseData.interventions.map((inv, idx) => (
              <div key={inv.id} style={{
                padding: '14px 16px', background: 'rgba(255,255,255,0.02)',
                borderRadius: 10, border: '1px solid',
                borderColor: inv.blockedBy ? 'rgba(239,68,68,0.3)' : inv.outcome === 'PAYMENT_SUCCEEDED' ? 'rgba(16,185,129,0.3)' : 'var(--border)',
              }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%',
                    background: `linear-gradient(135deg, ${['#3b82f6','#8b5cf6','#f59e0b','#ef4444'][inv.rung - 1] ?? '#64748b'}22, ${['#3b82f6','#8b5cf6','#f59e0b','#ef4444'][inv.rung - 1] ?? '#64748b'}44)`,
                    border: `1px solid ${['#3b82f6','#8b5cf6','#f59e0b','#ef4444'][inv.rung - 1] ?? '#64748b'}44`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 700, color: ['#3b82f6','#8b5cf6','#f59e0b','#ef4444'][inv.rung - 1] ?? '#64748b',
                  }}>
                    {inv.rung}
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>Rung {inv.rung} — {inv.channel}</span>
                      <span>{CHANNEL_ICONS[inv.channel]}</span>
                      {inv.outcome && (
                        <span className={`badge ${inv.outcome === 'PAYMENT_SUCCEEDED' || inv.outcome === 'DELIVERED' ? 'bg-emerald-500/20 text-emerald-300' : inv.outcome === 'BLOCKED' ? 'bg-red-500/20 text-red-300' : 'bg-slate-500/20 text-slate-300'}`}>
                          {inv.outcome}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                      {inv.executedAt && new Date(inv.executedAt).toLocaleString()}
                    </div>
                  </div>
                </div>

                {/* Rationale */}
                {inv.decisionRationale && (
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 10, padding: '8px 10px', background: 'rgba(255,255,255,0.02)', borderRadius: 6, borderLeft: '2px solid var(--accent-blue)' }}>
                    <strong style={{ color: 'var(--text-muted)', fontSize: 11 }}>Decision Rationale: </strong>
                    {inv.decisionRationale}
                  </div>
                )}

                {/* Compliance Checks */}
                {inv.complianceChecks?.length > 0 && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>Compliance Checks:</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {inv.complianceChecks.map((check, i) => (
                        <span key={i} style={{
                          fontSize: 10, padding: '2px 8px', borderRadius: 9999,
                          background: check.allowed ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                          color: check.allowed ? '#10b981' : '#ef4444',
                          border: `1px solid ${check.allowed ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
                        }}>
                          {check.allowed ? '✓' : '✗'} {check.rule}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Message Content */}
                {inv.messageContent && inv.channel !== 'RETRY' && (
                  <div>
                    <button
                      onClick={() => toggleMessage(inv.id)}
                      style={{ fontSize: 11, color: 'var(--accent-blue)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                    >
                      {expandedMessages.has(inv.id) ? '▼' : '▶'} {expandedMessages.has(inv.id) ? 'Hide' : 'Show'} message content
                    </button>
                    {expandedMessages.has(inv.id) && (
                      <pre style={{
                        marginTop: 8, padding: '12px 14px',
                        background: 'rgba(0,0,0,0.3)',
                        borderRadius: 8, fontSize: 12, color: 'var(--text-primary)',
                        whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                        border: '1px solid var(--border)', lineHeight: 1.6,
                        fontFamily: 'inherit',
                      }}>
                        {inv.messageContent}
                      </pre>
                    )}
                  </div>
                )}

                {/* Blocked reason */}
                {inv.blockedBy && (
                  <div style={{ fontSize: 12, color: '#ef4444', padding: '6px 10px', background: 'rgba(239,68,68,0.08)', borderRadius: 6, marginTop: 8 }}>
                    🚫 Blocked by {inv.blockedBy}: {inv.blockedReason}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Full Audit Trail */}
      <div className="glass-card" style={{ padding: 20, marginTop: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 16 }}>
          📜 Full Audit Trail ({caseData.auditEntries.length} entries)
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {caseData.auditEntries.map(entry => (
            <div key={entry.id} style={{
              display: 'flex', gap: 12, padding: '8px 10px', borderRadius: 6,
              background: entry.event === 'CASE_CLOSED' && entry.details.terminalState === 'RECOVERED' ? 'rgba(16,185,129,0.04)' : 'transparent',
            }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', whiteSpace: 'nowrap', paddingTop: 1, minWidth: 90 }}>
                {new Date(entry.timestamp).toLocaleTimeString()}
              </div>
              <div style={{
                width: 6, height: 6, borderRadius: '50%', marginTop: 4, flexShrink: 0,
                background: entry.event === 'CASE_CLOSED' && entry.details.terminalState === 'RECOVERED' ? '#10b981'
                  : entry.event === 'COMPLIANCE_CHECKED' && !entry.details.allowed ? '#ef4444'
                  : entry.event === 'DIAGNOSIS_MADE' ? '#8b5cf6'
                  : 'var(--text-muted)',
              }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                  {AUDIT_EVENT_LABELS[entry.event] ?? entry.event}
                  <span style={{ fontWeight: 400, color: 'var(--text-muted)', marginLeft: 8 }}>[{entry.stage}]</span>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 8 }}>by {entry.actor}</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 1 }}>
                  {entry.event === 'DIAGNOSIS_MADE'
                    ? `${ROOT_CAUSE_LABELS[entry.details.rootCause as string] ?? entry.details.rootCause} · ${((entry.details.confidence as number) * 100).toFixed(0)}% confidence`
                    : entry.event === 'COMPLIANCE_CHECKED'
                    ? (entry.details.allowed ? '✓ All checks passed' : `✗ Blocked: ${entry.details.blockedReason}`)
                    : entry.event === 'CASE_CLOSED'
                    ? `${entry.details.terminalState} · ${entry.details.reason}`
                    : entry.event === 'ACTION_EXECUTED'
                    ? `${entry.details.channel} · Rung ${entry.details.rung} · ${entry.details.outcome}`
                    : JSON.stringify(entry.details).slice(0, 120)
                  }
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

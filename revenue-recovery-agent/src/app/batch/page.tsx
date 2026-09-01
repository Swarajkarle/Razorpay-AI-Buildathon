'use client';

import { useState, useRef, useEffect } from 'react';
import { Play, Settings2, BarChart3, CheckCircle, XCircle, AlertTriangle, Loader2, Download } from 'lucide-react';
import { formatCurrency, formatPercent, ROOT_CAUSE_LABELS, CHANNEL_ICONS, TYPE_LABELS } from '@/lib/utils';

interface ProgressEvent {
  type: string;
  batchId?: string;
  caseId?: string;
  caseIndex?: number;
  totalCases?: number;
  customerName?: string;
  caseType?: string;
  riskScore?: number;
  severity?: string;
  rootCause?: string;
  confidence?: number;
  channel?: string;
  rung?: number;
  status?: string;
  recoveredAmount?: number;
  totalRecovered?: number;
  totalAtRisk?: number;
  recoveryRate?: number;
  error?: string;
}

interface BatchConfig {
  batchSize: number;
  typeMix: { FAILED_PAYMENT: number; ABANDONED_CHECKOUT: number; FAILED_SUBSCRIPTION: number; B2B_RECEIVABLE: number };
  severityDist: { LOW: number; MEDIUM: number; HIGH: number; CRITICAL: number };
}

export default function BatchPage() {
  const [config, setConfig] = useState<BatchConfig>({
    batchSize: 30,
    typeMix: { FAILED_PAYMENT: 35, ABANDONED_CHECKOUT: 30, FAILED_SUBSCRIPTION: 25, B2B_RECEIVABLE: 10 },
    severityDist: { LOW: 10, MEDIUM: 35, HIGH: 35, CRITICAL: 20 },
  });
  const [running, setRunning] = useState(false);
  const [events, setEvents] = useState<ProgressEvent[]>([]);
  const [currentBatchId, setCurrentBatchId] = useState<string | null>(null);
  const [finalEvent, setFinalEvent] = useState<ProgressEvent | null>(null);
  const [progress, setProgress] = useState(0);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [events]);

  const runBatch = async () => {
    setRunning(true);
    setEvents([]);
    setFinalEvent(null);
    setProgress(0);
    setCurrentBatchId(null);

    try {
      const response = await fetch('/api/batch/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });

      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const event: ProgressEvent = JSON.parse(line.slice(6));
              setEvents(prev => [...prev.slice(-100), event]); // keep last 100

              if (event.type === 'batch_started') {
                setCurrentBatchId(event.batchId ?? null);
              }
              if (event.type === 'case_completed' && event.caseIndex && event.totalCases) {
                setProgress((event.caseIndex / event.totalCases) * 100);
              }
              if (event.type === 'batch_completed') {
                setFinalEvent(event);
                setProgress(100);
              }
            } catch {}
          }
        }
      }
    } catch (err) {
      setEvents(prev => [...prev, { type: 'error', error: String(err) }]);
    } finally {
      setRunning(false);
    }
  };

  const totalTypeMix = Object.values(config.typeMix).reduce((a, b) => a + b, 0);

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Run Batch</h1>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
          Generate a synthetic batch and run the full AI recovery pipeline with live progress
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 16 }}>
        {/* Config Panel */}
        <div>
          <div className="glass-card" style={{ padding: 20, marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
              <Settings2 size={16} color="var(--text-muted)" />
              <h2 style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>Batch Configuration</h2>
            </div>

            {/* Batch Size */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                Batch Size: <strong style={{ color: 'var(--accent-blue)' }}>{config.batchSize} cases</strong>
              </label>
              <input type="range" min={5} max={100} value={config.batchSize} onChange={e => setConfig(c => ({ ...c, batchSize: parseInt(e.target.value) }))} style={{ width: '100%' }} disabled={running} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                <span>5</span><span>100</span>
              </div>
            </div>

            {/* Type Mix */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 8 }}>Case Type Mix</label>
              {Object.entries(config.typeMix).map(([key, val]) => (
                <div key={key} style={{ marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{TYPE_LABELS[key] ?? key}</span>
                    <span style={{ fontSize: 11, fontWeight: 600 }}>{Math.round((val / totalTypeMix) * config.batchSize)} cases</span>
                  </div>
                  <input
                    type="range" min={0} max={100} value={val}
                    onChange={e => setConfig(c => ({ ...c, typeMix: { ...c.typeMix, [key]: parseInt(e.target.value) } }))}
                    style={{ width: '100%' }} disabled={running}
                  />
                </div>
              ))}
            </div>

            {/* Severity Distribution */}
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 8 }}>Severity Distribution</label>
              {Object.entries(config.severityDist).map(([key, val]) => {
                const colors: Record<string, string> = { LOW: '#10b981', MEDIUM: '#f59e0b', HIGH: '#f97316', CRITICAL: '#ef4444' };
                const total = Object.values(config.severityDist).reduce((a, b) => a + b, 0);
                return (
                  <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 11, width: 60, color: colors[key] ?? 'var(--text-muted)' }}>{key}</span>
                    <input type="range" min={0} max={60} value={val} onChange={e => setConfig(c => ({ ...c, severityDist: { ...c.severityDist, [key]: parseInt(e.target.value) } }))} style={{ flex: 1 }} disabled={running} />
                    <span style={{ fontSize: 11, width: 30, textAlign: 'right', color: 'var(--text-muted)' }}>{total > 0 ? Math.round((val / total) * 100) : 0}%</span>
                  </div>
                );
              })}
            </div>
          </div>

          <button className="btn-primary" onClick={runBatch} disabled={running} style={{ width: '100%', justifyContent: 'center', padding: '14px' }}>
            {running ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Running Pipeline...</> : <><Play size={16} /> Run Batch Pipeline</>}
          </button>
        </div>

        {/* Live Progress */}
        <div>
          {/* Progress Bar */}
          {(running || finalEvent) && (
            <div className="glass-card" style={{ padding: 16, marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>
                  {running ? 'Pipeline Running...' : '✅ Pipeline Complete'}
                </span>
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{Math.round(progress)}%</span>
              </div>
              <div className="progress-bar" style={{ height: 8 }}>
                <div className="progress-fill" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}

          {/* Final Results */}
          {finalEvent && (
            <div className="glass-card" style={{ padding: 20, marginBottom: 16, border: '1px solid rgba(16,185,129,0.3)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <CheckCircle size={20} color="#10b981" />
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Batch Results</h3>
                {currentBatchId && (
                  <a href={`/api/audit/export?batchId=${currentBatchId}`} download style={{ marginLeft: 'auto' }}>
                    <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: 12 }}>
                      <Download size={12} /> Export Audit
                    </button>
                  </a>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                <div style={{ textAlign: 'center', padding: '12px', background: 'rgba(16,185,129,0.08)', borderRadius: 8 }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: '#10b981' }}>{formatCurrency(finalEvent.totalRecovered ?? 0)}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Recovered</div>
                </div>
                <div style={{ textAlign: 'center', padding: '12px', background: 'rgba(59,130,246,0.08)', borderRadius: 8 }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: '#3b82f6' }}>{formatPercent(finalEvent.recoveryRate ?? 0)}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Recovery Rate</div>
                </div>
                <div style={{ textAlign: 'center', padding: '12px', background: 'rgba(139,92,246,0.08)', borderRadius: 8 }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: '#8b5cf6' }}>{formatCurrency(finalEvent.totalAtRisk ?? 0)}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Total at Risk</div>
                </div>
              </div>
              <div style={{ marginTop: 12, display: 'flex', gap: 8, justifyContent: 'center' }}>
                <a href="/"><button className="btn-secondary" style={{ fontSize: 12 }}><BarChart3 size={12} /> View Dashboard</button></a>
                <a href="/cases"><button className="btn-secondary" style={{ fontSize: 12 }}>View Cases →</button></a>
              </div>
            </div>
          )}

          {/* Live Log */}
          <div className="glass-card" style={{ padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              {running && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981' }} className="pulse-live" />}
              <h3 style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>Live Pipeline Log</h3>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>{events.length} events</span>
            </div>
            <div ref={logRef} style={{ height: 400, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
              {events.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', fontSize: 13 }}>
                  Run a batch to see live progress
                </div>
              ) : events.map((e, i) => (
                <div key={i} style={{
                  display: 'flex', gap: 8, padding: '5px 8px', borderRadius: 4, fontSize: 12,
                  background: e.type === 'error' ? 'rgba(239,68,68,0.08)' : e.type === 'batch_completed' ? 'rgba(16,185,129,0.08)' : 'transparent',
                }}>
                  <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
                    {e.type === 'batch_started' ? '🚀'
                      : e.type === 'case_started' ? '📥'
                      : e.type === 'case_detected' ? '🔍'
                      : e.type === 'case_diagnosed' ? '🧠'
                      : e.type === 'case_intervened' ? `${CHANNEL_ICONS[e.channel ?? ''] ?? '📤'}`
                      : e.type === 'case_completed' ? (e.status === 'RECOVERED' ? '💰' : e.status === 'ESCALATED' ? '📞' : '✗')
                      : e.type === 'batch_completed' ? '✅'
                      : e.type === 'error' ? '❌' : '▸'}
                  </span>
                  <span style={{ color: e.type === 'error' ? '#ef4444' : e.type === 'batch_completed' ? '#10b981' : 'var(--text-secondary)' }}>
                    {e.type === 'batch_started' && `Batch started — ${e.totalCases} cases queued`}
                    {e.type === 'case_started' && `[${e.caseIndex}/${e.totalCases}] ${e.customerName} · ${e.caseType?.replace(/_/g, ' ')}`}
                    {e.type === 'case_detected' && `Risk score: ${Math.round(e.riskScore ?? 0)} · ${e.severity}`}
                    {e.type === 'case_diagnosed' && `Root cause: ${ROOT_CAUSE_LABELS[e.rootCause ?? ''] ?? e.rootCause} (${((e.confidence ?? 0) * 100).toFixed(0)}%)`}
                    {e.type === 'case_intervened' && `${e.channel} · Rung ${e.rung}`}
                    {e.type === 'case_completed' && `→ ${e.status}${e.recoveredAmount ? ` · ${formatCurrency(e.recoveredAmount)}` : ''}`}
                    {e.type === 'batch_completed' && `Complete! Recovered ${formatCurrency(e.totalRecovered ?? 0)} (${formatPercent(e.recoveryRate ?? 0)})`}
                    {e.type === 'error' && `Error: ${e.error}`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

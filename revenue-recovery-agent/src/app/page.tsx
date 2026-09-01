'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, AreaChart, Area, CartesianGrid,
} from 'recharts';
import {
  TrendingUp, AlertTriangle, CheckCircle, XCircle, Clock,
  Shield, RefreshCw, Download, Zap, Activity,
} from 'lucide-react';
import {
  formatCurrency, formatPercent, ROOT_CAUSE_LABELS,
  ROOT_CAUSE_COLORS, CHANNEL_COLORS, CHANNEL_ICONS, AUDIT_EVENT_LABELS, TYPE_LABELS
} from '@/lib/utils';

interface Metrics {
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
  costToRecoverPerCase: number;
  breakdownByRootCause: Record<string, { count: number; recovered: number; atRisk: number }>;
  breakdownByChannel: Record<string, { count: number; successCount: number }>;
  breakdownByType: Record<string, { count: number; recovered: number; atRisk: number }>;
  startedAt: string;
  completedAt: string;
}

interface AuditEntry {
  id: string;
  caseId: string | null;
  stage: string;
  event: string;
  details: Record<string, unknown>;
  actor: string;
  timestamp: string;
  case?: { customerName: string; amount: number; type: string } | null;
}

interface Batch {
  id: string;
  totalAtRisk: number;
  totalRecovered: number;
  caseCount: number;
  recoveredCount: number;
  startedAt: string;
  completedAt: string | null;
}

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'rgba(10,14,28,0.97)',
      border: '1px solid rgba(99,102,241,0.25)',
      borderRadius: 10, padding: '10px 14px',
      backdropFilter: 'blur(16px)',
      boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
    }}>
      <p style={{ color: '#94a3b8', fontSize: 11, marginBottom: 6, letterSpacing: '0.04em' }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color, fontSize: 13, fontWeight: 700, margin: '2px 0' }}>
          {p.name}: {typeof p.value === 'number' && p.value > 100 ? formatCurrency(p.value) : p.value}
        </p>
      ))}
    </div>
  );
};

// Fake sparkline data for each KPI card
const SPARKLINE = [42, 55, 48, 62, 70, 65, 78, 82, 75, 90, 85, 100];

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [auditFeed, setAuditFeed] = useState<AuditEntry[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [auditLoading, setAuditLoading] = useState(false);

  const loadBatches = useCallback(async () => {
    const res = await fetch('/api/batch');
    if (res.ok) {
      const data = await res.json();
      setBatches(data);
      if (data.length > 0 && !selectedBatchId) setSelectedBatchId(data[0].id);
    }
  }, [selectedBatchId]);

  const loadMetrics = useCallback(async (batchId?: string) => {
    setLoading(true);
    try {
      const url = batchId ? `/api/metrics?batchId=${batchId}` : '/api/metrics';
      const res = await fetch(url);
      if (res.ok) setMetrics(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAuditFeed = useCallback(async () => {
    setAuditLoading(true);
    try {
      const res = await fetch('/api/audit?limit=20');
      if (res.ok) setAuditFeed(await res.json());
    } finally {
      setAuditLoading(false);
    }
  }, []);

  useEffect(() => { loadBatches(); loadAuditFeed(); }, []);
  useEffect(() => { if (selectedBatchId) loadMetrics(selectedBatchId); }, [selectedBatchId]);
  useEffect(() => {
    const interval = setInterval(loadAuditFeed, 5000);
    return () => clearInterval(interval);
  }, [loadAuditFeed]);

  const rootCauseData = metrics
    ? Object.entries(metrics.breakdownByRootCause)
        .sort((a, b) => b[1].atRisk - a[1].atRisk).slice(0, 8)
        .map(([key, val]) => ({
          name: ROOT_CAUSE_LABELS[key] ?? key,
          value: val.count,
          atRisk: val.atRisk,
          recovered: val.recovered,
          color: ROOT_CAUSE_COLORS[key] ?? '#64748b',
        }))
    : [];

  const channelData = metrics
    ? Object.entries(metrics.breakdownByChannel)
        .filter(([k]) => k !== 'NONE')
        .map(([key, val]) => ({
          name: `${CHANNEL_ICONS[key]} ${key}`,
          total: val.count,
          success: val.successCount,
          color: CHANNEL_COLORS[key] ?? '#64748b',
        }))
    : [];

  const typeData = metrics
    ? Object.entries(metrics.breakdownByType).map(([key, val]) => ({
        name: TYPE_LABELS[key] ?? key,
        atRisk: val.atRisk,
        recovered: val.recovered,
        count: val.count,
      }))
    : [];

  const sparkData = SPARKLINE.map((v, i) => ({ x: i, v }));

  const auditEventColor = (entry: AuditEntry) => {
    if (entry.event === 'CASE_CLOSED' && entry.details?.terminalState === 'RECOVERED') return '#10b981';
    if (entry.event === 'COMPLIANCE_CHECKED' && !entry.details?.allowed) return '#ef4444';
    if (entry.event === 'DIAGNOSIS_MADE') return '#8b5cf6';
    if (entry.event === 'ACTION_EXECUTED') return '#3b82f6';
    if (entry.event === 'RISK_DETECTED') return '#f59e0b';
    return '#334155';
  };

  return (
    <>
      <style>{`
        @keyframes shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
        @keyframes pulse-dot { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.5;transform:scale(1.3)} }
        @keyframes slide-in { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        @keyframes glow-pulse { 0%,100%{box-shadow:var(--g)} 50%{box-shadow:none} }

        .dash-root { padding: 28px 32px; max-width: 1440px; margin: 0 auto; }


        /* KPI cards */
        .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }

        .kpi-card {
          border-radius: 14px;
          padding: 20px;
          position: relative;
          overflow: hidden;
          border: 1px solid transparent;
          transition: transform .2s ease, box-shadow .2s ease;
          cursor: default;
        }
        .kpi-card:hover { transform: translateY(-3px); }

        .kpi-card-green {
          background: linear-gradient(135deg, rgba(16,185,129,0.1) 0%, rgba(6,182,212,0.06) 100%);
          border-color: rgba(16,185,129,0.25);
          --g: 0 8px 32px rgba(16,185,129,0.2);
        }
        .kpi-card-green:hover { box-shadow: 0 8px 32px rgba(16,185,129,0.2); }
        .kpi-card-green .kpi-top-bar { background: linear-gradient(90deg, #10b981, #06b6d4); }

        .kpi-card-amber {
          background: linear-gradient(135deg, rgba(245,158,11,0.1) 0%, rgba(251,113,133,0.06) 100%);
          border-color: rgba(245,158,11,0.25);
        }
        .kpi-card-amber:hover { box-shadow: 0 8px 32px rgba(245,158,11,0.2); }
        .kpi-card-amber .kpi-top-bar { background: linear-gradient(90deg, #f59e0b, #fb7185); }

        .kpi-card-purple {
          background: linear-gradient(135deg, rgba(139,92,246,0.1) 0%, rgba(59,130,246,0.06) 100%);
          border-color: rgba(139,92,246,0.25);
        }
        .kpi-card-purple:hover { box-shadow: 0 8px 32px rgba(139,92,246,0.2); }
        .kpi-card-purple .kpi-top-bar { background: linear-gradient(90deg, #8b5cf6, #3b82f6); }

        .kpi-card-blue {
          background: linear-gradient(135deg, rgba(59,130,246,0.1) 0%, rgba(99,102,241,0.06) 100%);
          border-color: rgba(59,130,246,0.25);
        }
        .kpi-card-blue:hover { box-shadow: 0 8px 32px rgba(59,130,246,0.2); }
        .kpi-card-blue .kpi-top-bar { background: linear-gradient(90deg, #3b82f6, #6366f1); }

        .kpi-top-bar {
          position: absolute; top: 0; left: 0; right: 0; height: 3px;
        }
        .kpi-icon-wrap {
          width: 38px; height: 38px; border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .kpi-label {
          font-size: 11px; font-weight: 700; text-transform: uppercase;
          letter-spacing: .09em; color: #64748b; margin-bottom: 8px;
        }
        .kpi-value {
          font-size: 30px; font-weight: 800; line-height: 1;
          letter-spacing: -0.03em; margin-bottom: 6px;
        }
        .kpi-sub { font-size: 12px; color: #475569; margin-bottom: 12px; }

        /* Chart cards */
        .chart-grid { display: grid; grid-template-columns: 1.3fr 1fr 1fr; gap: 16px; margin-bottom: 24px; }
        .chart-card {
          background: rgba(13,15,20,0.7);
          border: 1px solid rgba(30,45,77,0.8);
          border-radius: 14px; padding: 22px;
          backdrop-filter: blur(12px);
          transition: border-color .2s;
        }
        .chart-card:hover { border-color: rgba(99,102,241,0.3); }
        .chart-title {
          font-size: 13px; font-weight: 700; color: #e2e8f0;
          margin-bottom: 16px; display: flex; align-items: center; gap: 8px;
        }
        .chart-title-dot {
          width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0;
        }

        /* Audit feed */
        .audit-card {
          background: rgba(13,15,20,0.7);
          border: 1px solid rgba(30,45,77,0.8);
          border-radius: 14px; padding: 22px;
          backdrop-filter: blur(12px);
        }

        .audit-row {
          display: flex; align-items: flex-start; gap: 12;
          padding: 9px 12px; border-radius: 8px;
          border-left: 2px solid;
          margin-bottom: 4px;
          transition: background .15s;
          animation: slide-in .25s ease both;
        }
        .audit-row:hover { background: rgba(255,255,255,0.03); }

        .live-dot {
          width: 8px; height: 8px; border-radius: 50%;
          background: #10b981;
          animation: pulse-dot 2s ease-in-out infinite;
          flex-shrink: 0; margin-top: 1px;
        }

        /* Progress bars colored */
        .prog-bar { height: 6px; border-radius: 3px; overflow: hidden; background: rgba(30,45,77,0.6); }
        .prog-fill-green { height: 100%; border-radius: 3px; background: linear-gradient(90deg, #10b981, #06b6d4); transition: width .6s ease; }
        .prog-fill-blue { height: 100%; border-radius: 3px; background: linear-gradient(90deg, #3b82f6, #8b5cf6); transition: width .6s ease; }
        .prog-fill-amber { height: 100%; border-radius: 3px; background: linear-gradient(90deg, #f59e0b, #fb7185); transition: width .6s ease; }
        .prog-fill-purple { height: 100%; border-radius: 3px; background: linear-gradient(90deg, #8b5cf6, #ec4899); transition: width .6s ease; }

        /* Skeleton */
        .skel { background: linear-gradient(90deg, rgba(30,45,77,.5) 25%, rgba(50,70,110,.3) 50%, rgba(30,45,77,.5) 75%); background-size: 200% 100%; animation: shimmer 1.5s infinite; border-radius: 8px; }

        /* Badge pill */
        .badge-pill {
          display: inline-flex; align-items: center;
          padding: 2px 9px; border-radius: 999px;
          font-size: 10px; font-weight: 700; letter-spacing: .04em;
        }

        .select-styled {
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(30,45,77,0.9);
          border-radius: 8px; padding: 8px 12px;
          color: #e2e8f0; font-size: 13px; outline: none;
          font-family: inherit; cursor: pointer;
          transition: border-color .15s;
        }
        .select-styled:focus { border-color: #6366f1; }

        .btn-icon {
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(30,45,77,0.9);
          border-radius: 8px; padding: 8px 10px;
          color: #94a3b8; cursor: pointer;
          display: flex; align-items: center; gap: 6px;
          font-size: 13px; font-weight: 500; font-family: inherit;
          transition: background .15s, border-color .15s, color .15s;
        }
        .btn-icon:hover { background: rgba(99,102,241,0.1); border-color: rgba(99,102,241,0.3); color: #e2e8f0; }
      `}</style>

      <div className="dash-root">
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, letterSpacing: '-0.02em', background: 'linear-gradient(135deg, #f1f5f9 30%, #94a3b8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              Revenue Recovery Dashboard
            </h1>
            <p style={{ fontSize: 13, color: '#475569', marginTop: 5 }}>
              AI-powered detection, diagnosis & recovery across all revenue-risk events
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {batches.length > 0 && (
              <select
                value={selectedBatchId ?? ''}
                onChange={e => setSelectedBatchId(e.target.value)}
                className="select-styled"
              >
                {batches.map(b => (
                  <option key={b.id} value={b.id}>
                    Batch {b.id.slice(0, 8)}… · {b.caseCount} cases
                  </option>
                ))}
              </select>
            )}
            <button className="btn-icon" onClick={() => { loadMetrics(selectedBatchId ?? undefined); loadAuditFeed(); }}>
              <RefreshCw size={14} />
            </button>
            {selectedBatchId && (
              <a href={`/api/audit/export?batchId=${selectedBatchId}`} download>
                <button className="btn-icon">
                  <Download size={14} />
                  <span>Export</span>
                </button>
              </a>
            )}
          </div>
        </div>

        {/* No data */}
        {!loading && !metrics && (
          <div style={{ textAlign: 'center', padding: '80px 40px', background: 'rgba(13,15,20,0.7)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 16, marginBottom: 24 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🚀</div>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, color: '#f1f5f9' }}>No batches yet</h2>
            <p style={{ color: '#64748b', marginBottom: 24 }}>Run your first batch to see revenue recovery metrics</p>
            <a href="/batch"><button style={{ background: 'linear-gradient(135deg,#6366f1,#3b82f6)', color: 'white', border: 'none', borderRadius: 10, padding: '12px 28px', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>Run First Batch</button></a>
          </div>
        )}

        {metrics && (
          <>
            {/* ── KPI CARDS ── */}
            <div className="kpi-grid">

              {/* Recovered */}
              <div className="kpi-card kpi-card-green">
                <div className="kpi-top-bar" />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                  <div className="kpi-icon-wrap" style={{ background: 'rgba(16,185,129,0.15)' }}>
                    <CheckCircle size={18} color="#10b981" />
                  </div>
                  <div style={{ height: 40, width: 80 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={sparkData}>
                        <defs>
                          <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#10b981" stopOpacity={0.4} />
                            <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <Area type="monotone" dataKey="v" stroke="#10b981" strokeWidth={2} fill="url(#sg)" dot={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="kpi-label">Revenue Recovered</div>
                <div className="kpi-value" style={{ background: 'linear-gradient(135deg,#10b981,#06b6d4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                  {formatCurrency(metrics.totalRecovered)}
                </div>
                <div className="kpi-sub">{metrics.recoveredCount} of {metrics.caseCount} cases</div>
                <div className="prog-bar">
                  <div className="prog-fill-green" style={{ width: `${Math.min(100, metrics.recoveryRate)}%` }} />
                </div>
                <div style={{ fontSize: 11, color: '#10b981', marginTop: 5, fontWeight: 700 }}>
                  {formatPercent(metrics.recoveryRate)} recovery rate
                </div>
              </div>

              {/* At Risk */}
              <div className="kpi-card kpi-card-amber">
                <div className="kpi-top-bar" />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                  <div className="kpi-icon-wrap" style={{ background: 'rgba(245,158,11,0.15)' }}>
                    <AlertTriangle size={18} color="#f59e0b" />
                  </div>
                  <div style={{ height: 40, width: 80 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={[...sparkData].reverse()}>
                        <defs>
                          <linearGradient id="sa" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.4} />
                            <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <Area type="monotone" dataKey="v" stroke="#f59e0b" strokeWidth={2} fill="url(#sa)" dot={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="kpi-label">At-Risk Revenue</div>
                <div className="kpi-value" style={{ background: 'linear-gradient(135deg,#f59e0b,#fb7185)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                  {formatCurrency(metrics.totalAtRisk)}
                </div>
                <div className="kpi-sub">{metrics.caseCount} total cases ingested</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <span className="badge-pill" style={{ background: 'rgba(239,68,68,0.12)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
                    {metrics.writtenOffCount} written off
                  </span>
                  <span className="badge-pill" style={{ background: 'rgba(245,158,11,0.12)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.2)' }}>
                    {metrics.escalatedCount} escalated
                  </span>
                </div>
              </div>

              {/* Avg Recovery Time */}
              <div className="kpi-card kpi-card-purple">
                <div className="kpi-top-bar" />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                  <div className="kpi-icon-wrap" style={{ background: 'rgba(139,92,246,0.15)' }}>
                    <Clock size={18} color="#8b5cf6" />
                  </div>
                  <div style={{ height: 40, width: 80 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={sparkData.map((d, i) => ({ ...d, v: Math.abs(Math.sin(i * 0.7)) * 100 }))}>
                        <defs>
                          <linearGradient id="sp" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.4} />
                            <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <Area type="monotone" dataKey="v" stroke="#8b5cf6" strokeWidth={2} fill="url(#sp)" dot={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="kpi-label">Avg Recovery Time</div>
                <div className="kpi-value" style={{ background: 'linear-gradient(135deg,#8b5cf6,#3b82f6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                  {metrics.avgTimeToRecoveryHours < 24
                    ? `${Math.round(metrics.avgTimeToRecoveryHours)}h`
                    : `${(metrics.avgTimeToRecoveryHours / 24).toFixed(1)}d`}
                </div>
                <div className="kpi-sub">Simulated time-to-recovery</div>
                <div style={{ fontSize: 12, color: '#94a3b8' }}>
                  Write-off rate: <strong style={{ color: '#f87171', fontWeight: 700 }}>{formatPercent(metrics.writeOffRate)}</strong>
                </div>
              </div>

              {/* Audit Coverage */}
              <div className="kpi-card kpi-card-blue">
                <div className="kpi-top-bar" />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                  <div className="kpi-icon-wrap" style={{ background: 'rgba(59,130,246,0.15)' }}>
                    <Shield size={18} color="#3b82f6" />
                  </div>
                  <div style={{ height: 40, width: 80 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={sparkData.map(d => ({ ...d, v: 95 + (d.v / 100) * 5 }))}>
                        <defs>
                          <linearGradient id="sb" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.4} />
                            <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <Area type="monotone" dataKey="v" stroke="#3b82f6" strokeWidth={2} fill="url(#sb)" dot={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="kpi-label">Audit Coverage</div>
                <div className="kpi-value" style={{ background: 'linear-gradient(135deg,#3b82f6,#6366f1)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                  {formatPercent(metrics.auditCoverage)}
                </div>
                <div className="kpi-sub">Cases with full audit trail</div>
                <div style={{ fontSize: 12, color: '#94a3b8' }}>
                  Cost to recover: <strong style={{ color: '#f1f5f9', fontWeight: 700 }}>₹{metrics.costToRecoverPerCase.toFixed(0)}/case</strong>
                </div>
              </div>
            </div>

            {/* ── CHARTS ROW ── */}
            <div className="chart-grid">
              {/* Root Cause Donut */}
              <div className="chart-card">
                <div className="chart-title">
                  <div className="chart-title-dot" style={{ background: 'linear-gradient(135deg,#8b5cf6,#3b82f6)' }} />
                  Breakdown by Root Cause
                </div>
                {rootCauseData.length > 0 ? (
                  <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                    <ResponsiveContainer width={150} height={150}>
                      <PieChart>
                        <Pie data={rootCauseData} cx="50%" cy="50%" innerRadius={42} outerRadius={70} paddingAngle={3} dataKey="value">
                          {rootCauseData.map((entry, i) => (
                            <Cell key={i} fill={entry.color} stroke="rgba(0,0,0,0.2)" strokeWidth={1} />
                          ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
                      {rootCauseData.slice(0, 6).map((d, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                          <div style={{ width: 8, height: 8, borderRadius: 2, background: d.color, flexShrink: 0, boxShadow: `0 0 6px ${d.color}60` }} />
                          <span style={{ fontSize: 11, color: '#94a3b8', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</span>
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#e2e8f0', flexShrink: 0 }}>{d.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div style={{ height: 150, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#334155', fontSize: 13 }}>No data</div>
                )}
              </div>

              {/* Channel Performance */}
              <div className="chart-card">
                <div className="chart-title">
                  <div className="chart-title-dot" style={{ background: 'linear-gradient(135deg,#10b981,#06b6d4)' }} />
                  Interventions by Channel
                </div>
                {channelData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={150}>
                    <BarChart data={channelData} margin={{ top: 0, right: 0, left: -24, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(30,45,77,0.4)" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="total" name="Total" fill="rgba(59,130,246,0.15)" radius={[5, 5, 0, 0]} />
                      <Bar dataKey="success" name="Success" fill="#10b981" radius={[5, 5, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ height: 150, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#334155', fontSize: 13 }}>No data</div>
                )}
              </div>

              {/* Recovery by Type */}
              <div className="chart-card">
                <div className="chart-title">
                  <div className="chart-title-dot" style={{ background: 'linear-gradient(135deg,#f59e0b,#fb7185)' }} />
                  Recovery by Case Type
                </div>
                {typeData.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {typeData.map((d, i) => {
                      const pct = d.atRisk > 0 ? Math.min(100, (d.recovered / d.atRisk) * 100) : 0;
                      const fills = ['prog-fill-green', 'prog-fill-blue', 'prog-fill-amber', 'prog-fill-purple'];
                      return (
                        <div key={i}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                            <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 500 }}>{d.name}</span>
                            <span style={{ fontSize: 12, fontWeight: 700, color: '#10b981' }}>
                              {d.atRisk > 0 ? formatPercent(pct, 0) : '0%'}
                            </span>
                          </div>
                          <div className="prog-bar">
                            <div className={fills[i % fills.length]} style={{ width: `${pct}%` }} />
                          </div>
                          <div style={{ fontSize: 10, color: '#475569', marginTop: 3 }}>
                            {formatCurrency(d.recovered)} of {formatCurrency(d.atRisk)} · {d.count} cases
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ height: 150, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#334155', fontSize: 13 }}>No data</div>
                )}
              </div>
            </div>
          </>
        )}

        {/* ── LIVE AUDIT FEED ── */}
        <div className="audit-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div className="live-dot" />
              <span style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0' }}>Live Audit Trail Feed</span>
              <span className="badge-pill" style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981', border: '1px solid rgba(16,185,129,0.25)' }}>
                LIVE
              </span>
            </div>
            <span style={{ fontSize: 11, color: '#334155', letterSpacing: '0.04em' }}>Auto-refreshes every 5s</span>
          </div>

          {auditLoading && auditFeed.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[...Array(5)].map((_, i) => (
                <div key={i} className="skel" style={{ height: 42 }} />
              ))}
            </div>
          ) : auditFeed.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#334155', fontSize: 13 }}>
              No audit entries yet. Run a batch to see the live trail.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 420, overflowY: 'auto' }}>
              {auditFeed.map(entry => {
                const borderColor = auditEventColor(entry);
                const bg =
                  entry.event === 'CASE_CLOSED' && entry.details?.terminalState === 'RECOVERED'
                    ? 'rgba(16,185,129,0.06)'
                    : entry.event === 'COMPLIANCE_CHECKED' && !entry.details?.allowed
                    ? 'rgba(239,68,68,0.06)'
                    : entry.event === 'DIAGNOSIS_MADE'
                    ? 'rgba(139,92,246,0.04)'
                    : 'transparent';

                return (
                  <div key={entry.id} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 12,
                    padding: '9px 12px', borderRadius: 8,
                    background: bg,
                    borderLeft: `2px solid ${borderColor}`,
                    marginBottom: 2,
                    transition: 'background .15s',
                  }}>
                    <div style={{ fontSize: 15, flexShrink: 0, marginTop: 1, filter: 'drop-shadow(0 0 4px currentColor)' }}>
                      {entry.event === 'RISK_DETECTED' ? '🔍'
                        : entry.event === 'DIAGNOSIS_MADE' ? '🧠'
                        : entry.event === 'INTERVENTION_DECIDED' ? '📋'
                        : entry.event === 'ACTION_EXECUTED' ? '📤'
                        : entry.event === 'COMPLIANCE_CHECKED' ? (entry.details?.allowed ? '✅' : '🚫')
                        : entry.event === 'CASE_CLOSED' ? (entry.details?.terminalState === 'RECOVERED' ? '💰' : entry.details?.terminalState === 'ESCALATED' ? '📞' : '✗')
                        : entry.event === 'PROMISE_LOGGED' ? '🤝'
                        : entry.event === 'PROMISE_FULFILLED' ? '✅'
                        : entry.event === 'PROMISE_BROKEN' ? '💔'
                        : '📝'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0' }}>
                          {AUDIT_EVENT_LABELS[entry.event] ?? entry.event}
                        </span>
                        {entry.case && (
                          <span style={{ fontSize: 11, color: '#475569' }}>· {entry.case.customerName}</span>
                        )}
                        <span style={{ fontSize: 10, color: '#334155', marginLeft: 'auto', fontVariantNumeric: 'tabular-nums' }}>
                          {new Date(entry.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {entry.event === 'DIAGNOSIS_MADE' && entry.details.rootCause
                          ? `Root cause: ${ROOT_CAUSE_LABELS[entry.details.rootCause as string] ?? entry.details.rootCause} (${((entry.details.confidence as number) * 100).toFixed(0)}% confidence)`
                          : entry.event === 'ACTION_EXECUTED'
                          ? `Channel: ${entry.details.channel} · Rung ${entry.details.rung} · ${entry.details.outcome}`
                          : entry.event === 'COMPLIANCE_CHECKED'
                          ? (entry.details.allowed ? 'All compliance checks passed' : `Blocked: ${entry.details.blockedReason}`)
                          : entry.event === 'CASE_CLOSED'
                          ? `${entry.details.terminalState}${entry.details.recoveredAmount ? ` · Recovered ${formatCurrency(entry.details.recoveredAmount as number)}` : ''}`
                          : entry.stage
                        }
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

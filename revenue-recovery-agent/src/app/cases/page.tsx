'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Search, Filter, ChevronRight, AlertTriangle, RefreshCw } from 'lucide-react';
import {
  formatCurrency, STATUS_COLORS, SEVERITY_COLORS, TYPE_LABELS, ROOT_CAUSE_LABELS, CHANNEL_ICONS
} from '@/lib/utils';

interface Case {
  id: string;
  type: string;
  status: string;
  customerName: string;
  customerEmail: string;
  amount: number;
  riskScore: number;
  severity: string;
  urgency: string;
  contactCount: number;
  currentRung: number;
  updatedAt: string;
  createdAt: string;
  diagnosis?: { rootCause: string; confidence: number } | null;
  interventions?: Array<{ channel: string; rung: number; outcome: string; executedAt: string }>;
  promises?: Array<{ status: string; amount: number }>;
}

interface CasesResponse {
  cases: Case[];
  total: number;
  page: number;
  totalPages: number;
}

const STATUSES = ['', 'DETECTED', 'DIAGNOSING', 'INTERVENING', 'PROMISED', 'RECOVERED', 'ESCALATED', 'WRITTEN_OFF'];
const TYPES = ['', 'FAILED_PAYMENT', 'ABANDONED_CHECKOUT', 'FAILED_SUBSCRIPTION', 'B2B_RECEIVABLE'];

export default function CasesPage() {
  const [data, setData] = useState<CasesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState('updatedAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '25',
        sortBy,
        sortDir,
      });
      if (statusFilter) params.set('status', statusFilter);
      if (typeFilter) params.set('type', typeFilter);
      if (severityFilter) params.set('severity', severityFilter);

      const res = await fetch(`/api/cases?${params}`);
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, typeFilter, severityFilter, sortBy, sortDir]);

  useEffect(() => { load(); }, [load]);

  const filteredCases = data?.cases.filter(c =>
    !search || c.customerName.toLowerCase().includes(search.toLowerCase()) || c.id.includes(search)
  ) ?? [];

  const toggleSort = (field: string) => {
    if (sortBy === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(field); setSortDir('desc'); }
  };

  return (
    <div style={{ padding: '24px 28px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Cases</h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
            {data?.total ?? 0} total revenue-risk cases
          </p>
        </div>
        <button className="btn-secondary" onClick={load} style={{ padding: '8px 12px' }}>
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1 1 200px' }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            className="input-field"
            style={{ paddingLeft: 32 }}
            placeholder="Search by name or ID..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select className="input-field" style={{ width: 'auto', flex: '0 0 auto' }} value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
          <option value="">All Statuses</option>
          {STATUSES.filter(Boolean).map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
        </select>
        <select className="input-field" style={{ width: 'auto', flex: '0 0 auto' }} value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setPage(1); }}>
          <option value="">All Types</option>
          {TYPES.filter(Boolean).map(t => <option key={t} value={t}>{TYPE_LABELS[t] ?? t}</option>)}
        </select>
        <select className="input-field" style={{ width: 'auto', flex: '0 0 auto' }} value={severityFilter} onChange={e => { setSeverityFilter(e.target.value); setPage(1); }}>
          <option value="">All Severities</option>
          {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="glass-card" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Type</th>
                <th onClick={() => toggleSort('amount')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                  Amount {sortBy === 'amount' ? (sortDir === 'desc' ? '↓' : '↑') : ''}
                </th>
                <th>Root Cause</th>
                <th>Status</th>
                <th onClick={() => toggleSort('riskScore')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                  Risk {sortBy === 'riskScore' ? (sortDir === 'desc' ? '↓' : '↑') : ''}
                </th>
                <th>Last Action</th>
                <th onClick={() => toggleSort('updatedAt')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                  Updated {sortBy === 'updatedAt' ? (sortDir === 'desc' ? '↓' : '↑') : ''}
                </th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(10)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(9)].map((_, j) => (
                      <td key={j}><div className="skeleton" style={{ height: 16, width: '80%' }} /></td>
                    ))}
                  </tr>
                ))
              ) : filteredCases.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                    No cases found. Run a batch to generate cases.
                  </td>
                </tr>
              ) : filteredCases.map(c => (
                <tr key={c.id}>
                  <td>
                    <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>{c.customerName}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{c.customerEmail}</div>
                  </td>
                  <td>
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                      {TYPE_LABELS[c.type] ?? c.type}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 13 }}>
                      {formatCurrency(c.amount)}
                    </span>
                  </td>
                  <td>
                    {c.diagnosis ? (
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                        {ROOT_CAUSE_LABELS[c.diagnosis.rootCause] ?? c.diagnosis.rootCause}
                      </span>
                    ) : (
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>—</span>
                    )}
                  </td>
                  <td>
                    <span className={`badge ${STATUS_COLORS[c.status] ?? ''}`}>
                      {c.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{
                        width: 32, height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden',
                      }}>
                        <div style={{
                          width: `${c.riskScore}%`, height: '100%', borderRadius: 3,
                          background: c.riskScore >= 80 ? '#ef4444' : c.riskScore >= 60 ? '#f59e0b' : '#10b981',
                        }} />
                      </div>
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{Math.round(c.riskScore)}</span>
                    </div>
                    <span className={`badge ${SEVERITY_COLORS[c.severity] ?? ''}`} style={{ fontSize: 10, marginTop: 2 }}>
                      {c.severity}
                    </span>
                  </td>
                  <td>
                    {c.interventions && c.interventions[0] ? (
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                        {CHANNEL_ICONS[c.interventions[0].channel]} Rung {c.interventions[0].rung}
                      </span>
                    ) : (
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>—</span>
                    )}
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>
                      {c.contactCount} contacts
                    </div>
                  </td>
                  <td>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {new Date(c.updatedAt).toLocaleDateString()}
                    </span>
                  </td>
                  <td>
                    <Link href={`/cases/${c.id}`}>
                      <button className="btn-secondary" style={{ padding: '6px 10px', fontSize: 12 }}>
                        <ChevronRight size={12} />
                      </button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data && data.totalPages > 1 && (
          <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Page {page} of {data.totalPages} · {data.total} total
            </span>
            <div style={{ display: 'flex', gap: 4 }}>
              <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: 12 }} disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</button>
              <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: 12 }} disabled={page === data.totalPages} onClick={() => setPage(p => p + 1)}>Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

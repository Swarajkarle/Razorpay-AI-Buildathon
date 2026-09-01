'use client';

import { useEffect, useState } from 'react';
import { Save, Plus, Trash2, Shield, Clock, Users, TrendingDown } from 'lucide-react';

interface Settings {
  maxContactAttempts: number;
  quietHoursStart: number;
  quietHoursEnd: number;
  dndList: string[];
  rung1DelayHours: number;
  rung2DelayHours: number;
  rung3DelayHours: number;
  rung4DelayHours: number;
  discountPct: number;
  paymentPlanMinAmount: number;
  writeOffAfterDays: number;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [newDND, setNewDND] = useState('');

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(setSettings);
  }, []);

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } finally {
      setSaving(false);
    }
  };

  const update = (key: keyof Settings, value: unknown) => {
    setSettings(prev => prev ? { ...prev, [key]: value } : null);
  };

  const addDND = () => {
    if (!newDND.trim() || !settings) return;
    update('dndList', [...settings.dndList, newDND.trim()]);
    setNewDND('');
  };

  const removeDND = (id: string) => {
    if (!settings) return;
    update('dndList', settings.dndList.filter(d => d !== id));
  };

  if (!settings) {
    return (
      <div style={{ padding: '24px 28px' }}>
        {[...Array(4)].map((_, i) => <div key={i} className="skeleton" style={{ height: 120, marginBottom: 16, borderRadius: 12 }} />)}
      </div>
    );
  }

  const Section = ({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) => (
    <div className="glass-card" style={{ padding: 20, marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
        {icon}
        <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>{title}</h2>
      </div>
      {children}
    </div>
  );

  const Field = ({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{label}</div>
        {description && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{description}</div>}
      </div>
      <div style={{ flexShrink: 0, marginLeft: 16 }}>{children}</div>
    </div>
  );

  return (
    <div style={{ padding: '24px 28px', maxWidth: 800, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Settings & Rules</h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
            Configure compliance thresholds and stopping rules — all enforced in code
          </p>
        </div>
        <button className="btn-primary" onClick={save} disabled={saving}>
          <Save size={14} />
          {saving ? 'Saving...' : saved ? '✓ Saved!' : 'Save Changes'}
        </button>
      </div>

      {/* Compliance Settings */}
      <Section title="Compliance & Contact Limits" icon={<Shield size={16} color="#10b981" />}>
        <Field label="Max Contact Attempts" description="Maximum outbound contacts per case before writing off or escalating">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="range" min={1} max={10} value={settings.maxContactAttempts} onChange={e => update('maxContactAttempts', parseInt(e.target.value))} style={{ width: 100 }} />
            <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent-blue)', minWidth: 20, textAlign: 'center' }}>{settings.maxContactAttempts}</span>
          </div>
        </Field>
        <Field label="Quiet Hours Start" description="No outbound contact before this hour (24h format)">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="number" min={0} max={23} className="input-field" style={{ width: 70 }} value={settings.quietHoursStart} onChange={e => update('quietHoursStart', parseInt(e.target.value))} />
            <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>:00</span>
          </div>
        </Field>
        <Field label="Quiet Hours End" description="No outbound contact after this hour (24h format)">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="number" min={0} max={23} className="input-field" style={{ width: 70 }} value={settings.quietHoursEnd} onChange={e => update('quietHoursEnd', parseInt(e.target.value))} />
            <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>:00</span>
          </div>
        </Field>
      </Section>

      {/* Escalation Ladder Timing */}
      <Section title="Escalation Ladder Timing" icon={<Clock size={16} color="#8b5cf6" />}>
        <div style={{ marginBottom: 12, padding: '10px 12px', background: 'rgba(139,92,246,0.08)', borderRadius: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
          Minimum simulated hours between escalation rungs. Rung 1 fires immediately; subsequent rungs wait these delays.
        </div>
        {([
          { key: 'rung1DelayHours', label: 'Rung 1 Delay', desc: 'Hours before Rung 1 (initial contact)' },
          { key: 'rung2DelayHours', label: 'Rung 2 Delay', desc: 'Hours after Rung 1 before Rung 2 (firm reminder)' },
          { key: 'rung3DelayHours', label: 'Rung 3 Delay', desc: 'Hours after Rung 2 before Rung 3 (discount/plan offer)' },
          { key: 'rung4DelayHours', label: 'Rung 4 Delay', desc: 'Hours after Rung 3 before Rung 4 (human handoff)' },
        ] as const).map(({ key, label, desc }) => (
          <Field key={key} label={label} description={desc}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="number" min={0} max={168} className="input-field" style={{ width: 80 }} value={settings[key]} onChange={e => update(key, parseInt(e.target.value))} />
              <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>sim-hours</span>
            </div>
          </Field>
        ))}
      </Section>

      {/* Recovery Thresholds */}
      <Section title="Recovery Thresholds" icon={<TrendingDown size={16} color="#f59e0b" />}>
        <Field label="Discount Percentage" description="% discount offered at Rung 3 for price-sensitive cases">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="range" min={5} max={30} value={settings.discountPct} onChange={e => update('discountPct', parseFloat(e.target.value))} style={{ width: 100 }} />
            <span style={{ fontSize: 16, fontWeight: 700, color: '#f59e0b', minWidth: 40 }}>{settings.discountPct}%</span>
          </div>
        </Field>
        <Field label="Payment Plan Min Amount" description="Minimum case amount (₹) to offer a payment plan">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>₹</span>
            <input type="number" min={1000} max={100000} step={500} className="input-field" style={{ width: 100 }} value={settings.paymentPlanMinAmount} onChange={e => update('paymentPlanMinAmount', parseFloat(e.target.value))} />
          </div>
        </Field>
        <Field label="Write-off After Days" description="Simulated days after which a non-recovering case is written off">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="number" min={7} max={90} className="input-field" style={{ width: 80 }} value={settings.writeOffAfterDays} onChange={e => update('writeOffAfterDays', parseInt(e.target.value))} />
            <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>sim-days</span>
          </div>
        </Field>
      </Section>

      {/* DND List */}
      <Section title="DND / Opt-out List" icon={<Users size={16} color="#ef4444" />}>
        <div style={{ marginBottom: 12, fontSize: 12, color: 'var(--text-muted)' }}>
          Customer IDs on this list will never be contacted. Permanently honored once added.
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <input
            className="input-field"
            placeholder="Enter customer ID to add to DND list..."
            value={newDND}
            onChange={e => setNewDND(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addDND()}
          />
          <button className="btn-secondary" onClick={addDND} style={{ flexShrink: 0 }}>
            <Plus size={14} /> Add
          </button>
        </div>
        {settings.dndList.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>No customers on DND list</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {settings.dndList.map(id => (
              <div key={id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(239,68,68,0.06)', borderRadius: 8, border: '1px solid rgba(239,68,68,0.15)' }}>
                <span style={{ fontSize: 13, fontFamily: 'monospace', color: '#f87171' }}>🚫 {id}</span>
                <button onClick={() => removeDND(id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px' }}>
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

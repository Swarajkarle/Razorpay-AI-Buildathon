'use client';

import { useState, useEffect, useRef, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, AlertCircle } from 'lucide-react';

const DEMO_EMAIL    = 'admin@razorpay.com';
const DEMO_PASSWORD = 'revenue2024';
const SESSION_KEY   = 'rra_session';

const ACTIVITY_POOL = [
  'Chargeback flagged — Acme Co.',
  'Invoice #4802 recovered — ₹2,110',
  'Follow-up email sent — 3 accounts',
  'Payment retry succeeded — Zomato Ltd.',
  'DND rule enforced — 1 contact blocked',
  'Root cause: CARD_EXPIRED — 5 cases',
  'Mandate lapsed — HDFC subscription',
  'Recovery escalated — Rung 3 triggered',
  'Batch #7 completed — ₹1.2L recovered',
  'Quiet hours enforced — 4 attempts held',
  'Voice script generated — Hinglish',
  'Promise-to-pay recorded — ₹8,400',
  'Write-off avoided — payment confirmed',
  'Diagnosis confidence 94% — INSUFFICIENT_FUNDS',
  'Subscription renewed — Swiggy Pro',
  'Contact attempt 3/5 — EMAIL sent',
  'New batch started — 25 cases queued',
];

function useAnimatedCounter(target: number, duration = 1400) {
  const [display, setDisplay] = useState(target);
  const prev = useRef(target);

  useEffect(() => {
    const start = prev.current;
    const diff  = target - start;
    if (diff === 0) return;
    const startTime = performance.now();
    let raf: number;
    const tick = (now: number) => {
      const t = Math.min((now - startTime) / duration, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(start + diff * ease));
      if (t < 1) raf = requestAnimationFrame(tick);
      else prev.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return display;
}

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [shake, setShake]       = useState(false);

  const [recovered, setRecovered]   = useState(0);
  const [dataLoaded, setDataLoaded] = useState(false);
  const animatedValue = useAnimatedCounter(recovered, 1400);

  const [logs, setLogs] = useState<string[]>([]);

  useEffect(() => {
    if (typeof window !== 'undefined' && sessionStorage.getItem(SESSION_KEY)) {
      router.replace('/');
    }
  }, [router]);

  useEffect(() => {
    async function fetchMetrics() {
      try {
        const res = await fetch('/api/metrics');
        if (res.ok) {
          const data = await res.json();
          setRecovered(Math.round(data.totalRecovered ?? 0));
          setDataLoaded(true);
        }
      } catch {
        setRecovered(1868380);
        setDataLoaded(true);
      }
    }
    fetchMetrics();
    const id = setInterval(fetchMetrics, 5000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!dataLoaded) return;
    const id = setInterval(() => {
      setRecovered(v => v + Math.floor(Math.random() * 800 + 200));
    }, 3200);
    return () => clearInterval(id);
  }, [dataLoaded]);

  useEffect(() => {
    const shuffled = [...ACTIVITY_POOL].sort(() => Math.random() - 0.5);
    setLogs(shuffled.slice(0, 5));
    const id = setInterval(() => {
      setLogs(prev => {
        const next = [...prev];
        next.shift();
        const unused = ACTIVITY_POOL.filter(e => !next.includes(e));
        next.push(unused[Math.floor(Math.random() * unused.length)]);
        return next;
      });
    }, 2200);
    return () => clearInterval(id);
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    await new Promise(r => setTimeout(r, 800));
    if (email.trim().toLowerCase() === DEMO_EMAIL && password === DEMO_PASSWORD) {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ email, loginAt: Date.now() }));
      router.push('/');
    } else {
      setLoading(false);
      setError('Invalid credentials. Use the demo account below.');
      setShake(true);
      setTimeout(() => setShake(false), 600);
    }
  };

  const handleDemo = () => {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ email: DEMO_EMAIL, loginAt: Date.now() }));
    router.push('/');
  };

  const formatINR = (n: number) => '₹' + n.toLocaleString('en-IN');

  return (
    <>
      <style>{`
        @keyframes shake { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-8px)} 40%{transform:translateX(8px)} 60%{transform:translateX(-6px)} 80%{transform:translateX(6px)} }
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes logSlide { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }

        .login-root {
          display: flex;
          min-height: 100vh;
          width: 100%;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          background: #0a0b0f;
        }

        .left-panel {
          width: 480px;
          min-width: 420px;
          display: flex;
          flex-direction: column;
          padding: 40px 48px;
          background: #0a0b0f;
          border-right: 1px solid rgba(255,255,255,0.06);
          position: relative;
          z-index: 1;
        }

        .brand-row {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .brand-icon {
          width: 12px; height: 12px;
          background: #4e7aff;
          border-radius: 2px;
          flex-shrink: 0;
        }
        .brand-name {
          font-size: 14px;
          font-weight: 600;
          color: #e2e8f0;
          letter-spacing: -0.01em;
        }

        .form-wrap {
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: 48px 0;
          animation: fadeUp .5s ease both;
        }

        .form-title {
          font-size: 28px;
          font-weight: 700;
          color: #f1f5f9;
          margin: 0 0 6px;
          letter-spacing: -0.02em;
        }
        .form-subtitle {
          font-size: 14px;
          color: #64748b;
          margin: 0 0 32px;
        }

        .field-label {
          display: block;
          font-size: 13px;
          font-weight: 500;
          color: #94a3b8;
          margin-bottom: 6px;
        }
        .field-wrap { position: relative; margin-bottom: 16px; }

        .field-input {
          width: 100%;
          padding: 11px 14px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 8px;
          color: #f1f5f9;
          font-size: 14px;
          outline: none;
          transition: border-color .15s, background .15s, box-shadow .15s;
          font-family: inherit;
          box-sizing: border-box;
        }
        .field-input:focus {
          border-color: #4e7aff;
          background: rgba(78,122,255,0.06);
          box-shadow: 0 0 0 3px rgba(78,122,255,0.14);
        }
        .field-input::placeholder { color: #475569; }

        .eye-btn {
          position: absolute;
          right: 12px; top: 50%;
          transform: translateY(-50%);
          background: none; border: none;
          cursor: pointer; color: #475569;
          display: flex; align-items: center;
          padding: 2px;
          transition: color .15s;
        }
        .eye-btn:hover { color: #94a3b8; }

        .forgot-row {
          display: flex;
          justify-content: flex-end;
          margin-top: -8px;
          margin-bottom: 20px;
        }
        .forgot-link {
          font-size: 13px;
          color: #4e7aff;
          text-decoration: none;
          cursor: pointer;
          background: none; border: none;
          padding: 0; font-family: inherit;
        }
        .forgot-link:hover { text-decoration: underline; }

        .btn-signin {
          width: 100%;
          padding: 12px;
          background: #4e7aff;
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          transition: background .2s, transform .15s, box-shadow .2s;
          font-family: inherit;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }
        .btn-signin:hover:not(:disabled) {
          background: #3d6af0;
          box-shadow: 0 4px 16px rgba(78,122,255,0.35);
        }
        .btn-signin:disabled { opacity: .6; cursor: not-allowed; }
        .btn-signin.shake { animation: shake .5s ease; }

        .divider {
          display: flex; align-items: center; gap: 12px;
          margin: 20px 0;
        }
        .divider-line { flex: 1; height: 1px; background: rgba(255,255,255,0.08); }
        .divider-text { font-size: 12px; color: #475569; }

        .btn-demo {
          width: 100%;
          padding: 11px;
          background: transparent;
          color: #94a3b8;
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: border-color .2s, color .2s, background .2s;
          font-family: inherit;
        }
        .btn-demo:hover {
          border-color: rgba(78,122,255,0.4);
          color: #f1f5f9;
          background: rgba(78,122,255,0.06);
        }

        .demo-hint {
          margin-top: 10px;
          font-size: 12px;
          color: #475569;
          text-align: center;
        }

        .error-box {
          display: flex; align-items: center; gap: 8px;
          padding: 10px 12px;
          background: rgba(239,68,68,0.08);
          border: 1px solid rgba(239,68,68,0.2);
          border-radius: 8px;
          font-size: 13px;
          color: #f87171;
          margin-bottom: 16px;
        }

        .spinner {
          width: 16px; height: 16px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top: 2px solid white;
          border-radius: 50%;
          animation: spin .7s linear infinite;
        }

        .right-panel {
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          text-align: center;
          padding: 80px 80px;
          background: #0a0b0f;
          position: relative;
          overflow: hidden;
        }

        .right-panel::before {
          content: '';
          position: absolute;
          width: 600px; height: 600px;
          background: radial-gradient(circle, rgba(30,58,120,0.18) 0%, transparent 70%);
          top: -100px; right: -200px;
          pointer-events: none;
        }
        .right-panel::after {
          content: '';
          position: absolute;
          width: 400px; height: 400px;
          background: radial-gradient(circle, rgba(16,30,80,0.15) 0%, transparent 70%);
          bottom: -80px; left: 20px;
          pointer-events: none;
        }

        .right-title {
          font-size: 42px;
          font-weight: 700;
          color: #f1f5f9;
          margin: 0 0 10px;
          letter-spacing: -0.03em;
          line-height: 1.1;
          position: relative; z-index: 1;
        }
        .right-subtitle {
          font-size: 15px;
          color: #475569;
          margin: 0 0 80px;
          position: relative; z-index: 1;
        }

        .counter-label {
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.14em;
          color: #334155;
          text-transform: uppercase;
          margin-bottom: 12px;
          position: relative; z-index: 1;
        }

        .counter-value {
          font-size: 72px;
          font-weight: 700;
          color: #334155;
          letter-spacing: -0.04em;
          line-height: 1;
          margin-bottom: 60px;
          position: relative; z-index: 1;
          transition: color .3s;
          font-variant-numeric: tabular-nums;
        }
        .counter-value.active { color: #475569; }

        .log-list {
          list-style: none;
          padding: 0; margin: 0 auto;
          position: relative; z-index: 1;
          width: 100%;
          max-width: 420px;
        }
        .log-item {
          font-size: 12px;
          color: #334155;
          padding: 3px 0;
          font-family: 'SFMono-Regular', 'Fira Code', 'Consolas', monospace;
          animation: logSlide .4s ease both;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .log-item::before {
          content: '›';
          margin-right: 8px;
          color: #1e3a5f;
        }

        @media (max-width: 860px) {
          .login-root { flex-direction: column; }
          .left-panel { width: 100%; min-width: unset; border-right: none; }
          .right-panel { padding: 40px 40px; }
          .right-title { font-size: 32px; }
          .counter-value { font-size: 52px; }
        }
      `}</style>

      <div className="login-root">
        <div className="left-panel">
          <div className="brand-row">
            <img src="/favicon.jpg" alt="RevAI" style={{ width: 40, height: 40, borderRadius: 10, objectFit: 'cover' }} />
          </div>

          <div className="form-wrap">
            <h1 className="form-title">Welcome back</h1>
            <p className="form-subtitle">Sign in to your RevAI account.</p>

            {error && (
              <div className="error-box">
                <AlertCircle size={14} style={{ flexShrink: 0 }} />
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate>
              <div className="field-wrap">
                <label className="field-label" htmlFor="login-email">Email</label>
                <input
                  id="login-email"
                  type="email"
                  className="field-input"
                  placeholder="you@company.com"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setError(''); }}
                  required
                  autoComplete="email"
                />
              </div>

              <div className="field-wrap">
                <label className="field-label" htmlFor="login-password">Password</label>
                <input
                  id="login-password"
                  type={showPass ? 'text' : 'password'}
                  className="field-input"
                  style={{ paddingRight: 42 }}
                  placeholder="••••••••"
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(''); }}
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="eye-btn"
                  onClick={() => setShowPass(p => !p)}
                  aria-label={showPass ? 'Hide password' : 'Show password'}
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              <div className="forgot-row">
                <button type="button" className="forgot-link">Forgot password?</button>
              </div>

              <button
                id="login-submit"
                type="submit"
                className={`btn-signin${shake ? ' shake' : ''}`}
                disabled={loading}
              >
                {loading ? <><div className="spinner" /> Signing in…</> : 'Sign in'}
              </button>
            </form>

            <div className="divider">
              <div className="divider-line" />
              <span className="divider-text">or</span>
              <div className="divider-line" />
            </div>

            <button id="login-demo" type="button" className="btn-demo" onClick={handleDemo}>
              Continue with demo account
            </button>
            <p className="demo-hint">No signup needed — explore with sample data.</p>
          </div>
        </div>

        <div className="right-panel">
          <img src="/favicon.jpg" alt="RevAI" style={{ width: 80, height: 80, borderRadius: 18, objectFit: 'cover', marginBottom: 20 }} />
          <p className="right-subtitle">Find revenue that&apos;s slipping away and win it back.</p>

          <p className="counter-label">Revenue Recovered — Live</p>
          <div className={`counter-value${dataLoaded ? ' active' : ''}`}>
            {formatINR(animatedValue)}
          </div>

          <ul className="log-list">
            {logs.map((entry, i) => (
              <li key={`${entry}-${i}`} className="log-item">{entry}</li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}

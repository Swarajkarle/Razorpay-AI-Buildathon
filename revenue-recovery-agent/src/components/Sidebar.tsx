'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { FileSearch, Settings, PlayCircle, Home, Shield, LogOut, User } from 'lucide-react';
import { useEffect, useState } from 'react';

const SESSION_KEY = 'rra_session';

const navItems = [
  { href: '/', icon: Home, label: 'Dashboard' },
  { href: '/cases', icon: FileSearch, label: 'Cases' },
  { href: '/batch', icon: PlayCircle, label: 'Run Batch' },
  { href: '/settings', icon: Settings, label: 'Settings & Rules' },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        setUserEmail(parsed.email ?? null);
      }
    } catch {
      // ignore
    }
  }, []);

  const handleLogout = () => {
    sessionStorage.removeItem(SESSION_KEY);
    router.push('/login');
  };

  return (
    <aside style={{
      position: 'fixed',
      left: 0, top: 0, bottom: 0,
      width: '240px',
      background: '#0d0f14',
      borderRight: '1px solid #1a2030',
      backdropFilter: 'blur(20px)',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 100,
      padding: '0 12px',
    }}>
      {/* Logo */}
      <div style={{ padding: '16px 4px 14px', borderBottom: '1px solid #1a2030', display: 'flex', alignItems: 'center', gap: 10 }}>
        <img
          src="/favicon.jpg"
          alt="RevAI"
          style={{ width: 40, height: 40, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }}
        />
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9', lineHeight: 1.2 }}>RevAI</div>
          <div style={{ fontSize: 10, color: '#475569', marginTop: 1 }}>Revenue Recovery Agent</div>
        </div>
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, padding: '12px 0', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {navItems.map(({ href, icon: Icon, label }) => {
          const isActive = pathname === href || (href !== '/' && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={`nav-link${isActive ? ' active' : ''}`}
            >
              <Icon size={16} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div style={{ padding: '12px 4px 20px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 8 }}>

        {/* Compliance badge */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 12px',
          background: 'rgba(16, 185, 129, 0.08)',
          border: '1px solid rgba(16, 185, 129, 0.2)',
          borderRadius: 8,
        }}>
          <Shield size={14} color="#10b981" />
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#10b981' }}>Compliant Mode</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>DND · Quiet Hours · Max Attempts</div>
          </div>
        </div>

        {/* User + Logout */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 12px',
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid var(--border)',
          borderRadius: 8,
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <User size={13} color="white" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {userEmail ?? 'admin@razorpay.com'}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>Administrator</div>
          </div>
          <button
            id="sidebar-logout"
            onClick={handleLogout}
            title="Sign out"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '4px', borderRadius: 6, display: 'flex', alignItems: 'center',
              color: 'var(--text-muted)',
              transition: 'color 0.15s, background 0.15s',
              flexShrink: 0,
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.color = '#ef4444';
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.1)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)';
              (e.currentTarget as HTMLButtonElement).style.background = 'none';
            }}
          >
            <LogOut size={14} />
          </button>
        </div>

      </div>
    </aside>
  );
}


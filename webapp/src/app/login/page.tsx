'use client';
import React, { useState } from 'react';
import { Icon } from '@/components/icons';

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || '';

/** Only allow same-app relative paths as the post-login destination. */
function nextPath(): string {
  const n = new URLSearchParams(window.location.search).get('next') || '/';
  return n.startsWith('/') && !n.startsWith('//') ? n : '/';
}

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const r = await fetch(`${BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      if (r.ok) { window.location.assign(`${BASE}${nextPath()}`); return; }
      const j = await r.json().catch(() => ({}));
      setError(j.error || 'Sign-in failed.');
    } catch {
      setError('Cannot reach the server.');
    }
    setBusy(false);
  }

  const field = 'w-full rounded-md border border-edge bg-canvas px-3 py-2 text-[13px] text-ink placeholder:text-ink-faint transition-colors duration-150 hover:border-edge-strong focus:border-accent focus:outline-none';

  return (
    <main className="min-h-screen flex items-center justify-center px-4 bg-canvas"
      style={{ backgroundImage: 'linear-gradient(var(--c-grid) 1px, transparent 1px), linear-gradient(90deg, var(--c-grid) 1px, transparent 1px)', backgroundSize: '32px 32px' }}>
      <div className="noc-page w-full max-w-[360px]">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-accent-soft border border-accent/30">
            <Icon.Activity size={20} className="text-accent" />
          </div>
          <div className="leading-tight">
            <div className="text-[17px] font-semibold text-ink tracking-tight">sFlow <span className="text-ink-dim font-normal">NOC</span></div>
            <div className="text-[11px] text-ink-faint font-mono">Bharat Data Center</div>
          </div>
        </div>

        <form onSubmit={submit} className="rounded-lg border border-edge bg-surface p-5 flex flex-col gap-4">
          <div>
            <h1 className="text-[15px] font-semibold text-ink">Sign in</h1>
            <p className="text-[12px] text-ink-faint mt-0.5">Restricted to NOC operators.</p>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-dim">Username</span>
            <input className={field} value={username} onChange={e => setUsername(e.target.value)}
              autoComplete="username" autoFocus required />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-dim">Password</span>
            <input className={field} type="password" value={password} onChange={e => setPassword(e.target.value)}
              autoComplete="current-password" required />
          </label>

          {error && (
            <div role="alert" className="flex items-center gap-2 rounded-md border px-3 py-2 text-[12px]"
              style={{ color: 'var(--c-crit)', borderColor: 'rgba(242,73,92,0.35)', background: 'rgba(242,73,92,0.08)' }}>
              <Icon.Alert size={14} className="shrink-0" />{error}
            </div>
          )}

          <button type="submit" disabled={busy}
            className="mt-1 rounded-md bg-accent px-3 py-2 text-[13px] font-semibold text-[#0b0d11] transition-opacity duration-150 hover:opacity-90 disabled:opacity-60">
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="mt-4 text-center text-[10.5px] font-mono text-ink-faint">Sessions expire after 12 hours</p>
      </div>
    </main>
  );
}

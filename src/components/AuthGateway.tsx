'use client';

import { useState, KeyboardEvent } from 'react';
import { useAppStore } from '@/store/useAppStore';

export default function AuthGateway({ children }: { children: React.ReactNode }) {
  const { authenticated, login } = useAppStore();
  const [pw, setPw] = useState('');
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);

  if (authenticated) return <>{children}</>;

  const handleSubmit = () => {
    if (login(pw)) {
      setError(false);
    } else {
      setError(true);
      setShake(true);
      setTimeout(() => setShake(false), 500);
    }
  };

  const handleKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter') handleSubmit();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0a0a0a]">
      {/* ambient glow */}
      <div className="absolute w-[500px] h-[500px] rounded-full bg-indigo-600/10 blur-[120px] pointer-events-none" />

      <div
        className={`relative z-10 flex flex-col items-center gap-6 p-10 rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl shadow-2xl ${
          shake ? 'animate-shake' : ''
        }`}
      >
        {/* logo mark */}
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <line x1="12" y1="2" x2="12" y2="6" />
            <line x1="12" y1="18" x2="12" y2="22" />
            <line x1="2" y1="12" x2="6" y2="12" />
            <line x1="18" y1="12" x2="22" y2="12" />
            <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" />
            <line x1="16.24" y1="16.24" x2="19.07" y2="19.07" />
            <line x1="4.93" y1="19.07" x2="7.76" y2="16.24" />
            <line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />
          </svg>
        </div>

        <div className="text-center">
          <h1 className="text-2xl font-bold text-white tracking-tight">Tinker</h1>
          <p className="text-sm text-white/40 mt-1">Enter password to continue</p>
        </div>

        <input
          type="password"
          value={pw}
          onChange={(e) => { setPw(e.target.value); setError(false); }}
          onKeyDown={handleKey}
          placeholder="Password"
          autoFocus
          className="w-64 px-4 py-2.5 rounded-xl bg-white/[0.06] border border-white/10 text-white
            placeholder:text-white/25 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50
            focus:border-indigo-500/50 transition-all"
        />

        {error && (
          <p className="text-xs text-red-400 -mt-3">Incorrect password</p>
        )}

        <button
          onClick={handleSubmit}
          className="w-64 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm
            font-medium transition-colors shadow-lg shadow-indigo-600/20"
        >
          Unlock
        </button>
      </div>
    </div>
  );
}

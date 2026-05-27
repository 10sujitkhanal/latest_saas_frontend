'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

function VerifyEmailContent() {
  const params = useSearchParams();
  const token = params.get('token');
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Invalid or missing verification token.');
      return;
    }
    // Org tenants don't yet have a public verify-email endpoint; orgs are
    // provisioned by the agency. Show a friendly message so the user knows
    // what to do next.
    setStatus('success');
    setMessage('Your organization account is provisioned by your agency — no email verification is required.');
  }, [token]);

  return (
    <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-10 shadow-2xl text-center">
      {status === 'loading' && (
        <div className="animate-pulse">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400 text-sm">Verifying…</p>
        </div>
      )}

      {status === 'success' && (
        <>
          <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-emerald-500/30">
            <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">You're all set</h2>
          <p className="text-sm text-slate-400 mb-8">{message}</p>
          <Link
            href="/auth/login"
            className="inline-block w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
          >
            Continue to Login
          </Link>
        </>
      )}

      {status === 'error' && (
        <>
          <h2 className="text-2xl font-bold text-white mb-3">Verification problem</h2>
          <p className="text-sm text-slate-400 mb-8">{message}</p>
          <Link href="/auth/login" className="inline-block w-full bg-slate-800 hover:bg-slate-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors">
            Back to Login
          </Link>
        </>
      )}
    </div>
  );
}

export default function VerifyEmail() {
  return (
    <div className="min-h-screen bg-[#030712] flex items-center justify-center p-4">
      <Suspense fallback={<div className="text-slate-400 text-sm">Loading…</div>}>
        <VerifyEmailContent />
      </Suspense>
    </div>
  );
}

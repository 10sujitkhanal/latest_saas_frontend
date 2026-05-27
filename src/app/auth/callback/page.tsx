'use client';

import { useEffect } from 'react';

export default function AuthCallback() {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash;
      if (hash && window.opener) {
        window.opener.postMessage(hash, window.location.origin);
        window.close();
      }
    }
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#030712] text-slate-400 text-sm font-medium">
      Completing authentication, please wait…
    </div>
  );
}

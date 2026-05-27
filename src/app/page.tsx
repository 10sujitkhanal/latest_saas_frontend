'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getAuthToken } from '@/lib/storage';

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    const token = getAuthToken('access');
    router.replace(token ? '/dashboard' : '/auth/login');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#030712]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 rounded-full border-4 border-slate-700 border-t-emerald-500 animate-spin" />
        <span className="text-sm font-bold text-slate-500">Redirecting…</span>
      </div>
    </div>
  );
}

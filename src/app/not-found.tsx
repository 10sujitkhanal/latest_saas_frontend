import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#030712] p-4">
      <div className="max-w-md w-full rounded-2xl bg-slate-900/80 border border-white/10 p-8 text-center shadow-2xl">
        <div className="text-5xl font-bold text-emerald-400">404</div>
        <h1 className="mt-3 text-xl font-bold text-white">Page not found</h1>
        <p className="text-sm text-slate-400 mt-2">The page you’re looking for doesn’t exist or has moved.</p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <Link href="/" className="rounded-full bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-semibold px-5 py-2.5">Go to homepage</Link>
          <a href="/auth/login" className="rounded-full border border-white/15 hover:bg-white/[0.06] text-slate-200 text-sm font-semibold px-5 py-2.5">Sign in</a>
        </div>
      </div>
    </div>
  );
}

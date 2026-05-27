'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Mail, Lock, ArrowRight } from 'lucide-react';
import { OrganizationService } from '@/services/organization.service';
import { useAuthStore } from '@/store/authStore';
import { getAuthToken } from '@/lib/storage';

const schema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});
type FormValues = z.infer<typeof schema>;

export default function OrgLoginPage() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const [globalError, setGlobalError] = useState('');

  useEffect(() => {
    if (getAuthToken('access')) router.replace('/dashboard');
  }, [router]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (form: FormValues) => {
    setGlobalError('');
    try {
      const res = await OrganizationService.login(form.email, form.password);
      if (res?.success && res.data?.access) {
        login(res.data.access, res.data.refresh, form.email);
        toast.success('Welcome back!');
        router.replace('/dashboard');
        return;
      }
      setGlobalError(res?.message || 'Login failed. Check your credentials.');
    } catch (err) {
      const v = err as { response?: { data?: { message?: string; detail?: string } } };
      setGlobalError(v.response?.data?.message ?? v.response?.data?.detail ?? 'Login failed.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#030712] p-4 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-[20%] left-[10%] w-[40%] h-[40%] rounded-full bg-emerald-600/10 blur-[120px]" />
        <div className="absolute bottom-[10%] right-[10%] w-[40%] h-[40%] rounded-full bg-sky-600/10 blur-[120px]" />
      </div>

      <div className="relative w-full max-w-md bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-2xl p-8 shadow-2xl shadow-emerald-500/10">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-500 to-sky-600 flex items-center justify-center font-bold text-white">
            M
          </div>
          <div>
            <h1 className="text-xl font-bold text-white leading-none">Sign in to your organization</h1>
            <p className="text-xs text-slate-400 mt-1">Use the credentials provided by your agency.</p>
          </div>
        </div>

        {globalError && (
          <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/40 text-red-300 text-sm">
            {globalError}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="email"
                {...register('email')}
                placeholder="you@yourorg.com"
                className={`w-full bg-slate-800/80 border ${errors.email ? 'border-red-500' : 'border-slate-700'} rounded-lg pl-10 pr-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all`}
              />
            </div>
            {errors.email && <p className="mt-1 text-sm text-red-400">{errors.email.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Password</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="password"
                {...register('password')}
                placeholder="••••••••"
                className={`w-full bg-slate-800/80 border ${errors.password ? 'border-red-500' : 'border-slate-700'} rounded-lg pl-10 pr-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all`}
              />
            </div>
            {errors.password && <p className="mt-1 text-sm text-red-400">{errors.password.message}</p>}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/20"
          >
            {isSubmitting ? 'Signing in…' : (
              <>
                Sign in <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-400">
          New here?{' '}
          <Link href="/" className="text-emerald-400 hover:text-emerald-300">
            Ask your agency to invite you
          </Link>
        </p>
      </div>
    </div>
  );
}

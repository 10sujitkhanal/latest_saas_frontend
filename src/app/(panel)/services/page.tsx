'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { Boxes, Check, Lock, ShieldCheck, ArrowRight, Layers, Menu as MenuIcon } from 'lucide-react';
import Topbar from '@/components/Topbar';
import { EmptyState } from '@/components/StateViews';
import { useAuthStore, type ServiceSummary } from '@/store/authStore';

export default function ServicesPage() {
  const services = useAuthStore((s) => s.services);

  const { owned, upgrade } = useMemo(() => {
    return {
      owned: services.filter((s) => s.is_owned),
      upgrade: services.filter((s) => !s.is_owned),
    };
  }, [services]);

  return (
    <>
      <Topbar
        title="Services"
        subtitle="Everything bundled in your plan — plus what you can unlock by upgrading."
        actions={
          <Link
            href="/subscription"
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold shadow-lg shadow-emerald-500/20 transition-colors"
          >
            Manage plan
            <ArrowRight className="w-4 h-4" />
          </Link>
        }
      />

      <main className="flex-1 px-6 lg:px-10 py-8 overflow-y-auto space-y-10">
        {services.length === 0 && (
          <EmptyState
            title="No services configured"
            description="Once your plan is active you'll see the services it includes here."
          />
        )}

        {/* ── Available Services ─────────────────────────────────────── */}
        {owned.length > 0 && (
          <section>
            <SectionHeader
              icon={<ShieldCheck className="w-4 h-4 text-emerald-300" />}
              kicker="Available services"
              title={`${owned.length} active`}
              subtitle="Included in your current subscription."
            />
            <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
              {owned.map((svc) => (
                <ServiceCard key={svc.id} svc={svc} />
              ))}
            </div>
          </section>
        )}

        {/* ── Upgrade Services ───────────────────────────────────────── */}
        {upgrade.length > 0 && (
          <section>
            <SectionHeader
              icon={<Lock className="w-4 h-4 text-amber-300" />}
              kicker="Upgrade services"
              title={`${upgrade.length} available`}
              subtitle="Add these to unlock more permissions and menus."
              accent="amber"
              cta={
                <Link
                  href="/subscription"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-200 text-xs font-semibold"
                >
                  See plans
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              }
            />
            <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
              {upgrade.map((svc) => (
                <ServiceCard key={svc.id} svc={svc} />
              ))}
            </div>
          </section>
        )}
      </main>
    </>
  );
}

function SectionHeader({
  icon,
  kicker,
  title,
  subtitle,
  accent = 'emerald',
  cta,
}: {
  icon: React.ReactNode;
  kicker: string;
  title: string;
  subtitle: string;
  accent?: 'emerald' | 'amber';
  cta?: React.ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-4 border-b border-white/5 pb-3">
      <div>
        <div className={`flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] font-bold ${accent === 'amber' ? 'text-amber-300' : 'text-emerald-300'}`}>
          {icon}
          {kicker}
        </div>
        <h2 className="mt-1 text-xl font-semibold text-white">{title}</h2>
        <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>
      </div>
      {cta}
    </div>
  );
}

function ServiceCard({ svc }: { svc: ServiceSummary }) {
  const isOwned = svc.is_owned;
  const monthly = svc.monthly_price ? parseFloat(svc.monthly_price) : null;
  const yearly = svc.yearly_price ? parseFloat(svc.yearly_price) : null;

  return (
    <div
      className={`rounded-2xl border p-5 ${
        isOwned ? 'border-white/5 bg-white/[0.02]' : 'border-amber-500/20 bg-amber-500/[0.03]'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
              isOwned ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300' : 'bg-amber-500/10 border-amber-500/20 text-amber-300'
            }`}
          >
            {isOwned ? <Boxes className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">{svc.name}</h3>
            <div className="text-[11px] uppercase tracking-wider text-slate-500 mt-0.5">
              {isOwned ? 'Active in your plan' : 'Upgrade to unlock'}
            </div>
          </div>
        </div>
        {monthly !== null && monthly > 0 && (
          <div className="text-right">
            <div className="text-sm font-bold text-white">${monthly.toFixed(0)}<span className="text-xs text-slate-500 font-normal">/mo</span></div>
            {yearly !== null && yearly > 0 && (
              <div className="text-[10px] text-slate-500">or ${yearly.toFixed(0)}/yr</div>
            )}
          </div>
        )}
      </div>

      {svc.description && (
        <p className="mt-3 text-sm text-slate-400 line-clamp-2">{svc.description}</p>
      )}

      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
        <Stat
          icon={<Layers className="w-3.5 h-3.5" />}
          label="Modules"
          value={svc.modules.length.toString()}
        />
        <Stat
          icon={<ShieldCheck className="w-3.5 h-3.5" />}
          label="Permissions"
          value={svc.permissions.length.toString()}
        />
      </div>

      {/* Permissions */}
      {svc.permissions.length > 0 && (
        <div className="mt-4">
          <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-2">Permissions</div>
          <ul className="space-y-1.5">
            {svc.permissions.map((p) => (
              <li key={p.code} className="flex items-start gap-2 text-sm">
                {isOwned ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                ) : (
                  <Lock className="w-3.5 h-3.5 text-slate-600 mt-0.5 shrink-0" />
                )}
                <div className="min-w-0">
                  <div className={isOwned ? 'text-slate-200' : 'text-slate-500'}>{p.label}</div>
                  <div className="text-[10px] font-mono text-slate-600">{p.code}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Menus */}
      {svc.menus.length > 0 && (
        <div className="mt-4">
          <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-2">Menus</div>
          <ul className="space-y-1.5">
            {svc.menus.map((m) => (
              <li key={m.code} className="flex items-center gap-2 text-sm">
                <MenuIcon className={`w-3.5 h-3.5 ${isOwned && m.visible ? 'text-emerald-400' : 'text-slate-600'}`} />
                {isOwned && m.visible ? (
                  <Link href={m.path} className="text-slate-200 hover:text-emerald-300 truncate">
                    {m.label} <span className="text-[10px] font-mono text-slate-600">{m.path}</span>
                  </Link>
                ) : (
                  <span className="text-slate-500 truncate">
                    {m.label} <span className="text-[10px] font-mono text-slate-600">{m.path}</span>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {!isOwned && (
        <Link
          href="/subscription"
          className="mt-5 inline-flex items-center justify-center gap-2 w-full px-3 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-bold transition-colors"
        >
          Upgrade plan to add {svc.name}
          <ArrowRight className="w-4 h-4" />
        </Link>
      )}
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/[0.03] border border-white/5 px-3 py-2">
      <div className="flex items-center gap-1.5 text-slate-500 uppercase tracking-wider text-[10px]">
        {icon}
        {label}
      </div>
      <div className="mt-0.5 text-base font-semibold text-white">{value}</div>
    </div>
  );
}

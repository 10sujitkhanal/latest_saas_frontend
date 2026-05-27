'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  MessageCircle, Phone, Clock, Calendar, Tag, Star, AlertTriangle,
  BookOpen, Sparkles, Wand2, Plus, Check,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageSkeleton } from '@/components/workspace/Skeleton';
import PermissionGuard from '@/components/workspace/PermissionGuard';
import { OrganizationService } from '@/services/organization.service';

/**
 * Recipe gallery — the 7 ready-made automations from the spec.
 *
 * Each card shows the prompt that will be installed, a one-click install
 * button, and a deep-link to the Workflows page where the user can tweak
 * the resulting Workflow with our prompt parser.
 */

interface Recipe { slug: string; title: string; description: string; prompt: string; icon: string; color: string; }

const ICONS: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  'message-circle': MessageCircle,
  'phone':          Phone,
  'clock':          Clock,
  'calendar':       Calendar,
  'tag':            Tag,
  'star':           Star,
  'alert-triangle': AlertTriangle,
};

export default function RecipesPage({ params }: { params: Promise<{ id: string }> }) {
  const [wsId, setWsId] = useState('');
  useEffect(() => { params.then((p) => setWsId(p.id)); }, [params]);
  if (!wsId) return null;
  return (
    <PermissionGuard required="crm.leads_edit" workspaceId={wsId} skeleton="grid">
      <RecipesInner />
    </PermissionGuard>
  );
}

function RecipesInner() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [installed, setInstalled] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await OrganizationService.listRecipes();
      if (res?.success) setRecipes(res.data);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const install = async (slug: string) => {
    const res = await OrganizationService.installRecipe(slug);
    if (res?.success) {
      toast.success(`Installed: ${res.data.name}`);
      setInstalled((s) => new Set([...s, slug]));
    } else {
      toast.error(res?.message || 'Install failed');
    }
  };

  if (loading) return <PageSkeleton kind="grid" />;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white inline-flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-emerald-300" />
            Recipe gallery
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            One-click automations from the spec — install and they fire on matching events immediately.
          </p>
        </div>
        <Link
          href="../workflows"
          className="px-3 py-2 rounded-lg bg-white/[0.04] border border-white/10 text-slate-200 text-xs font-medium inline-flex items-center gap-2 hover:bg-white/[0.08]"
        >
          <Wand2 className="w-3.5 h-3.5" /> Build your own with a prompt
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {recipes.map((r) => {
          const Icon = ICONS[r.icon] ?? Sparkles;
          const done = installed.has(r.slug);
          return (
            <article key={r.slug} className="rounded-2xl border border-white/5 bg-white/[0.02] p-4 flex flex-col">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${r.color}26`, color: r.color }}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-white truncate">{r.title}</h3>
                </div>
              </div>
              <p className="text-[12px] text-slate-400 line-clamp-3 flex-1">{r.description}</p>
              <div className="mt-3 p-2.5 rounded-lg bg-[#080e1c] border border-white/5">
                <p className="text-[11px] italic text-slate-500 line-clamp-2">"{r.prompt}"</p>
              </div>
              <button
                onClick={() => install(r.slug)}
                disabled={done}
                className={`mt-3 px-4 py-2 rounded-lg text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors ${
                  done ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                       : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                }`}
              >
                {done ? <><Check className="w-4 h-4" /> Installed</> : <><Plus className="w-4 h-4" /> Install</>}
              </button>
            </article>
          );
        })}
      </div>
    </div>
  );
}

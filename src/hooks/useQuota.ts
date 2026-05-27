'use client';

import { useEffect, useState } from 'react';
import { OrganizationService } from '@/services/organization.service';

/**
 * Quota status hook — lets a create button self-disable when the
 * tenant is at the plan cap.
 *
 *   const { atCap, used, cap, unlimited, loading } = useQuota('tasks');
 *   <button disabled={atCap || loading}>+ New task</button>
 *   {atCap && <UpgradePill quota="tasks" />}
 *
 * Caches the result in module scope for ~30s so multiple components
 * on the same page share one fetch. ``refresh()`` forces a refetch
 * after a successful mutation.
 */

export interface QuotaState {
  used: number;
  cap: number;
  unlimited: boolean;
  remaining: number | null;
  percent: number;
  over: boolean;
  atCap: boolean;
  loading: boolean;
  refresh: () => void;
}

type AllRows = Record<string, {
  label: string; used: number; cap: number;
  unlimited: boolean; remaining: number | null;
  percent: number; over: boolean;
}>;

let _cache: AllRows | null = null;
let _cacheAt = 0;
let _inflight: Promise<AllRows | null> | null = null;
const _subscribers = new Set<() => void>();

async function loadQuotas(force = false): Promise<AllRows | null> {
  const now = Date.now();
  if (!force && _cache && now - _cacheAt < 30_000) return _cache;
  if (_inflight) return _inflight;
  _inflight = (async () => {
    try {
      // The overview endpoint already bundles quotas — reuse it so the
      // analytics page and individual hooks share one round-trip.
      const res = await OrganizationService.analyticsOverview();
      if (res?.success) {
        _cache = (res.data?.sections?.quotas || {}) as AllRows;
        _cacheAt = Date.now();
      }
    } catch { /* leave _cache as-is */ }
    finally {
      _inflight = null;
      _subscribers.forEach((f) => f());
    }
    return _cache;
  })();
  return _inflight;
}

export function useQuota(key: string): QuotaState {
  const [, force] = useState(0);

  useEffect(() => {
    const sub = () => force((x) => x + 1);
    _subscribers.add(sub);
    loadQuotas();
    return () => { _subscribers.delete(sub); };
  }, []);

  const row = _cache?.[key];
  const loading = !_cache && _inflight !== null;
  if (!row) {
    return {
      used: 0, cap: -1, unlimited: true, remaining: null,
      percent: 0, over: false, atCap: false, loading,
      refresh: () => loadQuotas(true),
    };
  }
  const atCap = !row.unlimited && row.used >= row.cap;
  return {
    used: row.used,
    cap: row.cap,
    unlimited: row.unlimited,
    remaining: row.remaining,
    percent: row.percent,
    over: row.over,
    atCap,
    loading: false,
    refresh: () => loadQuotas(true),
  };
}

/** Force refresh — call after a successful POST so the next button
 *  click reflects the new count. */
export function refreshQuotas() {
  return loadQuotas(true);
}

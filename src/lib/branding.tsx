'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

export interface BrandingData {
  name: string;
  logo: string | null;
  favicon: string | null;
  brand_color: string;
  typography: string;
  is_agency: boolean;
  agency_id: number | null;
  agency_name: string | null;
  agency_slug: string | null;
  registered: boolean;
  tenant_schema: string | null;
  tenant_name: string | null;
}

const DEFAULT_BRANDING: BrandingData = {
  name: 'Merkoll',
  logo: null,
  favicon: null,
  brand_color: '#10b981',
  typography: 'Inter',
  is_agency: false,
  agency_id: null,
  agency_name: null,
  agency_slug: null,
  registered: false,
  tenant_schema: null,
  tenant_name: null,
};

const BrandingContext = createContext<BrandingData>(DEFAULT_BRANDING);

// Branding lookup is the one endpoint that MUST hit the apex API
// (``api.morefungi.com``), not the per-tenant API
// (``<tenant>.api.morefungi.com``). Reason: branding is what tells us
// "this hostname belongs to tenant X" -- calling the per-tenant API
// before we know which tenant we are is a chicken-and-egg. The apex
// API runs in the public schema where the Domain → Tenant lookup
// lives. Every OTHER service call uses ``resolveApiBase()`` which
// IS per-tenant.
import { resolveApexApiBase } from './apiBase';

function getApiBase(): string {
  return resolveApexApiBase();
}

function absoluteUrl(maybeRelative: string | null, apiBase: string): string | null {
  if (!maybeRelative) return null;
  if (/^https?:\/\//i.test(maybeRelative)) return maybeRelative;
  return `${apiBase}${maybeRelative.startsWith('/') ? '' : '/'}${maybeRelative}`;
}

export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const [branding, setBranding] = useState<BrandingData>(DEFAULT_BRANDING);

  useEffect(() => {
    const host = window.location.hostname;
    const apiBase = getApiBase();
    let cancelled = false;
    fetch(`${apiBase}/api/v1/public/tenant/branding/?domain=${encodeURIComponent(host)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        if (cancelled || !body?.success || !body.data) return;
        const data: BrandingData = {
          ...body.data,
          logo: absoluteUrl(body.data.logo, apiBase),
          favicon: absoluteUrl(body.data.favicon, apiBase),
        };
        setBranding(data);
        applyBranding(data);
      })
      .catch(() => {
        // branding is optional — fall back to defaults
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return <BrandingContext.Provider value={branding}>{children}</BrandingContext.Provider>;
}

/**
 * Robustly set the tab favicon. Browsers pick ONE of several icon links and
 * cache it hard, so just changing one href usually leaves a stale icon (and
 * Next renders its own). Remove every icon link and add fresh ones, with a
 * cache-bust so the browser re-fetches.
 */
export function setFavicon(url: string) {
  if (!url || typeof document === 'undefined') return;
  document.querySelectorAll("link[rel~='icon'], link[rel='shortcut icon'], link[rel='apple-touch-icon']").forEach((l) => l.remove());
  const href = `${url}${url.includes('?') ? '&' : '?'}v=${Date.now()}`;
  for (const rel of ['icon', 'apple-touch-icon']) {
    const link = document.createElement('link');
    link.rel = rel;
    link.href = href;
    document.head.appendChild(link);
  }
}

function applyBranding(data: BrandingData) {
  if (data.brand_color) {
    document.documentElement.style.setProperty('--brand-primary', data.brand_color);
  }
  if (data.favicon) setFavicon(data.favicon);
  if (data.name) document.title = data.name;
}

export const useBranding = () => useContext(BrandingContext);

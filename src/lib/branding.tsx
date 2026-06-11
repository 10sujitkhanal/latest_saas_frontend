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
 * Set the tab favicon to the tenant's own icon.
 *
 * CRITICAL: this must NOT remove any existing `<link rel="icon">` nodes. Next's
 * metadata system renders and *reconciles* its own icon links in `<head>`; if we
 * `.remove()` them, React later tries to delete an already-detached node and
 * throws `Cannot read properties of null (reading 'removeChild')` in the
 * reconciler — which crashes client-side rendering (broken navigation, dead
 * workspace switcher, login redirect not firing). So we own ONE link per rel by
 * id and only ever UPDATE its href. Appended last + cache-busted, the browser
 * prefers it over Next's default, and React's nodes are never touched.
 */
export function setFavicon(url: string) {
  if (!url || typeof document === 'undefined') return;
  // Mixed-content guard: the per-tenant media host is reachable over http+https,
  // and /me sometimes returns an http:// favicon URL. On an https page the
  // browser BLOCKS an http favicon, so it never shows. Upgrade to https.
  let safe = url;
  if (typeof window !== 'undefined' && window.location.protocol === 'https:' && safe.startsWith('http://')) {
    safe = 'https://' + safe.slice('http://'.length);
  }
  const href = `${safe}${safe.includes('?') ? '&' : '?'}v=${Date.now()}`;
  for (const rel of ['icon', 'apple-touch-icon']) {
    const id = `tenant-fav-${rel}`;
    let link = document.getElementById(id) as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement('link');
      link.id = id;
      link.rel = rel;
      document.head.appendChild(link);
    }
    link.href = href;
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

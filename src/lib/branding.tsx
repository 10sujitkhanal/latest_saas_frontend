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

// Shared per-tenant API-base resolver — see ``lib/apiBase.ts`` for
// the routing rules (``<sub>.morefungi.com`` -> ``<sub>.api.morefungi.com``).
// Keeping the indirection so branding.tsx stays in lockstep with
// axios.ts: any future change to the host pattern lands in one
// place and propagates here automatically.
import { resolveApiBase } from './apiBase';

function getApiBase(): string {
  return resolveApiBase();
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

function applyBranding(data: BrandingData) {
  if (data.brand_color) {
    document.documentElement.style.setProperty('--brand-primary', data.brand_color);
  }
  if (data.favicon) {
    let link: HTMLLinkElement | null = document.querySelector("link[rel*='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'shortcut icon';
      document.getElementsByTagName('head')[0].appendChild(link);
    }
    link.href = data.favicon;
  }
  if (data.name) document.title = data.name;
}

export const useBranding = () => useContext(BrandingContext);

import axios from 'axios';
import { TokenManager } from './tokenManager';
import { resolveApiV1Base, resolveApiBase } from './apiBase';

/**
 * Multi-tenant deploy: each org lives on its own frontend subdomain
 * (e.g. ``messi.morefungi.com``) AND its own API subdomain
 * (``messi.api.morefungi.com``). Django's TenantMainMiddleware picks
 * the schema from the Host header. The ``resolveApiBase`` helper
 * derives the API host from the current frontend host at runtime so
 * one build serves every tenant.
 */

// Initial baseURL set at module load — fine for first paint. The
// axios interceptor below re-resolves on every request so a route
// transition to a different subdomain (rare but possible) still
// targets the right API.
export const apiClient = axios.create({
  baseURL: resolveApiV1Base(),
  headers: { 'Content-Type': 'application/json' },
});

// Re-resolve on every request — covers SPA navigations between
// subdomains and any case where ``window.location`` changes after
// the module-level call above.
apiClient.interceptors.request.use((config) => {
  config.baseURL = resolveApiV1Base();
  return config;
});

// Re-export for any caller that needs the bare API base (e.g. file
// uploads that build their own absolute URL).
export { resolveApiBase };

apiClient.interceptors.request.use((config) => {
  const token = TokenManager.getAccessToken();
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // ── HTTP 401 — refresh the access token and replay once. ───────────
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const refresh = TokenManager.getRefreshToken();
      if (refresh) {
        try {
          const { data } = await axios.post(
            `${apiClient.defaults.baseURL}/organization/auth/refresh/`,
            { refresh },
          );
          TokenManager.setTokens(data.access, data.refresh || refresh);
          originalRequest.headers.Authorization = `Bearer ${data.access}`;
          return apiClient(originalRequest);
        } catch (refreshErr) {
          TokenManager.clearTokens();
          if (typeof window !== 'undefined') {
            window.location.href = '/auth/login';
          }
          return Promise.reject(refreshErr);
        }
      } else {
        TokenManager.clearTokens();
      }
    }

    // ── HTTP 402 — plan quota exceeded. Show a single toast pointing
    // to /subscription so the user always knows why a create failed.
    // The backend returns a structured payload:
    //   { reason: 'quota_exceeded', quota: 'tasks', used, cap, message }
    // We only fire ONE toast per quota per minute to avoid spam when a
    // page makes several requests in parallel.
    if (error.response?.status === 402) {
      try {
        const payload = error.response.data?.data || error.response.data || {};
        const msg = error.response.data?.message || 'Plan cap reached — upgrade to add more.';
        const quotaKey = payload.quota || 'unknown';
        const w = window as unknown as { __quotaToastAt?: Record<string, number> };
        w.__quotaToastAt ??= {};
        const last = w.__quotaToastAt[quotaKey] || 0;
        const now = Date.now();
        if (now - last > 60_000) {
          w.__quotaToastAt[quotaKey] = now;
          // Read the auth store lazily so the axios module doesn't
          // pull React state on import (would break SSR / RSC).
          let isAdmin = false;
          try {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const { useAuthStore } = require('@/store/authStore');
            const state = useAuthStore.getState();
            isAdmin = state?.user?.role === 'ADMIN' || !!state?.permissionCodes?.includes('*');
          } catch { /* store not initialised yet — default to non-admin */ }

          // Lazy-load sonner so the axios module stays tree-shakeable.
          import('sonner').then(({ toast }) => {
            toast.error(msg, {
              description: isAdmin
                ? 'Visit Subscription to upgrade your plan.'
                : 'Ask your admin to upgrade the plan.',
              action: isAdmin
                ? {
                    label: 'Upgrade',
                    onClick: () => {
                      if (typeof window !== 'undefined') window.location.href = '/subscription';
                    },
                  }
                : undefined,
              duration: 8000,
            });
          }).catch(() => { /* toast lib unavailable — silently swallow */ });
        }
      } catch { /* never let the interceptor itself throw */ }
    }

    return Promise.reject(error);
  },
);

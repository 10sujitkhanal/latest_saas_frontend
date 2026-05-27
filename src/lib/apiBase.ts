/**
 * Per-tenant API-base resolver.
 *
 * Production domain layout:
 *    morefungi.com               -> SaaS landing page (apex)
 *    <tenant>.morefungi.com      -> tenant frontend
 *    api.morefungi.com           -> backend apex
 *    <tenant>.api.morefungi.com  -> backend per-tenant
 *
 * A page served at ``messi.morefungi.com`` must call its OWN tenant's
 * API at ``messi.api.morefungi.com``. We do this at runtime from the
 * browser's ``location.hostname`` so a single Next.js build serves
 * every tenant — no per-tenant env-baked URLs.
 *
 * The mapping is driven by two env vars (set in ``.env.production``):
 *    NEXT_PUBLIC_FRONTEND_APEX=morefungi.com
 *    NEXT_PUBLIC_API_APEX=api.morefungi.com
 *
 * Fallback chain (in order of preference):
 *   1. Computed per-tenant host (when both env vars + ``window`` available)
 *   2. ``NEXT_PUBLIC_API_BASE_URL``                  (fixed override)
 *   3. ``${window.protocol}//${hostname}:8000``       (dev — same host + port 8000)
 *   4. ``http://localhost:8000``                       (SSR / scripts)
 */

const FRONTEND_APEX = (process.env.NEXT_PUBLIC_FRONTEND_APEX || '').toLowerCase();
const API_APEX      = (process.env.NEXT_PUBLIC_API_APEX || '').toLowerCase();
const DEV_BACKEND_PORT = process.env.NEXT_PUBLIC_BACKEND_PORT || '8000';

/**
 * Compute the absolute base URL of the API the current page should
 * talk to. Does NOT include the ``/api/v1`` path — callers append
 * whatever they need (some hit ``/api/v1``, some hit ``/admin/``).
 *
 * Pure function — no side effects, safe to call from anywhere.
 * Re-evaluated on every call so we always reflect the current host
 * (matters in Next.js client transitions / route changes).
 */
export function resolveApiBase(): string {
  if (typeof window !== 'undefined' && FRONTEND_APEX && API_APEX) {
    const host = window.location.hostname.toLowerCase();
    const proto = window.location.protocol === 'http:' ? 'http:' : 'https:';

    // Exact apex match → call the API apex.
    if (host === FRONTEND_APEX) {
      return `${proto}//${API_APEX}`;
    }
    // ``<sub>.<apex>`` → call ``<sub>.<api_apex>``.
    if (host.endsWith(`.${FRONTEND_APEX}`)) {
      const sub = host.slice(0, -FRONTEND_APEX.length - 1);
      const tenant = sub.split('.')[0];
      // Reserved subdomains -- these aren't tenant slugs, they're
      // platform-level hosts (the agency portal, www redirect, the
      // API itself). Route them to the API apex, not ``<sub>.api…``
      // which doesn't exist as a tenant API.
      const RESERVED = new Set(['agency', 'www', 'api', 'admin', 'static']);
      if (RESERVED.has(tenant)) {
        return `${proto}//${API_APEX}`;
      }
      return `${proto}//${tenant}.${API_APEX}`;
    }
    // Falls through — e.g. preview deploy, localhost-tunnel, custom
    // domain — handled by the env override below.
  }

  if (process.env.NEXT_PUBLIC_API_BASE_URL) {
    return process.env.NEXT_PUBLIC_API_BASE_URL.replace(/\/$/, '');
  }

  if (typeof window !== 'undefined') {
    // Dev convenience: backend on same host, port 8000.
    return `${window.location.protocol}//${window.location.hostname}:${DEV_BACKEND_PORT}`;
  }

  return `http://localhost:${DEV_BACKEND_PORT}`;
}

/**
 * Same as ``resolveApiBase()`` but appends ``/api/v1`` for the
 * places that always hit DRF endpoints (the axios client uses this).
 */
export function resolveApiV1Base(): string {
  return `${resolveApiBase()}/api/v1`;
}


/**
 * Always returns the APEX API host -- never the per-tenant one.
 * Used for bootstrap endpoints like
 * ``/api/v1/public/tenant/branding/`` which run BEFORE we know which
 * tenant we are. Calling those on ``<tenant>.api.morefungi.com``
 * creates a chicken-and-egg: django-tenants would route to the
 * tenant schema for a lookup whose job is to figure out the tenant.
 *
 * Resolution order:
 *   1. ``NEXT_PUBLIC_API_APEX``         (prod -- ``api.morefungi.com``)
 *   2. ``NEXT_PUBLIC_API_BASE_URL``      (explicit override)
 *   3. ``window.location.origin``        (last-resort, dev / preview)
 *   4. ``http://localhost:8000``         (SSR fallback)
 */
export function resolveApexApiBase(): string {
  if (API_APEX) {
    const proto = typeof window !== 'undefined' && window.location.protocol === 'http:' ? 'http:' : 'https:';
    return `${proto}//${API_APEX}`;
  }
  if (process.env.NEXT_PUBLIC_API_BASE_URL) {
    return process.env.NEXT_PUBLIC_API_BASE_URL.replace(/\/$/, '');
  }
  if (typeof window !== 'undefined') {
    return `${window.location.protocol}//${window.location.hostname}:${DEV_BACKEND_PORT}`;
  }
  return `http://localhost:${DEV_BACKEND_PORT}`;
}

import type { NextConfig } from "next";

/**
 * URL alias rewrites
 * ------------------
 * The workspace shell historically nested every CRM-adjacent page under
 * ``/w/<id>/leads/...`` (inbox, contacts, automation, recipes, ...)
 * even when the page was only tangentially related to the leads
 * dataset. We've since promoted those to their own top-level URLs --
 * ``/w/<id>/inbox``, ``/w/<id>/contacts``, ``/w/<id>/automation`` --
 * because the cleaner path tells you what's on the page rather than
 * which historical menu group it lived in.
 *
 * Rather than physically moving every ``app/(workspacepanel)/w/[id]/leads/<name>/``
 * folder (a 30-file rename with import-path churn), we use Next.js
 * URL rewrites to alias the new clean URLs to the existing file
 * locations. The browser sees ``/w/1/inbox``, Next.js renders the
 * file at ``app/(workspacepanel)/w/[id]/leads/inbox/page.tsx``.
 * Old bookmarks at ``/w/1/leads/inbox`` keep working because the
 * file still resolves there too.
 *
 * Only adds entries; does NOT change baseURL / images / anything else.
 */
const nextConfig: NextConfig = {
  // Tenants are served on subdomains (e.g. demo.localhost:3000). Next 16 blocks
  // cross-origin dev assets / server actions from origins other than the one the
  // dev server is bound to, which breaks hydration on tenant subdomains. Allow
  // every *.localhost tenant in dev so subdomain testing works.
  allowedDevOrigins: ['localhost', '*.localhost'],
  // Note: this Next build does NOT run ESLint during `next build` (the `eslint`
  // config key was removed in this version), so lint debt never blocks the build.
  // Linting is its own CI step; TypeScript type-checking remains a build gate.
  async rewrites() {
    return [
      // Inbox -- top-level instead of /leads/inbox.
      { source: '/w/:id/inbox',              destination: '/w/:id/leads/inbox' },
      { source: '/w/:id/inbox/:rest*',       destination: '/w/:id/leads/inbox/:rest*' },

      // Contacts -- a Contact is a person, not necessarily a lead.
      { source: '/w/:id/contacts',           destination: '/w/:id/leads/contacts' },
      { source: '/w/:id/contacts/:rest*',    destination: '/w/:id/leads/contacts/:rest*' },

      // Automation -- workflow / recipe pages are the automation
      // engine, not a leads-specific config screen.
      { source: '/w/:id/automation',                 destination: '/w/:id/leads/center' },
      { source: '/w/:id/automation/workflows',       destination: '/w/:id/leads/workflows' },
      { source: '/w/:id/automation/workflows/:rest*',destination: '/w/:id/leads/workflows/:rest*' },
      { source: '/w/:id/automation/recipes',         destination: '/w/:id/leads/recipes' },
      { source: '/w/:id/automation/recipes/:rest*',  destination: '/w/:id/leads/recipes/:rest*' },
    ];
  },
};

export default nextConfig;

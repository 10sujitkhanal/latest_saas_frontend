'use client';

/**
 * Legacy per-document detail page -- REMOVED.
 *
 * Document details (chunks, retrain, delete) are now shown in a POPUP
 * on the KB detail page (``/knowledge/kb/<kbId>``) instead of a
 * standalone route. This stub stays only so old bookmarks / links to
 * ``/knowledge/<docId>`` don't 404 -- it looks up which KB the doc
 * belongs to and redirects there (where the user can click the doc
 * row to open the popup).
 *
 * Falls back to the knowledge-base list if the doc can't be resolved.
 */

import { useEffect, use as reactUse } from 'react';
import { useRouter } from 'next/navigation';
import { OrganizationService } from '@/services/organization.service';
import { PageSkeleton } from '@/components/workspace/Skeleton';

export default function LegacyDocRedirect({ params }: {
  params: Promise<{ id: string; docId: string }>;
}) {
  const { id: wsId, docId } = reactUse(params);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await OrganizationService.kbGetDocument(Number(docId));
        if (cancelled) return;
        const kbId = res?.success ? res.data?.knowledge_base : null;
        // Redirect to the owning KB detail page (doc rows there open
        // the popup). If the doc has no KB, go to the list.
        router.replace(
          kbId
            ? `/w/${wsId}/knowledge/kb/${kbId}`
            : `/w/${wsId}/knowledge`,
        );
      } catch {
        if (!cancelled) router.replace(`/w/${wsId}/knowledge`);
      }
    })();
    return () => { cancelled = true; };
  }, [wsId, docId, router]);

  return <PageSkeleton />;
}

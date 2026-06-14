'use client';

import { useEffect, use as reactUse } from 'react';
import { useRouter } from 'next/navigation';
import { PageSkeleton } from '@/components/workspace/Skeleton';

/**
 * The SEO agent now lives as a card in AI Staff (consistent with every other
 * agent), so the old standalone cockpit is retired — bounce to AI Staff where
 * the SEO agent + its audit/composer live. Business Profile and Reviews remain
 * as their own pages under /seo.
 */
export default function SeoCockpitRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = reactUse(params);
  const router = useRouter();
  useEffect(() => { router.replace(`/w/${id}/ai-staff`); }, [id, router]);
  return <PageSkeleton kind="list" />;
}

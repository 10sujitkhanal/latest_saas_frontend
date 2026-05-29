import { redirect } from 'next/navigation';

/**
 * Compatibility redirect: ``/w/<id>/credentials`` -> ``/w/<id>/leads/credentials``.
 *
 * The Channels / Credentials page actually lives under the leads
 * sub-route, but older bookmarks, browser autocomplete, and any
 * stale link in user-pasted docs may still point at the shorter
 * top-level ``/credentials`` path. Without this stub Next.js
 * returns a 404. Doing a server-side ``redirect()`` (HTTP 307)
 * keeps the link working AND tells crawlers to update their cache.
 *
 * Next.js 15 awaits ``params`` -- this stub uses the typed shape.
 */
export default async function CredentialsRedirect(
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  redirect(`/w/${id}/leads/credentials`);
}

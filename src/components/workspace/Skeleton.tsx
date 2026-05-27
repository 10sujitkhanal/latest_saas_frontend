'use client';

/**
 * Loading skeletons.
 *
 * Three layers:
 *
 *   <Skeleton />               primitive — one shimmering block
 *   <SkeletonText lines={3} /> n stacked text-line skeletons
 *   <PageSkeleton kind="..." />  full-page layout placeholder per page type
 *
 * The shimmer is a single CSS animation defined inline — no Tailwind config
 * change required. Colors match the panel's dark theme.
 *
 * `<PageSkeleton>` accepts:
 *   - "kanban"     pipeline view (columns + cards)
 *   - "list"       table view (header + rows)
 *   - "detail"     entity detail (header + tabs + two-column blocks)
 *   - "grid"       card grid (sources/channels/pipelines/recipes)
 *   - "inbox"      split-pane (list + detail)
 *   - "dashboard"  KPI tiles + chart blocks
 *   - "form"       single-column form (workspace settings, edit lead)
 *   - "generic"    neutral fallback
 */

import React from 'react';

const SHIMMER = `linear-gradient(
  90deg,
  rgba(255, 255, 255, 0.02) 0%,
  rgba(255, 255, 255, 0.06) 50%,
  rgba(255, 255, 255, 0.02) 100%
)`;

const SHIMMER_STYLE: React.CSSProperties = {
  backgroundImage: SHIMMER,
  backgroundSize: '200% 100%',
  animation: 'merkollShimmer 1.4s ease-in-out infinite',
};

// Inject the @keyframes once per page.
function ShimmerStyles() {
  return (
    <style jsx global>{`
      @keyframes merkollShimmer {
        0%   { background-position: 200% 0; }
        100% { background-position: -200% 0; }
      }
    `}</style>
  );
}

// ----- Primitives --------------------------------------------------------

export function Skeleton({
  className = '',
  width,
  height,
  rounded = 'rounded-md',
  style,
}: {
  className?: string;
  width?: string | number;
  height?: string | number;
  rounded?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={`${rounded} bg-white/[0.03] ${className}`}
      style={{
        ...SHIMMER_STYLE,
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
        ...style,
      }}
    />
  );
}

export function SkeletonText({ lines = 3, className = '' }: { lines?: number; className?: string }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          height={10}
          width={i === lines - 1 ? '60%' : '100%'}
          rounded="rounded"
        />
      ))}
    </div>
  );
}

// ----- Composite blocks --------------------------------------------------

function HeaderBlock({ withChip = false }: { withChip?: boolean }) {
  return (
    <div className="mb-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <Skeleton height={28} width={200} className="mb-2" />
          <Skeleton height={12} width={320} />
          {withChip && <Skeleton height={20} width={120} className="mt-3" rounded="rounded-md" />}
        </div>
        <Skeleton height={36} width={140} rounded="rounded-lg" />
      </div>
    </div>
  );
}

function KanbanColumn() {
  return (
    <div className="w-72 shrink-0 rounded-2xl bg-white/[0.02] border border-white/5">
      <div className="px-4 py-3 border-b border-white/5">
        <div className="flex items-center gap-2">
          <Skeleton height={8} width={8} rounded="rounded-full" />
          <div className="flex-1">
            <Skeleton height={12} width={90} className="mb-1" />
            <Skeleton height={8} width={60} />
          </div>
          <Skeleton height={18} width={36} rounded="rounded" />
        </div>
      </div>
      <div className="p-2 space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-white/5 bg-[#0c1424] p-3">
            <div className="flex justify-between mb-2">
              <Skeleton height={12} width={120} />
              <Skeleton height={14} width={48} />
            </div>
            <Skeleton height={8} width={80} className="mb-2" />
            <Skeleton height={20} width={56} rounded="rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
}

function ListRow() {
  return (
    <tr className="border-t border-white/5">
      {Array.from({ length: 6 }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <Skeleton height={12} width={i === 0 ? 140 : i === 5 ? 60 : 90} />
        </td>
      ))}
    </tr>
  );
}

function CardTile() {
  return (
    <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
      <div className="flex items-center gap-3 mb-3">
        <Skeleton height={40} width={40} rounded="rounded-xl" />
        <div className="flex-1">
          <Skeleton height={12} width="60%" className="mb-2" />
          <Skeleton height={8} width="40%" />
        </div>
      </div>
      <SkeletonText lines={2} />
      <div className="mt-3 pt-3 border-t border-white/5">
        <Skeleton height={14} width={100} />
      </div>
    </div>
  );
}

function KPITile() {
  return (
    <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
      <div className="flex items-center justify-between mb-2">
        <Skeleton height={8} width={50} />
        <Skeleton height={28} width={28} rounded="rounded-lg" />
      </div>
      <Skeleton height={24} width={80} />
    </div>
  );
}

// ----- Full-page variants ------------------------------------------------

export function PageSkeleton({ kind = 'generic' }: { kind?: 'kanban' | 'list' | 'detail' | 'grid' | 'inbox' | 'dashboard' | 'form' | 'generic' }) {
  return (
    <div>
      <ShimmerStyles />
      <HeaderBlock withChip />

      {kind === 'kanban' && (
        <>
          <div className="mb-5 h-10 rounded-xl bg-white/[0.02] border border-white/5" />
          <div className="flex gap-4 overflow-x-hidden">
            {Array.from({ length: 5 }).map((_, i) => <KanbanColumn key={i} />)}
          </div>
        </>
      )}

      {kind === 'list' && (
        <>
          <Skeleton height={36} width={320} className="mb-4" rounded="rounded-lg" />
          <div className="rounded-2xl border border-white/5 bg-white/[0.02] overflow-hidden">
            <table className="w-full">
              <thead className="bg-white/[0.02] border-b border-white/5">
                <tr>
                  {Array.from({ length: 6 }).map((_, i) => (
                    <th key={i} className="text-left px-4 py-3">
                      <Skeleton height={8} width={60} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 8 }).map((_, i) => <ListRow key={i} />)}
              </tbody>
            </table>
          </div>
        </>
      )}

      {kind === 'detail' && (
        <>
          {/* Tabs */}
          <div className="mb-5 flex items-center gap-1 border-b border-white/5">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} height={32} width={100} className="mr-2 mb-0" rounded="rounded-md" />
            ))}
          </div>
          {/* Hero block */}
          <Skeleton height={80} className="mb-6" rounded="rounded-2xl" />
          {/* Two-column content */}
          <div className="grid grid-cols-1 lg:grid-cols-[1.4fr,1fr] gap-4">
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="rounded-2xl border border-white/5 bg-white/[0.02] p-5">
                  <Skeleton height={12} width={140} className="mb-3" />
                  <SkeletonText lines={4} />
                </div>
              ))}
            </div>
            <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5">
              <Skeleton height={12} width={120} className="mb-3" />
              <div className="space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <Skeleton height={10} width={80} />
                    <Skeleton height={10} width={60} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {kind === 'grid' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => <CardTile key={i} />)}
        </div>
      )}

      {kind === 'inbox' && (
        <>
          <div className="mb-3 flex gap-1.5">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} height={28} width={88} rounded="rounded-lg" />
            ))}
          </div>
          <div className="mb-4">
            <Skeleton height={36} width={320} rounded="rounded-lg" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-[1fr,1.4fr] gap-4">
            <div className="rounded-2xl border border-white/5 bg-white/[0.02]">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="p-3 border-b border-white/5 last:border-0 flex gap-3">
                  <Skeleton height={36} width={36} rounded="rounded-full" />
                  <div className="flex-1">
                    <Skeleton height={12} width="70%" className="mb-2" />
                    <Skeleton height={8} width="50%" className="mb-2" />
                    <Skeleton height={8} width="90%" />
                  </div>
                </div>
              ))}
            </div>
            <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5">
              <Skeleton height={14} width={180} className="mb-4" />
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} height={32} width={i % 2 ? '60%' : '80%'} rounded="rounded-2xl" />
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {kind === 'dashboard' && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            {Array.from({ length: 4 }).map((_, i) => <KPITile key={i} />)}
          </div>
          <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5 mb-6">
            <Skeleton height={14} width={160} className="mb-4" />
            <div className="flex items-end gap-3 h-40">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="flex-1" height={`${30 + (i * 11) % 70}%`} rounded="rounded-t-lg" />
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-white/5 bg-white/[0.02] p-5">
                <Skeleton height={12} width={120} className="mb-3" />
                <SkeletonText lines={5} />
              </div>
            ))}
          </div>
        </>
      )}

      {kind === 'form' && (
        <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5">
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i}>
                <Skeleton height={8} width={60} className="mb-2" />
                <Skeleton height={36} rounded="rounded-lg" />
              </div>
            ))}
          </div>
          <div className="mt-4">
            <Skeleton height={8} width={60} className="mb-2" />
            <Skeleton height={96} rounded="rounded-lg" />
          </div>
          <div className="mt-5 flex justify-end">
            <Skeleton height={36} width={120} rounded="rounded-lg" />
          </div>
        </div>
      )}

      {kind === 'generic' && (
        <div className="space-y-3">
          <Skeleton height={120} rounded="rounded-2xl" />
          <Skeleton height={200} rounded="rounded-2xl" />
        </div>
      )}
    </div>
  );
}

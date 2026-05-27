'use client';

import { useEffect, useState, use as reactUse } from 'react';
import PermissionGuard from '@/components/workspace/PermissionGuard';
import { FlowBuilder, type FlowBuilderProps } from '@/components/workflows/FlowBuilder';
import { OrganizationService } from '@/services/organization.service';
import { PageSkeleton } from '@/components/workspace/Skeleton';

export default function EditWorkflowBuilderPage({
  params,
}: { params: Promise<{ id: string; wfId: string }> }) {
  const { id: wsId, wfId } = reactUse(params);
  return (
    <PermissionGuard required="crm.leads_edit" workspaceId={wsId} skeleton="detail">
      <EditInner wsId={wsId} wfId={Number(wfId)} />
    </PermissionGuard>
  );
}

function EditInner({ wsId, wfId }: { wsId: string; wfId: number }) {
  const [initial, setInitial] = useState<FlowBuilderProps['initial'] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    OrganizationService.getWorkflow(wfId).then((res) => {
      if (res?.success) setInitial(res.data);
      else setError(res?.message || 'Could not load workflow');
    }).catch(() => setError('Could not load workflow'));
  }, [wfId]);

  if (error) {
    return (
      <div className="p-8 text-center">
        <div className="text-red-300 font-semibold mb-2">{error}</div>
      </div>
    );
  }
  if (!initial) return <PageSkeleton kind="detail" />;
  return <FlowBuilder wsId={wsId} workflowId={wfId} initial={initial} />;
}

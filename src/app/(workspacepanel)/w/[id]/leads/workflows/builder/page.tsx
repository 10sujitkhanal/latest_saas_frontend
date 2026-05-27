'use client';

import { use as reactUse } from 'react';
import PermissionGuard from '@/components/workspace/PermissionGuard';
import { FlowBuilder } from '@/components/workflows/FlowBuilder';

export default function NewWorkflowBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: wsId } = reactUse(params);
  return (
    <PermissionGuard required="crm.leads_edit" workspaceId={wsId} skeleton="detail">
      <FlowBuilder wsId={wsId} />
    </PermissionGuard>
  );
}

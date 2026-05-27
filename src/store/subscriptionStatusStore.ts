import { create } from 'zustand';

export interface SubscriptionSnapshot {
  active: boolean;
  status: string | null;
  planName: string | null;
  currentPeriodEnd: string | null;
}

interface SubscriptionStatusState extends SubscriptionSnapshot {
  set: (snap: SubscriptionSnapshot) => void;
  markActive: () => void;
}

export const useSubscriptionStatusStore = create<SubscriptionStatusState>((set) => ({
  active: true, // optimistic until /me/ tells us otherwise
  status: null,
  planName: null,
  currentPeriodEnd: null,
  set: (snap) => set(snap),
  markActive: () => set((s) => ({ ...s, active: true })),
}));

import { create } from 'zustand';
import { OrganizationService, type NotificationItem } from '@/services/organization.service';

interface NotificationsState {
  items: NotificationItem[];
  unread: number;
  loading: boolean;
  fetch: () => Promise<void>;
  markRead: (id: number) => Promise<void>;
  markAllRead: () => Promise<void>;
}

export const useNotificationsStore = create<NotificationsState>((set, get) => ({
  items: [],
  unread: 0,
  loading: false,
  fetch: async () => {
    set({ loading: true });
    try {
      const res = await OrganizationService.listNotifications();
      if (res.success && res.data) {
        set({
          items: res.data.notifications ?? [],
          unread: res.data.unread_count ?? 0,
          loading: false,
        });
      } else {
        set({ loading: false });
      }
    } catch {
      set({ loading: false });
    }
  },
  markRead: async (id) => {
    await OrganizationService.markNotificationRead(id);
    set({
      items: get().items.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
      unread: Math.max(0, get().unread - 1),
    });
  },
  markAllRead: async () => {
    await OrganizationService.markAllNotificationsRead();
    set({
      items: get().items.map((n) => ({ ...n, is_read: true })),
      unread: 0,
    });
  },
}));

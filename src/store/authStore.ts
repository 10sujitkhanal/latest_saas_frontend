import { create } from 'zustand';
import { TokenManager } from '@/lib/tokenManager';

export interface OrgUser {
  email: string;
  role?: 'ADMIN' | 'MEMBER';
}

export interface ServiceMenuItem {
  code: string;
  label: string;
  path: string;
  icon: string;
  sort_order: number;
  module_code: string;
  required_permission_code: string | null;
  visible: boolean;
}

export interface ServiceModule {
  code: string;
  name: string;
  icon: string;
}

export interface ServicePermission {
  code: string;
  label: string;
  description: string;
  module_code: string;
}

export interface ServiceSummary {
  id: number;
  code?: string;            // Stable slug from the backend (e.g. "crm")
  name: string;
  description: string;
  icon: string;
  monthly_price: string | null;
  yearly_price: string | null;
  is_owned: boolean;
  modules: ServiceModule[];
  permissions: ServicePermission[];
  menus: ServiceMenuItem[];
}

interface AuthState {
  isAuthenticated: boolean;
  user: OrgUser | null;
  permissionCodes: string[];
  services: ServiceSummary[];
  hydrated: boolean;
  // Current workspace context (set inside /w/<id>), so the top banner can show
  // the workspace name + the user's role for it. Null on the /w list.
  workspaceMeta: { id: number; name: string; role: string } | null;
  // The org's OWN business identity (OrganizationProfile) for the sidebar brand.
  business: { name: string; logo: string | null } | null;
  login: (access: string, refresh: string, email: string) => void;
  setUser: (user: OrgUser | null) => void;
  setPermissions: (codes: string[]) => void;
  setServices: (services: ServiceSummary[]) => void;
  setHydrated: (v: boolean) => void;
  setWorkspaceMeta: (m: { id: number; name: string; role: string } | null) => void;
  setBusiness: (b: { name: string; logo: string | null } | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: !!TokenManager.getAccessToken(),
  user: typeof window !== 'undefined' && TokenManager.getEmail()
    ? { email: TokenManager.getEmail()! }
    : null,
  permissionCodes: [],
  services: [],
  hydrated: false,
  workspaceMeta: null,
  business: null,
  login: (access, refresh, email) => {
    TokenManager.setTokens(access, refresh);
    TokenManager.setEmail(email);
    set({ isAuthenticated: true, user: { email } });
  },
  setUser: (user) => set({ user }),
  setPermissions: (codes) => set({ permissionCodes: codes }),
  setServices: (services) => set({ services }),
  setHydrated: (v) => set({ hydrated: v }),
  setWorkspaceMeta: (m) => set({ workspaceMeta: m }),
  setBusiness: (b) => set({ business: b }),
  logout: () => {
    TokenManager.clearTokens();
    // Reset ``hydrated`` so the next login waits for /me/ before the
    // <PermissionGuard> components decide anything — prevents a stale
    // wildcard from the previous session leaking through.
    set({ isAuthenticated: false, user: null, permissionCodes: [], services: [], hydrated: false, workspaceMeta: null, business: null });
  },
}));

export const hasPermission = (codes: string[] | undefined, code: string) =>
  !!codes && (codes.includes('*') || codes.includes(code));

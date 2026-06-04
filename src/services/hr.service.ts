import { apiClient } from '@/lib/axios';

export interface ApiEnvelope<T> {
  success: boolean;
  message?: string;
  data: T;
  errors?: Record<string, unknown>;
}

export interface DepartmentRow {
  id: number;
  name: string;
  description?: string;
  is_active: boolean;
  employee_count?: number;
}

export interface EmployeeRow {
  id: number;
  department?: number | null;
  department_name?: string | null;
  employee_no: string;
  first_name: string;
  last_name: string;
  full_name?: string;
  email?: string;
  phone?: string;
  role?: string;
  type: 'full_time' | 'part_time' | 'contract' | 'intern';
  status: 'active' | 'inactive' | 'on_leave' | 'terminated';
  hire_date: string;
  end_date?: string | null;
  basic_salary: string;
  currency: string;
  address?: string;
  notes?: string;
}

export interface AttendanceRow {
  id: number;
  employee: number;
  employee_name?: string | null;
  date: string;
  status: 'present' | 'absent' | 'late' | 'half_day' | 'holiday';
  check_in?: string | null;
  check_out?: string | null;
  hours: string;
  notes?: string;
}

export interface LeaveRow {
  id: number;
  employee: number;
  employee_name?: string | null;
  type: 'annual' | 'sick' | 'maternity' | 'paternity' | 'unpaid' | 'other';
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  start_date: string;
  end_date: string;
  days: string;
  reason?: string;
  approved_by?: string;
  approved_at?: string | null;
}

type Params = Record<string, unknown>;
type Payload = Record<string, unknown>;
type Id = string | number;

function base(workspaceId: Id) {
  return `/organization/hr/workspaces/${workspaceId}`;
}
async function g<T>(url: string, params?: Params) { const { data } = await apiClient.get<ApiEnvelope<T>>(url, { params }); return data; }
async function p<T>(url: string, payload: Payload = {}) { const { data } = await apiClient.post<ApiEnvelope<T>>(url, payload); return data; }
async function pa<T>(url: string, payload: Payload) { const { data } = await apiClient.patch<ApiEnvelope<T>>(url, payload); return data; }
async function d<T>(url: string) { const { data } = await apiClient.delete<ApiEnvelope<T>>(url); return data; }

function crud<T>(resource: string) {
  return {
    list: (ws: Id, params?: Params) => g<T[]>(`${base(ws)}/${resource}/`, params),
    get: (ws: Id, id: Id) => g<T>(`${base(ws)}/${resource}/${id}/`),
    create: (ws: Id, payload: Payload) => p<T>(`${base(ws)}/${resource}/`, payload),
    update: (ws: Id, id: Id, payload: Payload) => pa<T>(`${base(ws)}/${resource}/${id}/`, payload),
    remove: (ws: Id, id: Id) => d<null>(`${base(ws)}/${resource}/${id}/`),
  };
}

export const HRService = {
  departments: crud<DepartmentRow>('departments'),
  employees: crud<EmployeeRow>('employees'),
  attendance: crud<AttendanceRow>('attendance'),
  leave: {
    ...crud<LeaveRow>('leave'),
    decide: (ws: Id, id: Id, decision: 'approved' | 'rejected' | 'cancelled') =>
      p<LeaveRow>(`${base(ws)}/leave/${id}/decision/`, { decision }),
  },
};

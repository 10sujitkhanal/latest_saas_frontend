import {
  Users, Package, Tag, Banknote, Star, CalendarCheck, UsersRound, Megaphone, FolderKanban, type LucideIcon,
} from 'lucide-react';

/**
 * The agent module registry — one agent owns one module. ``built`` marks the
 * modules whose automation is live today (crm/store/offers); the rest own their
 * module + are trainable, with their work surface "coming soon". This is the
 * single source the AI Staff page + AgentShell read, and the menu the chatroom
 * will map commands onto.
 */
export type AgentModuleType = 'crm' | 'store' | 'offers' | 'finance' | 'loyalty' | 'bookings' | 'hr' | 'marketing' | 'projects';

export interface AgentModuleDef {
  type: AgentModuleType;
  label: string;
  module: string;
  Icon: LucideIcon;
  chip: string;
  badge: string;
  tasks: string[];
  built: boolean;
  /** Example prompts for the per-agent chat embedded in the card. */
  chatExamples?: string[];
}

export const AGENT_MODULES: Record<AgentModuleType, AgentModuleDef> = {
  crm: { type: 'crm', label: 'CRM', module: 'CRM & Leads', Icon: Users, chip: 'bg-emerald-50 text-emerald-600', badge: 'bg-emerald-50 text-emerald-700', built: true, tasks: ['Find leads', 'Score & prioritise', 'Draft outreach', 'Handle replies', 'Move pipeline stages'], chatExamples: ['Find gyms in Stockholm', 'Analyse my newest leads'] },
  store: { type: 'store', label: 'Store', module: 'Inventory & Store', Icon: Package, chip: 'bg-sky-50 text-sky-600', badge: 'bg-sky-50 text-sky-700', built: true, tasks: ['Build catalogue', 'Barcode lookup', 'Import from website', 'Suggest products', 'Draft listings'], chatExamples: ['Suggest a starter catalogue'] },
  offers: { type: 'offers', label: 'Offers', module: 'Offers & Deals', Icon: Tag, chip: 'bg-violet-50 text-violet-600', badge: 'bg-violet-50 text-violet-700', built: true, tasks: ['Draft promotions', 'Create coupons', 'Plan campaigns'], chatExamples: ['Draft a weekend 20% off deal'] },
  finance: { type: 'finance', label: 'Finance', module: 'Finance & Accounting', Icon: Banknote, chip: 'bg-amber-50 text-amber-600', badge: 'bg-amber-50 text-amber-700', built: true, tasks: ['Money summary', 'Spot overdue', 'Top debtors', 'Recurring billing', 'Cash advice'], chatExamples: ["Who's overdue?", 'How are my finances?', 'Bill jane@acme.com $50 a month'] },
  loyalty: { type: 'loyalty', label: 'Loyalty', module: 'Loyalty & Members', Icon: Star, chip: 'bg-pink-50 text-pink-600', badge: 'bg-pink-50 text-pink-700', built: true, tasks: ['Member health', 'Flag expiring', 'Best members', 'Retention advice'], chatExamples: ["How's my loyalty?", "Who's expiring soon?"] },
  bookings: { type: 'bookings', label: 'Bookings', module: 'Bookings', Icon: CalendarCheck, chip: 'bg-cyan-50 text-cyan-600', badge: 'bg-cyan-50 text-cyan-700', built: true, tasks: ['Today at a glance', 'Flag pending', 'Week ahead', 'Book a meeting', 'Prep advice'], chatExamples: ["What's coming up?", 'Book a meeting with name@email.com on 2026-06-20 at 3pm'] },
  hr: { type: 'hr', label: 'Staff', module: 'Staff & HR', Icon: UsersRound, chip: 'bg-indigo-50 text-indigo-600', badge: 'bg-indigo-50 text-indigo-700', built: false, tasks: ['Shift reminders', 'Onboarding', 'Leave requests', 'Reviews'] },
  marketing: { type: 'marketing', label: 'Marketing', module: 'Marketing', Icon: Megaphone, chip: 'bg-rose-50 text-rose-600', badge: 'bg-rose-50 text-rose-700', built: true, tasks: ['Draft posts', 'Seasonal ideas', 'On-brand copy', 'Product highlights'], chatExamples: ['Draft a post about winter wellness'] },
  projects: { type: 'projects', label: 'Projects', module: 'Projects', Icon: FolderKanban, chip: 'bg-slate-100 text-slate-600', badge: 'bg-slate-100 text-slate-700', built: false, tasks: ['Break down tasks', 'Status updates', 'Track deadlines', 'Summaries'] },
};

export const AGENT_MODULE_LIST: AgentModuleDef[] = Object.values(AGENT_MODULES);

export const agentModule = (t: string): AgentModuleDef => AGENT_MODULES[t as AgentModuleType] ?? AGENT_MODULES.crm;

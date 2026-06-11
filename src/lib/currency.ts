// Single source of truth for the business currency on the client.
// The value is set once from /organization/me (business.currency) and used by
// formatMoney() everywhere, plus as the default for create forms — so the whole
// UI shows one currency per business, matching the backend.
import { create } from 'zustand';
import { formatCurrencyMarket } from '@/lib/utils/currency';

export const CURRENCIES: { code: string; label: string }[] = [
  { code: 'SEK', label: 'Swedish Krona (kr)' },
  { code: 'EUR', label: 'Euro (€)' },
  { code: 'NOK', label: 'Norwegian Krone (kr)' },
  { code: 'DKK', label: 'Danish Krone (kr)' },
  { code: 'GBP', label: 'British Pound (£)' },
  { code: 'USD', label: 'US Dollar ($)' },
  { code: 'INR', label: 'Indian Rupee (₹)' },
  { code: 'NPR', label: 'Nepalese Rupee (Rs)' },
];

interface CurrencyState {
  currency: string;
  setCurrency: (c: string) => void;
}

export const useCurrencyStore = create<CurrencyState>((set) => ({
  currency: 'SEK',
  setCurrency: (currency) => set({ currency }),
}));

/** Populate the store from /me (call once after fetching the business). */
export function setBusinessCurrency(c?: string | null) {
  if (c && c !== useCurrencyStore.getState().currency) {
    useCurrencyStore.getState().setCurrency(c);
  }
}

/** Reactive hook for components: re-renders when the business currency changes. */
export function useBusinessCurrency(): string {
  return useCurrencyStore((s) => s.currency);
}

/** Non-hook accessor (forms, utils). */
export function businessCurrency(): string {
  return useCurrencyStore.getState().currency || 'SEK';
}

/**
 * Format an amount in the BUSINESS currency (the one chosen in Settings), or an
 * explicit one. Routes through the market formatter so a SEK business reads
 * "kr" everywhere — admin + storefront — never Intl's "SEK"/"Rs".
 */
export function formatMoney(amount: number | string | null | undefined, currency?: string): string {
  const n = typeof amount === 'string' ? parseFloat(amount) : (amount ?? 0);
  const val = Number.isFinite(n as number) ? (n as number) : 0;
  return formatCurrencyMarket(val, currency || businessCurrency());
}

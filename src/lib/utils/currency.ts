/**
 * Smart currency formatter — market-aware.
 * Reads CountryConfig to know symbol position, spacing, separators, decimal places.
 *
 * SEK  → "2 990 kr"     (suffix, space, space-thousands, 0 decimals)
 * NOK  → "1 299 kr"     (suffix, space, space-thousands, 0 decimals)
 * GBP  → "£14.99"       (prefix, no-space, comma-thousands, 2 decimals)
 * USD  → "$299.00"      (prefix, no-space, comma-thousands, 2 decimals)
 * EUR  → "49,99 €"      (suffix, space, space-thousands, 2 decimals) — Finnish style
 * NPR  → "NPR 299"      (prefix, space, no-symbol — uses code)
 * INR  → "₹2,999"       (prefix, no-space)
 */

import { getCountryByCurrency, type CountryConfig } from "@/lib/country/config";

// ─── Core formatter ───────────────────────────────────────────────────────────

export function formatCurrencyMarket(
  amount: number,
  currency: string,
  opts?: { showVatNote?: boolean; decimals?: number }
): string {
  const config = getCountryByCurrency(currency);
  if (!config) return fallbackFormat(amount, currency);

  let decimals = opts?.decimals ?? config.decimalDigits;
  // Never round away real cents: 0-decimal currencies (SEK/NOK) still show
  // decimals when the amount actually has a fractional part — so a 10.50 price
  // renders "10,50 kr", not a misleading "11 kr". Whole amounts stay clean.
  if (decimals === 0 && Math.abs(amount % 1) > 1e-9) decimals = 2;
  const formatted = applyConfig(amount, config, decimals);

  if (opts?.showVatNote && config.vat.inclusive) {
    return `${formatted} (${config.vat.displaySuffix})`;
  }
  return formatted;
}

/** Compact version: 1 499 kr / $1.5K / £2.1K */
export function formatCurrencyCompact(amount: number, currency: string): string {
  const config = getCountryByCurrency(currency);
  if (!config) return fallbackFormat(amount, currency);

  if (amount >= 1_000_000) {
    const n = (amount / 1_000_000).toFixed(1).replace(/\.0$/, "");
    return buildString(config, `${n}M`);
  }
  if (amount >= 1_000) {
    const n = (amount / 1_000).toFixed(1).replace(/\.0$/, "");
    return buildString(config, `${n}K`);
  }
  return applyConfig(amount, config, config.decimalDigits);
}

/** Returns just the symbol/code string for display (e.g. "kr", "$", "£") */
export function getCurrencySymbol(currency: string): string {
  const config = getCountryByCurrency(currency);
  return config?.currencySymbol ?? currency;
}

/** Returns "inkl. moms", "incl. 20% VAT", etc. for the currency's country */
export function getVatLabel(currency: string): string {
  const config = getCountryByCurrency(currency);
  return config?.vat.displaySuffix ?? "";
}

/** True if prices in this currency are tax-inclusive */
export function isPriceInclusive(currency: string): boolean {
  const config = getCountryByCurrency(currency);
  return config?.vat.inclusive ?? false;
}

// ─── Build Swish deep link ────────────────────────────────────────────────────

export function buildSwishLink(params: {
  payeeNumber: string;
  amount: number;
  message: string;
}): string {
  const msg = encodeURIComponent(params.message.slice(0, 50));
  return `swish://payment?payee=${params.payeeNumber}&amount=${params.amount}&message=${msg}&currency=SEK`;
}

// ─── Internals ────────────────────────────────────────────────────────────────

function applyConfig(amount: number, config: CountryConfig, decimals: number): string {
  const n = Number(amount);
  const safe = isFinite(n) ? n : 0;
  const parts = safe.toFixed(decimals).split(".");
  const intPart = formatWithSeparator(parts[0], config.thousandSep);
  const numStr = decimals > 0 && parts[1]
    ? `${intPart}${config.decimalSep}${parts[1]}`
    : intPart;
  return buildString(config, numStr);
}

function buildString(config: CountryConfig, numStr: string): string {
  const sym = config.currencySymbol;
  const sp = config.currencySpace ? " " : "";
  return config.currencyFormat === "suffix"
    ? `${numStr}${sp}${sym}`
    : `${sym}${sp}${numStr}`;
}

function formatWithSeparator(intStr: string, sep: string): string {
  if (!sep) return intStr;
  return intStr.replace(/\B(?=(\d{3})+(?!\d))/g, sep);
}

function fallbackFormat(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

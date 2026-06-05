/**
 * Country Intelligence Config
 *
 * Single source of truth for every market we operate in.
 * Adding a new country = add ONE entry here. Nothing else changes.
 *
 * Covers: currency format, VAT/tax, payment methods, key cities, locale.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type PaymentProvider =
  | "swish"     // Sweden
  | "vipps"     // Norway
  | "mobilepay" // Denmark / Finland
  | "stripe"    // Global cards
  | "paypal"    // Global
  | "esewa"     // Nepal
  | "khalti"    // Nepal
  | "upi"       // India
  | "mpesa"     // Kenya / East Africa
  | "promptpay" // Thailand
  | "cod";      // Cash on delivery (always available)

export interface CountryPaymentMethod {
  provider:        PaymentProvider;
  label:           string;
  description:     string;
  icon:            string;
  requiresKey:     boolean;
  keyLabel?:       string;
  keyPlaceholder?: string;
  keyType?:        "phone" | "api_key" | "merchant_code" | "publishable_key";
}

export interface VatConfig {
  standard:      number;    // % standard rate
  reduced:       number;    // % for food, accommodation etc.
  minimal?:      number;    // % for essentials, medicine
  label:         string;    // "moms" | "VAT" | "GST" | "MwSt" | "TVA"
  inclusive:     boolean;   // are displayed prices inc. tax?
  displaySuffix: string;    // "inkl. 25% moms" | "incl. 20% VAT"
}

export interface CountryConfig {
  code:              string;    // ISO 3166-1 alpha-2
  name:              string;
  nativeName:        string;    // name in local language
  flag:              string;    // emoji
  currency:          string;    // ISO 4217
  currencySymbol:    string;
  currencyFormat:    "prefix" | "suffix";
  currencySpace:     boolean;   // "100 kr" vs "£100"
  thousandSep:       string;    // " " | "," | "."
  decimalSep:        string;    // "," | "."
  decimalDigits:     number;    // 0 | 2
  vat:               VatConfig;
  paymentMethods:    CountryPaymentMethod[];
  languages:         string[];
  dateFormat:        string;    // "YYYY-MM-DD" | "DD/MM/YYYY" | "MM/DD/YYYY"
  phonePrefix:       string;
  timezone:          string;
  keyCities:         string[];
  region:            "europe" | "nordics" | "asia" | "americas" | "africa" | "oceania" | "middle_east";
  isEU:              boolean;
}

// ─── Payment method definitions (reusable) ────────────────────────────────────

const STRIPE: CountryPaymentMethod = {
  provider: "stripe", label: "Stripe (Cards)", icon: "💳",
  description: "Accept Visa, Mastercard, Amex worldwide.",
  requiresKey: true, keyLabel: "Stripe Publishable Key", keyType: "publishable_key",
  keyPlaceholder: "pk_live_...",
};

const PAYPAL: CountryPaymentMethod = {
  provider: "paypal", label: "PayPal", icon: "🅿️",
  description: "Accept PayPal payments globally.",
  requiresKey: true, keyLabel: "PayPal Client ID", keyType: "api_key",
  keyPlaceholder: "AY...",
};

const COD: CountryPaymentMethod = {
  provider: "cod", label: "Cash on Delivery", icon: "💵",
  description: "Customer pays on delivery or pickup.",
  requiresKey: false,
};

const SWISH: CountryPaymentMethod = {
  provider: "swish", label: "Swish", icon: "🟢",
  description: "Sweden's #1 mobile payment — instant bank transfer.",
  requiresKey: true, keyLabel: "Swish Number", keyType: "phone",
  keyPlaceholder: "0701234567",
};

const VIPPS: CountryPaymentMethod = {
  provider: "vipps", label: "Vipps", icon: "🟠",
  description: "Norway's leading mobile payment app.",
  requiresKey: true, keyLabel: "Vipps Merchant ID", keyType: "merchant_code",
  keyPlaceholder: "12345",
};

const MOBILEPAY: CountryPaymentMethod = {
  provider: "mobilepay", label: "MobilePay", icon: "🔵",
  description: "Denmark & Finland's mobile payment solution.",
  requiresKey: true, keyLabel: "MobilePay Merchant ID", keyType: "merchant_code",
  keyPlaceholder: "MERCHANT_123",
};

const ESEWA: CountryPaymentMethod = {
  provider: "esewa", label: "eSewa", icon: "🟢",
  description: "Nepal's most popular digital wallet.",
  requiresKey: true, keyLabel: "eSewa Merchant Code", keyType: "merchant_code",
  keyPlaceholder: "EPAYTEST",
};

const KHALTI: CountryPaymentMethod = {
  provider: "khalti", label: "Khalti", icon: "🟣",
  description: "Digital wallet & payment gateway for Nepal.",
  requiresKey: true, keyLabel: "Khalti Secret Key", keyType: "api_key",
  keyPlaceholder: "live_secret_key_...",
};

const UPI: CountryPaymentMethod = {
  provider: "upi", label: "UPI / PhonePe / GPay", icon: "🇮🇳",
  description: "Unified Payments Interface — India's instant payment system.",
  requiresKey: true, keyLabel: "UPI ID", keyType: "merchant_code",
  keyPlaceholder: "merchant@upi",
};

const MPESA: CountryPaymentMethod = {
  provider: "mpesa", label: "M-Pesa", icon: "📱",
  description: "Mobile money for Kenya and East Africa.",
  requiresKey: true, keyLabel: "M-Pesa Consumer Key", keyType: "api_key",
  keyPlaceholder: "consumer_key_...",
};

const PROMPTPAY: CountryPaymentMethod = {
  provider: "promptpay", label: "PromptPay", icon: "🇹🇭",
  description: "Thailand's national QR payment system.",
  requiresKey: true, keyLabel: "PromptPay ID", keyType: "phone",
  keyPlaceholder: "0812345678",
};

// ─── Country Registry ─────────────────────────────────────────────────────────

export const COUNTRY_CONFIGS: Record<string, CountryConfig> = {

  SE: {
    code: "SE", name: "Sweden", nativeName: "Sverige", flag: "🇸🇪",
    currency: "SEK", currencySymbol: "kr", currencyFormat: "suffix",
    currencySpace: true, thousandSep: " ", decimalSep: ",", decimalDigits: 0,
    vat: { standard: 25, reduced: 12, minimal: 6, label: "moms", inclusive: true, displaySuffix: "inkl. moms" },
    paymentMethods: [SWISH, STRIPE, PAYPAL, COD],
    languages: ["sv", "en"], dateFormat: "YYYY-MM-DD", phonePrefix: "+46",
    timezone: "Europe/Stockholm", region: "nordics", isEU: true,
    keyCities: ["Stockholm", "Gothenburg", "Malmö", "Uppsala", "Lund", "Linköping", "Örebro", "Västerås", "Helsingborg", "Norrköping"],
  },

  NO: {
    code: "NO", name: "Norway", nativeName: "Norge", flag: "🇳🇴",
    currency: "NOK", currencySymbol: "kr", currencyFormat: "suffix",
    currencySpace: true, thousandSep: " ", decimalSep: ",", decimalDigits: 0,
    vat: { standard: 25, reduced: 15, minimal: 12, label: "mva", inclusive: true, displaySuffix: "inkl. mva" },
    paymentMethods: [VIPPS, STRIPE, PAYPAL, COD],
    languages: ["no", "en"], dateFormat: "DD.MM.YYYY", phonePrefix: "+47",
    timezone: "Europe/Oslo", region: "nordics", isEU: false,
    keyCities: ["Oslo", "Bergen", "Trondheim", "Stavanger", "Drammen", "Tromsø", "Fredrikstad"],
  },

  DK: {
    code: "DK", name: "Denmark", nativeName: "Danmark", flag: "🇩🇰",
    currency: "DKK", currencySymbol: "kr.", currencyFormat: "suffix",
    currencySpace: true, thousandSep: ".", decimalSep: ",", decimalDigits: 0,
    vat: { standard: 25, reduced: 25, label: "moms", inclusive: true, displaySuffix: "inkl. moms" },
    paymentMethods: [MOBILEPAY, STRIPE, PAYPAL, COD],
    languages: ["da", "en"], dateFormat: "DD-MM-YYYY", phonePrefix: "+45",
    timezone: "Europe/Copenhagen", region: "nordics", isEU: true,
    keyCities: ["Copenhagen", "Aarhus", "Odense", "Aalborg", "Esbjerg", "Randers"],
  },

  FI: {
    code: "FI", name: "Finland", nativeName: "Suomi", flag: "🇫🇮",
    currency: "EUR", currencySymbol: "€", currencyFormat: "suffix",
    currencySpace: true, thousandSep: " ", decimalSep: ",", decimalDigits: 2,
    vat: { standard: 24, reduced: 14, minimal: 10, label: "ALV", inclusive: true, displaySuffix: "sis. ALV" },
    paymentMethods: [MOBILEPAY, STRIPE, PAYPAL, COD],
    languages: ["fi", "sv", "en"], dateFormat: "DD.MM.YYYY", phonePrefix: "+358",
    timezone: "Europe/Helsinki", region: "nordics", isEU: true,
    keyCities: ["Helsinki", "Espoo", "Tampere", "Vantaa", "Oulu", "Turku", "Jyväskylä"],
  },

  GB: {
    code: "GB", name: "United Kingdom", nativeName: "United Kingdom", flag: "🇬🇧",
    currency: "GBP", currencySymbol: "£", currencyFormat: "prefix",
    currencySpace: false, thousandSep: ",", decimalSep: ".", decimalDigits: 2,
    vat: { standard: 20, reduced: 5, minimal: 0, label: "VAT", inclusive: false, displaySuffix: "incl. 20% VAT" },
    paymentMethods: [STRIPE, PAYPAL, COD],
    languages: ["en"], dateFormat: "DD/MM/YYYY", phonePrefix: "+44",
    timezone: "Europe/London", region: "europe", isEU: false,
    keyCities: ["London", "Manchester", "Birmingham", "Leeds", "Glasgow", "Edinburgh", "Bristol", "Liverpool"],
  },

  DE: {
    code: "DE", name: "Germany", nativeName: "Deutschland", flag: "🇩🇪",
    currency: "EUR", currencySymbol: "€", currencyFormat: "suffix",
    currencySpace: true, thousandSep: ".", decimalSep: ",", decimalDigits: 2,
    vat: { standard: 19, reduced: 7, label: "MwSt", inclusive: true, displaySuffix: "inkl. 19% MwSt" },
    paymentMethods: [STRIPE, PAYPAL, COD],
    languages: ["de", "en"], dateFormat: "DD.MM.YYYY", phonePrefix: "+49",
    timezone: "Europe/Berlin", region: "europe", isEU: true,
    keyCities: ["Berlin", "Munich", "Hamburg", "Frankfurt", "Cologne", "Stuttgart", "Düsseldorf", "Leipzig"],
  },

  US: {
    code: "US", name: "United States", nativeName: "United States", flag: "🇺🇸",
    currency: "USD", currencySymbol: "$", currencyFormat: "prefix",
    currencySpace: false, thousandSep: ",", decimalSep: ".", decimalDigits: 2,
    vat: { standard: 0, reduced: 0, label: "Sales Tax", inclusive: false, displaySuffix: "+ tax" },
    paymentMethods: [STRIPE, PAYPAL, COD],
    languages: ["en"], dateFormat: "MM/DD/YYYY", phonePrefix: "+1",
    timezone: "America/New_York", region: "americas", isEU: false,
    keyCities: ["New York", "Los Angeles", "Chicago", "Houston", "Miami", "San Francisco", "Seattle", "Dallas"],
  },

  AU: {
    code: "AU", name: "Australia", nativeName: "Australia", flag: "🇦🇺",
    currency: "AUD", currencySymbol: "A$", currencyFormat: "prefix",
    currencySpace: false, thousandSep: ",", decimalSep: ".", decimalDigits: 2,
    vat: { standard: 10, reduced: 0, label: "GST", inclusive: true, displaySuffix: "incl. 10% GST" },
    paymentMethods: [STRIPE, PAYPAL, COD],
    languages: ["en"], dateFormat: "DD/MM/YYYY", phonePrefix: "+61",
    timezone: "Australia/Sydney", region: "oceania", isEU: false,
    keyCities: ["Sydney", "Melbourne", "Brisbane", "Perth", "Adelaide", "Gold Coast", "Canberra"],
  },

  CA: {
    code: "CA", name: "Canada", nativeName: "Canada", flag: "🇨🇦",
    currency: "CAD", currencySymbol: "C$", currencyFormat: "prefix",
    currencySpace: false, thousandSep: ",", decimalSep: ".", decimalDigits: 2,
    vat: { standard: 5, reduced: 0, label: "GST/HST", inclusive: false, displaySuffix: "+ GST/HST" },
    paymentMethods: [STRIPE, PAYPAL, COD],
    languages: ["en", "fr"], dateFormat: "YYYY-MM-DD", phonePrefix: "+1",
    timezone: "America/Toronto", region: "americas", isEU: false,
    keyCities: ["Toronto", "Vancouver", "Montreal", "Calgary", "Ottawa", "Edmonton", "Quebec City"],
  },

  NP: {
    code: "NP", name: "Nepal", nativeName: "नेपाल", flag: "🇳🇵",
    currency: "NPR", currencySymbol: "NPR", currencyFormat: "prefix",
    currencySpace: true, thousandSep: ",", decimalSep: ".", decimalDigits: 0,
    vat: { standard: 13, reduced: 0, label: "VAT", inclusive: true, displaySuffix: "incl. 13% VAT" },
    paymentMethods: [ESEWA, KHALTI, STRIPE, COD],
    languages: ["ne", "en"], dateFormat: "YYYY-MM-DD", phonePrefix: "+977",
    timezone: "Asia/Kathmandu", region: "asia", isEU: false,
    keyCities: ["Pokhara", "Kathmandu", "Chitwan", "Lumbini", "Nagarkot", "Bhaktapur", "Lalitpur", "Biratnagar"],
  },

  IN: {
    code: "IN", name: "India", nativeName: "भारत", flag: "🇮🇳",
    currency: "INR", currencySymbol: "₹", currencyFormat: "prefix",
    currencySpace: false, thousandSep: ",", decimalSep: ".", decimalDigits: 0,
    vat: { standard: 18, reduced: 5, minimal: 0, label: "GST", inclusive: true, displaySuffix: "incl. GST" },
    paymentMethods: [UPI, STRIPE, PAYPAL, COD],
    languages: ["hi", "en"], dateFormat: "DD/MM/YYYY", phonePrefix: "+91",
    timezone: "Asia/Kolkata", region: "asia", isEU: false,
    keyCities: ["Mumbai", "Delhi", "Bangalore", "Hyderabad", "Chennai", "Kolkata", "Pune", "Ahmedabad", "Jaipur", "Goa"],
  },

  AE: {
    code: "AE", name: "UAE", nativeName: "الإمارات", flag: "🇦🇪",
    currency: "AED", currencySymbol: "AED", currencyFormat: "prefix",
    currencySpace: true, thousandSep: ",", decimalSep: ".", decimalDigits: 2,
    vat: { standard: 5, reduced: 0, label: "VAT", inclusive: true, displaySuffix: "incl. 5% VAT" },
    paymentMethods: [STRIPE, PAYPAL, COD],
    languages: ["ar", "en"], dateFormat: "DD/MM/YYYY", phonePrefix: "+971",
    timezone: "Asia/Dubai", region: "middle_east", isEU: false,
    keyCities: ["Dubai", "Abu Dhabi", "Sharjah", "Ajman", "Ras Al Khaimah", "Fujairah"],
  },

  SG: {
    code: "SG", name: "Singapore", nativeName: "Singapore", flag: "🇸🇬",
    currency: "SGD", currencySymbol: "S$", currencyFormat: "prefix",
    currencySpace: false, thousandSep: ",", decimalSep: ".", decimalDigits: 2,
    vat: { standard: 9, reduced: 0, label: "GST", inclusive: false, displaySuffix: "+ 9% GST" },
    paymentMethods: [STRIPE, PAYPAL, COD],
    languages: ["en", "zh", "ms", "ta"], dateFormat: "DD/MM/YYYY", phonePrefix: "+65",
    timezone: "Asia/Singapore", region: "asia", isEU: false,
    keyCities: ["Singapore"],
  },

  TH: {
    code: "TH", name: "Thailand", nativeName: "ประเทศไทย", flag: "🇹🇭",
    currency: "THB", currencySymbol: "฿", currencyFormat: "prefix",
    currencySpace: false, thousandSep: ",", decimalSep: ".", decimalDigits: 0,
    vat: { standard: 7, reduced: 0, label: "VAT", inclusive: true, displaySuffix: "incl. 7% VAT" },
    paymentMethods: [PROMPTPAY, STRIPE, COD],
    languages: ["th", "en"], dateFormat: "DD/MM/YYYY", phonePrefix: "+66",
    timezone: "Asia/Bangkok", region: "asia", isEU: false,
    keyCities: ["Bangkok", "Chiang Mai", "Phuket", "Pattaya", "Koh Samui", "Krabi", "Hua Hin"],
  },

  KE: {
    code: "KE", name: "Kenya", nativeName: "Kenya", flag: "🇰🇪",
    currency: "KES", currencySymbol: "KSh", currencyFormat: "prefix",
    currencySpace: true, thousandSep: ",", decimalSep: ".", decimalDigits: 0,
    vat: { standard: 16, reduced: 0, label: "VAT", inclusive: true, displaySuffix: "incl. 16% VAT" },
    paymentMethods: [MPESA, STRIPE, COD],
    languages: ["sw", "en"], dateFormat: "DD/MM/YYYY", phonePrefix: "+254",
    timezone: "Africa/Nairobi", region: "africa", isEU: false,
    keyCities: ["Nairobi", "Mombasa", "Kisumu", "Nakuru", "Eldoret", "Thika"],
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function getCountryConfig(code: string): CountryConfig {
  return COUNTRY_CONFIGS[code.toUpperCase()] ?? COUNTRY_CONFIGS["US"];
}

export function getCountryByCurrency(currency: string): CountryConfig | undefined {
  return Object.values(COUNTRY_CONFIGS).find(c => c.currency === currency);
}

export function getAllCountries(): CountryConfig[] {
  return Object.values(COUNTRY_CONFIGS).sort((a, b) => a.name.localeCompare(b.name));
}

export function getCountriesByRegion(region: CountryConfig["region"]): CountryConfig[] {
  return Object.values(COUNTRY_CONFIGS).filter(c => c.region === region);
}

/** Detect country from browser locale (best-effort fallback, use IP detection for accuracy) */
export function detectCountryFromBrowser(): string {
  if (typeof window === "undefined") return "SE";
  const locale = navigator.language ?? navigator.languages?.[0] ?? "en-US";
  const parts = locale.split("-");
  const regionCode = parts[parts.length - 1]?.toUpperCase();
  return COUNTRY_CONFIGS[regionCode] ? regionCode : "SE";
}

/** Find a country by city name — used to auto-detect currency from storefront city */
export function getCountryByCity(city: string): CountryConfig | undefined {
  if (!city) return undefined;
  const lower = city.toLowerCase();
  return Object.values(COUNTRY_CONFIGS).find(c =>
    c.keyCities.some(kc => kc.toLowerCase() === lower)
  );
}

/** Resolve the best currency for a storefront: explicit > city-based > browser > SE */
export function resolveStorefrontCurrency(opts: {
  currency?: string;
  countryCode?: string;
  city?: string;
}): string {
  if (opts.currency) return opts.currency;
  if (opts.countryCode) return COUNTRY_CONFIGS[opts.countryCode.toUpperCase()]?.currency ?? "SEK";
  const byCity = opts.city ? getCountryByCity(opts.city) : undefined;
  if (byCity) return byCity.currency;
  return "SEK";
}

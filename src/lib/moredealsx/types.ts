export type MdxIndustry =
  | "Hotel"
  | "Restaurant"
  | "Trekking / Travel"
  | "Salon / Spa"
  | "Clothing"
  | "Grocery"
  | "Events"
  | "Local Services"
  | "CCTV & Security"
  | "IT Services"
  | "Cleaning"
  | "General Retail"
  | "Supplier / Wholesale"
  | "Wellness / Supplements"
  | "Natural Beauty / Skincare"
  | "Fika / Coffee"
  | "Craft Beer / Brewery";

export type MdxItemType = "room" | "food" | "service" | "trekking" | "product" | "event" | "transport";
export type MdxOfferType = "percentage" | "fixed" | "buy_2_get_1" | "flash" | "bundle" | "today_only";
export type MdxOrderSource = "business_marketplace" | "partner_marketplace" | "moredealsx";

export interface MdxBusiness {
  id: string;
  name: string;
  slug: string;
  industry: MdxIndustry;
  city: string;
  area: string;
  description: string;
  rating: number;
  template: string;
  modules: string[];
  heroTone: string;
  storefrontEnabled: boolean;
  moreDealsXEnabled: boolean;
  partnerBusinessIds: string[];
}

export interface MdxItem {
  id: string;
  businessId: string;
  slug: string;
  type: MdxItemType;
  title: string;
  description: string;
  category: string;
  oldPrice?: number;
  price: number;
  currency: string;
  active: boolean;
  moreDealsXVisible: boolean;
  commissionPercent: number;
  attributes?: Record<string, string | number | boolean | string[]>;
}

export interface MdxDeal {
  id: string;
  businessId: string;
  itemId: string;
  slug: string;
  title: string;
  category: string;
  offerType: MdxOfferType;
  oldPrice: number;
  newPrice: number;
  discountLabel: string;
  description: string;
  terms: string;
  timeLeft: string;
  featured: boolean;
  todayOnly: boolean;
  isEvent: boolean;
  popularity: number;
  distanceKm: number;
}

export interface MdxCartItem {
  itemId: string;
  sellingBusinessId: string;
  fulfillmentBusinessId: string;
  quantity: number;
}

export interface MdxMockOrderLine {
  id: string;
  itemId: string;
  itemTitle: string;
  sellingBusinessId: string;
  fulfillmentBusinessId: string;
  source: MdxOrderSource;
  quantity: number;
  total: number;
  commissionPercent: number;
  commissionAmount: number;
}

export interface MdxMockOrder {
  id: string;
  customerName: string;
  source: MdxOrderSource;
  sellingBusinessId: string;
  lines: MdxMockOrderLine[];
  total: number;
  status: "received" | "confirmed" | "preparing" | "out_for_delivery" | "completed";
  trackingSteps: string[];
}

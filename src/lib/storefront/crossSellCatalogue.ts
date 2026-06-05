/**
 * Cross-sell item catalogue — mock partner businesses & their items per industry.
 * Used by the cross-sell settings page (dashboard) and the public storefront clients.
 */

export interface CrossSellItem {
  id:           string;
  name:         string;
  emoji:        string;
  price:        number;
  currency:     string;
  description:  string;
  type:         string;
  businessId:   string;
  businessName: string;
}

export interface CrossSellBusiness {
  id:       string;
  name:     string;
  city:     string;
  emoji:    string;
  industry: string;
  items:    Omit<CrossSellItem, "businessId" | "businessName">[];
}

export const CROSS_SELL_CATALOGUE: Record<string, CrossSellBusiness[]> = {
  "Restaurant": [
    {
      id: "rs-1", name: "Nordic Kitchen", city: "Stockholm", emoji: "🍽️", industry: "Restaurant",
      items: [
        { id: "rs-1-1", name: "Swedish Breakfast Tray",     emoji: "🥐", price: 149, currency: "SEK", description: "Crispbread, butter, jam, yogurt & coffee — delivered to your room",   type: "Room Delivery" },
        { id: "rs-1-2", name: "Hotel Dinner Set Menu",      emoji: "🍷", price: 395, currency: "SEK", description: "3-course set menu prepared fresh by our partner kitchen",             type: "Dine-in"       },
        { id: "rs-1-3", name: "Smörgåsbord Lunch",          emoji: "🥗", price: 195, currency: "SEK", description: "Traditional Swedish buffet — herring, meatballs, dessert",           type: "Dine-in"       },
        { id: "rs-1-4", name: "Late-Night Snack Box",       emoji: "🧀", price:  99, currency: "SEK", description: "Cheese, crackers, fruit & juice — delivered 22:00–01:00",            type: "Room Delivery" },
      ],
    },
    {
      id: "rs-2", name: "Götgatan Bistro", city: "Stockholm", emoji: "🥘", industry: "Restaurant",
      items: [
        { id: "rs-2-1", name: "Coffee & Kanelbullar (×6)", emoji: "☕", price:  89, currency: "SEK", description: "Freshly baked cinnamon buns with filter coffee, delivered morning",   type: "Delivery"      },
        { id: "rs-2-2", name: "Pasta Bolognese",           emoji: "🍝", price: 129, currency: "SEK", description: "Home-made pasta with slow-cooked beef — 30 min delivery",            type: "Delivery"      },
        { id: "rs-2-3", name: "Vegan Buddha Bowl",         emoji: "🥙", price: 145, currency: "SEK", description: "Quinoa, roasted veg, tahini, pomegranate — diet-friendly",           type: "Delivery"      },
      ],
    },
  ],

  "Trekking / Travel": [
    {
      id: "tr-1", name: "Scandinavian Adventures", city: "Stockholm", emoji: "🏔️", industry: "Trekking / Travel",
      items: [
        { id: "tr-1-1", name: "City Guided Walk (2h)",       emoji: "🗺️", price: 250, currency: "SEK", description: "Walking tour of the old town — meets hotel lobby 10:00",             type: "Activity"  },
        { id: "tr-1-2", name: "Mountain Hiking Day Trip",    emoji: "🥾", price: 695, currency: "SEK", description: "Full-day guided hike — lunch & transport included",                  type: "Day Trip"  },
        { id: "tr-1-3", name: "Kayak Lake Tour (3h)",        emoji: "🛶", price: 450, currency: "SEK", description: "Guided kayak on Lake Vättern — equipment included",                  type: "Water Sport" },
        { id: "tr-1-4", name: "Northern Lights Night Trip",  emoji: "🌌", price: 895, currency: "SEK", description: "Nov–Mar only — transport, hot drinks & photography guide",          type: "Night Tour" },
      ],
    },
  ],

  "Salon / Spa": [
    {
      id: "sl-1", name: "Stockholm Spa & Wellness", city: "Stockholm", emoji: "💆", industry: "Salon / Spa",
      items: [
        { id: "sl-1-1", name: "Swedish Full Body Massage (60 min)", emoji: "🛁", price: 695, currency: "SEK", description: "Classic Swedish relaxation massage — book from hotel lobby",  type: "Treatment" },
        { id: "sl-1-2", name: "Hot Stone Treatment (45 min)",       emoji: "🪨", price: 595, currency: "SEK", description: "Heated basalt stones with aromatherapy oils",                 type: "Treatment" },
        { id: "sl-1-3", name: "Facial Glow Treatment (30 min)",     emoji: "✨", price: 445, currency: "SEK", description: "Deep-cleanse + hydration mask — great for after travel",      type: "Beauty"    },
        { id: "sl-1-4", name: "Couples Spa Package (2h)",           emoji: "💑", price: 1490, currency: "SEK", description: "Sauna, massage & facial — robes & herbal tea included",    type: "Package"   },
      ],
    },
  ],

  "Events": [
    {
      id: "ev-1", name: "Stockholm Event Co.", city: "Stockholm", emoji: "🎉", industry: "Events",
      items: [
        { id: "ev-1-1", name: "Private Dinner Event",  emoji: "🎊", price: 4500, currency: "SEK", description: "Venue hire + catering for up to 20 guests",             type: "Event"         },
        { id: "ev-1-2", name: "Live Music Evening",    emoji: "🎵", price: 1200, currency: "SEK", description: "Acoustic duo, 2 hours — perfect for hotel guests",       type: "Entertainment" },
      ],
    },
  ],

  "Grocery": [
    {
      id: "gr-1", name: "Merkoll Fresh Delivery", city: "Stockholm", emoji: "🛒", industry: "Grocery",
      items: [
        { id: "gr-1-1", name: "Welcome Fruit Basket",    emoji: "🍎", price: 199, currency: "SEK", description: "Seasonal fruits delivered to your room on arrival",     type: "In-Room" },
        { id: "gr-1-2", name: "Mini Bar Restock Kit",    emoji: "🧃", price: 149, currency: "SEK", description: "Juices, water, snacks — add-on to your stay",           type: "In-Room" },
      ],
    },
  ],

  "Wellness / Supplements": [
    {
      id: "wl-1", name: "Pure Nordic Wellness", city: "Stockholm", emoji: "🌿", industry: "Wellness / Supplements",
      items: [
        { id: "wl-1-1", name: "Vitamin D3 + K2 Bundle", emoji: "💊", price: 249, currency: "SEK", description: "Nordic-formulated sun supplement — great for long stays",  type: "Supplement" },
        { id: "wl-1-2", name: "Sleep Well Herbal Tea",  emoji: "🍵", price:  89, currency: "SEK", description: "Valerian, lavender, chamomile — 20 bags",                   type: "Supplement" },
      ],
    },
  ],

  "Natural Beauty / Skincare": [
    {
      id: "nb-1", name: "Lykke Skincare", city: "Stockholm", emoji: "🌸", industry: "Natural Beauty / Skincare",
      items: [
        { id: "nb-1-1", name: "Travel Skincare Kit",    emoji: "🧴", price: 349, currency: "SEK", description: "Cleanser, moisturiser & lip balm — 50 ml each",           type: "Kit"     },
        { id: "nb-1-2", name: "Rose Hip Facial Oil",    emoji: "🌹", price: 189, currency: "SEK", description: "100% organic, cold-pressed — 30 ml dropper bottle",        type: "Skincare" },
      ],
    },
  ],

  "General Retail": [
    {
      id: "rt-1", name: "Merkoll Gifts", city: "Stockholm", emoji: "🛍️", industry: "General Retail",
      items: [
        { id: "rt-1-1", name: "Swedish Souvenir Set",   emoji: "🎁", price: 229, currency: "SEK", description: "Dala horse, Swedish mints & fridge magnet — gift-wrapped", type: "Gift" },
        { id: "rt-1-2", name: "Cosy Hotel Blanket",     emoji: "🧣", price: 395, currency: "SEK", description: "Soft fleece throw in Merkoll branding — 130×180 cm",       type: "Comfort" },
      ],
    },
  ],

  "Fika / Coffee": [
    {
      id: "fk-1", name: "Kafé Stockholms Hjärta", city: "Stockholm", emoji: "☕", industry: "Fika / Coffee",
      items: [
        { id: "fk-1-1", name: "Morning Fika Box",         emoji: "🥐", price: 129, currency: "SEK", description: "Coffee + 2 pastries — delivered to your room before 9am", type: "Delivery" },
        { id: "fk-1-2", name: "Afternoon Fika Tray (4p)", emoji: "🍰", price: 245, currency: "SEK", description: "Prinsesstårta, cardamom rolls, coffee for four",           type: "Delivery" },
      ],
    },
  ],
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Flat list of all items with business info merged in */
export function getAllItemsForCategory(category: string): CrossSellItem[] {
  return (CROSS_SELL_CATALOGUE[category] ?? []).flatMap(biz =>
    biz.items.map(item => ({ ...item, businessId: biz.id, businessName: biz.name }))
  );
}

/** localStorage key for a business's pinned cross-sell item IDs */
export function crossSellStorageKey(businessId: string) {
  return `crossSell_pins_${businessId}`;
}

export function loadPinnedIds(businessId: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    return new Set(JSON.parse(localStorage.getItem(crossSellStorageKey(businessId)) ?? "[]") as string[]);
  } catch { return new Set(); }
}

export function savePinnedIds(businessId: string, pins: Set<string>) {
  localStorage.setItem(crossSellStorageKey(businessId), JSON.stringify([...pins]));
}

/** Returns pinned CrossSellItems for use in the public storefront */
export function loadPinnedItems(businessId: string): CrossSellItem[] {
  const pins = loadPinnedIds(businessId);
  if (pins.size === 0) return [];
  const all = Object.values(CROSS_SELL_CATALOGUE).flat().flatMap(biz =>
    biz.items.map(item => ({ ...item, businessId: biz.id, businessName: biz.name }))
  );
  return all.filter(item => pins.has(item.id));
}

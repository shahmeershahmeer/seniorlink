// Neighbourhoods new members can pick when joining (approximate centre points).
export const NEIGHBOURHOODS = [
  { name: "Downtown Fredericton", lat: 45.9605, lng: -66.643 },
  { name: "Northside", lat: 45.972, lng: -66.628 },
  { name: "Nashwaaksis", lat: 45.978, lng: -66.66 },
  { name: "College Hill", lat: 45.948, lng: -66.66 },
  { name: "Skyline Acres", lat: 45.938, lng: -66.668 },
  { name: "Silverwood", lat: 45.945, lng: -66.69 },
  { name: "Southwood Park", lat: 45.935, lng: -66.645 },
  { name: "Marysville", lat: 45.98, lng: -66.585 },
  { name: "Lincoln", lat: 45.918, lng: -66.575 },
  { name: "Oromocto", lat: 45.849, lng: -66.479 },
] as const;

/** Common destinations around Fredericton (approximate coordinates), matched by keywords. */
export const DESTINATIONS = [
  { name: "Dr. Everett Chalmers Hospital", keys: ["everett chalmers", "chalmers", "dech", "hospital"], lat: 45.9428, lng: -66.6532 },
  { name: "Downtown Community Health Centre", keys: ["health centre", "community health"], lat: 45.9612, lng: -66.6418 },
  { name: "Regent Mall", keys: ["regent mall", "mall"], lat: 45.9357, lng: -66.6595 },
  { name: "Walmart (Regent St)", keys: ["walmart"], lat: 45.9321, lng: -66.6641 },
  { name: "Atlantic Superstore (Prospect St)", keys: ["superstore", "atlantic superstore"], lat: 45.9376, lng: -66.6735 },
  { name: "Sobeys (Main St)", keys: ["sobeys"], lat: 45.9717, lng: -66.6283 },
  { name: "Boyce Farmers Market", keys: ["boyce", "farmers market", "market"], lat: 45.9585, lng: -66.6425 },
  { name: "Shoppers Drug Mart (Prospect St)", keys: ["shoppers", "drug mart"], lat: 45.9371, lng: -66.6683 },
  { name: "Fredericton Public Library", keys: ["library"], lat: 45.9602, lng: -66.6401 },
  { name: "Oromocto", keys: ["oromocto"], lat: 45.849, lng: -66.479 },
  { name: "Downtown Fredericton", keys: ["downtown fredericton", "fredericton"], lat: 45.9605, lng: -66.643 },
] as const;

export const RIDE_SHORTCUTS = ["Dr. Everett Chalmers Hospital", "Downtown Community Health Centre", "Regent Mall", "Fredericton Public Library"];
export const GROCERY_STORES = ["Sobeys (Main St)", "Atlantic Superstore (Prospect St)", "Walmart (Regent St)", "Boyce Farmers Market"];

/** Best-effort geocoding from free text: known destinations first, then neighbourhoods. */
export function resolvePlace(text: string | null | undefined): { name: string; lat: number; lng: number; known: boolean } | null {
  if (!text) return null;
  const t = text.toLowerCase();
  const d = DESTINATIONS.find((x) => x.keys.some((k) => t.includes(k)));
  if (d) return { name: d.name, lat: d.lat, lng: d.lng, known: true };
  const n = NEIGHBOURHOODS.find((x) => t.includes(x.name.toLowerCase()) || t.includes(x.name.toLowerCase().replace(" fredericton", "")));
  return n ? { name: n.name, lat: n.lat, lng: n.lng, known: false } : null;
}

const COLORS = ["#E07A2F", "#1B4530", "#6D28D9", "#1D4ED8", "#BE123C", "#047857", "#B45309", "#7C3AED", "#0369A1"];

export function colorFor(name: string): string {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return COLORS[h % COLORS.length];
}

export function initialsOf(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

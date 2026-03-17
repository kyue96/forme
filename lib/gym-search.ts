export interface GymResult {
  placeId: string;
  name: string;
  address: string;
}

/**
 * Search for gyms using Google Places Text Search API.
 * Requires EXPO_PUBLIC_GOOGLE_PLACES_API_KEY environment variable.
 */
export async function searchGyms(query: string): Promise<GymResult[]> {
  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;
  if (!apiKey || !query.trim()) return [];

  try {
    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query + ' gym')}&type=gym&key=${apiKey}`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.status !== 'OK' || !data.results) return [];

    return data.results.slice(0, 10).map((r: any) => ({
      placeId: r.place_id,
      name: r.name,
      address: r.formatted_address ?? '',
    }));
  } catch {
    return [];
  }
}

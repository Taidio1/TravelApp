import { setOptions, importLibrary } from '@googlemaps/js-api-loader';

setOptions({
  key: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
  v: 'weekly',
  libraries: ['places']
});

export { importLibrary };

export interface NearbyPlace {
  id: string;
  name: string;
  lat: number;
  lng: number;
  category: 'food' | 'sightseeing' | 'activity';
  photoUrl: string | null;
  rating: number | null;
  userRatingsTotal: number | null;
}

// Discover-mode "near me" filters → Google Places primary types.
export type DiscoverFilter = 'food' | 'attraction' | 'history';

const FILTER_TYPES: Record<DiscoverFilter, { types: string[]; category: NearbyPlace['category'] }> = {
  food: { types: ['restaurant', 'cafe', 'bar'], category: 'food' },
  attraction: { types: ['tourist_attraction', 'amusement_park', 'zoo'], category: 'activity' },
  history: { types: ['historical_landmark', 'museum', 'church'], category: 'sightseeing' },
};

// Bayesian (IMDb-style) weighted rating — keeps a 5.0/3-reviews place from
// outranking a 4.7/8000-reviews place. m = credibility threshold, C = prior mean.
function weightedRating(p: NearbyPlace, m = 50, C = 4.2): number {
  const v = p.userRatingsTotal ?? 0;
  const r = p.rating ?? 0;
  return (v / (v + m)) * r + (m / (v + m)) * C;
}

// One Place.searchNearby (new Places API) call for a single category group.
async function fetchGroup(
  lat: number,
  lng: number,
  radius: number,
  types: string[],
  category: NearbyPlace['category']
): Promise<NearbyPlace[]> {
  try {
    const placesLib: any = await importLibrary('places');
    const { Place, SearchNearbyRankPreference } = placesLib;
    const { places } = await Place.searchNearby({
      fields: ['id', 'displayName', 'location', 'photos', 'rating', 'userRatingCount'],
      locationRestriction: { center: { lat, lng }, radius },
      includedPrimaryTypes: types,
      maxResultCount: 12,
      rankPreference: SearchNearbyRankPreference.POPULARITY,
    });
    return (places ?? []).map((p: any) => ({
      id: p.id,
      name: p.displayName ?? '',
      lat: p.location.lat(),
      lng: p.location.lng(),
      category,
      photoUrl: p.photos?.[0]?.getURI({ maxWidth: 1200, maxHeight: 1200 }) ?? null,
      rating: p.rating ?? null,
      userRatingsTotal: p.userRatingCount ?? null,
    }));
  } catch (e) {
    console.error('searchNearby error:', e);
    return [];
  }
}

// Fetch ≥15 nearby restaurants + cultural spots, escalating the radius until met.
export async function searchNearby(lat: number, lng: number): Promise<NearbyPlace[]> {
  let result: NearbyPlace[] = [];
  for (const radius of [1500, 4000, 9000]) {
    const [food, culture] = await Promise.all([
      fetchGroup(lat, lng, radius, ['restaurant'], 'food'),
      fetchGroup(
        lat,
        lng,
        radius,
        ['tourist_attraction', 'museum', 'art_gallery', 'historical_landmark'],
        'sightseeing'
      ),
    ]);
    const seen = new Set<string>();
    result = [...food, ...culture].filter((p) =>
      seen.has(p.id) ? false : (seen.add(p.id), true)
    );
    if (result.length >= 15) break;
  }
  return result;
}

// Single-filter nearby search within `radius` metres, sorted by weighted rating.
export async function searchNearbyFiltered(
  lat: number,
  lng: number,
  filter: DiscoverFilter,
  radius = 5000
): Promise<NearbyPlace[]> {
  const { types, category } = FILTER_TYPES[filter];
  const places = await fetchGroup(lat, lng, radius, types, category);
  return places.sort((a, b) => weightedRating(b) - weightedRating(a));
}

export async function fetchPlacePhoto(lat: number, lng: number): Promise<string | null> {
  try {
    const placesLib: any = await importLibrary('places');
    const { Place } = placesLib;
    const { places } = await Place.searchNearby({
      fields: ['photos'],
      locationRestriction: { center: { lat, lng }, radius: 200 },
      maxResultCount: 1,
    });
    return places?.[0]?.photos?.[0]?.getURI({ maxWidth: 800, maxHeight: 600 }) ?? null;
  } catch {
    return null;
  }
}

export const mapOptions: any = {
  center: { lat: 38.3460, lng: -0.4907 }, // Alicante
  zoom: 12,
  disableDefaultUI: true,
  // mapId is required by AdvancedMarkerElement; replace 'DEMO_MAP_ID' with a real
  // Cloud-based map ID (Google Cloud Console → Maps → Map Styles) to restore
  // the custom warm-light styling — inline `styles` is incompatible with mapId.
  mapId: 'DEMO_MAP_ID',
};

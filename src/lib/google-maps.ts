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
  category: 'food' | 'sightseeing';
  photoUrl: string | null;
  rating: number | null;
  userRatingsTotal: number | null;
}

// One Place.searchNearby (new Places API) call for a single category group.
async function fetchGroup(
  lat: number,
  lng: number,
  radius: number,
  types: string[],
  category: 'food' | 'sightseeing'
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
  center: { lat: 40.4168, lng: -3.7038 }, // Madrid
  zoom: 12,
  disableDefaultUI: true,
  // mapId is required by AdvancedMarkerElement; replace 'DEMO_MAP_ID' with a real
  // Cloud-based map ID (Google Cloud Console → Maps → Map Styles) to restore
  // the custom warm-light styling — inline `styles` is incompatible with mapId.
  mapId: 'DEMO_MAP_ID',
};

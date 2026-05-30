import { useState, useEffect, useRef, useMemo, useCallback, lazy, Suspense } from 'react';
import Map from './components/Map';
import LocationCard from './components/LocationCard';
import DiscoverMode from './components/DiscoverMode';
import DiscoveryCard from './components/DiscoveryCard';
import type { DiscoveryPlace } from './components/DiscoveryCard';
import VotingBanner from './components/VotingBanner';
import FavoritesList from './components/FavoritesList';
import StartVoteModal from './components/StartVoteModal';
import ProfilePage from './components/ProfilePage';
import Auth from './components/Auth';
import { useRealtime } from './hooks/useRealtime';
import { supabase } from './lib/supabase';
import { importLibrary } from './lib/google-maps';
import { Sparkles, List, Map as MapIcon, Star, X, Bookmark, Check, Compass, Search, Navigation, Route, MessageCircle } from 'lucide-react';
import Button from './components/Button';
import { AnimatePresence, motion } from 'framer-motion';
import { useDarkMode } from './hooks/useDarkMode';

const TripWizard = lazy(() => import('./components/TripWizard'));
const AIChat = lazy(() => import('./components/AIChat'));

async function geocodeCity(city: string): Promise<{ lat: number; lng: number; label: string } | null> {
  try {
    const lib = await importLibrary('geocoding') as any;
    const geocoder = new lib.Geocoder();
    const result = await geocoder.geocode({ address: city });
    if (result.results?.length) {
      const loc = result.results[0].geometry.location;
      return {
        lat: typeof loc.lat === 'function' ? loc.lat() : loc.lat,
        lng: typeof loc.lng === 'function' ? loc.lng() : loc.lng,
        label: result.results[0].address_components?.[0]?.long_name ?? result.results[0].formatted_address,
      };
    }
    return null;
  } catch {
    return null;
  }
}

/** Reverse-geocode lat/lng to a human-readable city/locality name. */
async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const lib = await importLibrary('geocoding') as any;
    const geocoder = new lib.Geocoder();
    const result = await geocoder.geocode({ location: { lat, lng } });
    if (!result.results?.length) return null;
    // Prefer locality (city), then administrative_area_level_2, then formatted_address
    for (const r of result.results) {
      const locality = r.address_components?.find((c: any) =>
        c.types.includes('locality') || c.types.includes('administrative_area_level_2')
      );
      if (locality) return locality.long_name;
    }
    return result.results[0].formatted_address ?? null;
  } catch {
    return null;
  }
}

const FILTERS = [
  { id: 'all',        label: 'Wszystkie',  emoji: '🗺️' },
  { id: 'food',       label: 'Restauracje', emoji: '🍽️' },
  { id: 'sightseeing',label: 'Kulturalne',  emoji: '🏛️' },
  { id: 'activity',   label: '4fun',        emoji: '🎢' },
  { id: 'scenery',    label: 'Widoczki',    emoji: '🌅' },
  { id: 'must_have',  label: 'Must Have',   emoji: '⭐' },
] as const;

type FilterId = typeof FILTERS[number]['id'];

// Stable reference for "no places" so memoized <Map> props don't churn each render.
const EMPTY_PLACES: any[] = [];

function App() {
  const [session, setSession] = useState<any>(null);
  const places = useRealtime<any>('places');
  const votes = useRealtime<any>('votes');
  const plans = useRealtime<any>('daily_plans');
  const [favorites, setFavorites] = useState<any[]>([]);
  const rounds = useRealtime<any>('voting_rounds');

  const [selectedPlace, setSelectedPlace] = useState<any>(null);
  const [showWizard, setShowWizard] = useState(false);
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [planningMode, setPlanningMode] = useState(false);
  const [planningPlaces, setPlanningPlaces] = useState<any[]>([]);
  const [planningRouteName, setPlanningRouteName] = useState('');
  const [planningRouteSaved, setPlanningRouteSaved] = useState(false);
  const [previewPlaces, setPreviewPlaces] = useState<any[] | null>(null);
  const [suggestionPlaces, setSuggestionPlaces] = useState<any[] | null>(null);
  const [suggestionFitNonce, setSuggestionFitNonce] = useState(0);
  const [suggestionPreviewRoute, setSuggestionPreviewRoute] = useState<any>(null);
  const [view, setView] = useState<'map' | 'discover' | 'favorites'>('map');
  const [userProfile, setUserProfile] = useState<any>(null);
  const [activeFilter, setActiveFilter] = useState<FilterId>('all');
  const [discoveryPlace, setDiscoveryPlace] = useState<DiscoveryPlace | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number }>({ lat: 38.3460, lng: -0.4907 }); // Alicante fallback
  const [locationReady, setLocationReady] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [pendingVote, setPendingVote] = useState<{ name: string; discovery?: DiscoveryPlace; existingId?: string } | null>(null);
  const [focus, setFocus] = useState<{ lat: number; lng: number; nonce: number } | null>(null);
  const [dark, setDark] = useDarkMode();
  const [enlargedPhoto, setEnlargedPhoto] = useState<string | null>(null);
  const [citySearch, setCitySearch] = useState('');
  const [citySearching, setCitySearching] = useState(false);
  const [citySearchError, setCitySearchError] = useState(false);
  const [activeCityLabel, setActiveCityLabel] = useState<string | null>(null);
  const [isLiveLocation, setIsLiveLocation] = useState(true);

  const activeRound = rounds.find((r: any) => r.status === 'active');
  const finalizingRef = useRef<Set<string>>(new Set());

  // Stable handlers for <Map> — keep its props referentially equal across
  // unrelated re-renders (e.g. a vote ping) so the memoized map doesn't rebuild.
  const handleMapClick = useCallback(() => { setSelectedPlace(null); setDiscoveryPlace(null); }, []);
  const handleMarkerClick = useCallback((place: any) => { setDiscoveryPlace(null); setSelectedPlace(place); }, []);
  const handleDiscoveryClick = useCallback((p: any) => { setSelectedPlace(null); setDiscoveryPlace(p); }, []);
  const handleLocate = useCallback((lat: number, lng: number) => setUserLocation({ lat, lng }), []);

  // Nearest board places to the user — passed to the AI chat as local context.
  const nearbyPlaceNames = useMemo(() => {
    const { lat, lng } = userLocation;
    return places
      .map((p: any) => ({ place: p, d: (Number(p.lat) - lat) ** 2 + (Number(p.lng) - lng) ** 2 }))
      .sort((a, b) => a.d - b.d)
      .slice(0, 10)
      .map(({ place: p }) => ({
        name: p.name as string,
        rating: p.rating != null ? Number(p.rating) : null,
        totalRatings: p.user_ratings_total != null ? Number(p.user_ratings_total) : null,
        category: p.category as string | null,
      }));
  }, [places, userLocation]);

  const filteredPlaces = useMemo(() => (
    activeFilter === 'all'
      ? places
      : activeFilter === 'must_have'
        ? places.filter((p: any) => p.status === 'approved')
        : places.filter((p: any) => p.category === activeFilter)
  ), [places, activeFilter]);

  useEffect(() => {
    if (!session) return;
    supabase.from('favorites').select('*').eq('user_id', session.user.id).then(({ data }) => {
      if (data) setFavorites(data);
    });
  }, [session?.user.id]);

  useEffect(() => {
    if (!navigator.geolocation) {
      // Browser doesn't support geolocation — mark as ready with Alicante fallback
      setLocationReady(true);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setUserLocation({ lat, lng });
        setIsLiveLocation(true);
        // Auto-populate the city label via reverse geocoding
        const label = await reverseGeocode(lat, lng);
        if (label) setActiveCityLabel(label);
        setLocationReady(true);
      },
      () => {
        // GPS denied or timed out — mark ready so the chat isn't blocked forever
        setLocationReady(true);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, []);

  const handleCitySearch = async () => {
    const q = citySearch.trim();
    if (!q) return;
    setCitySearching(true);
    setCitySearchError(false);
    const result = await geocodeCity(q);
    setCitySearching(false);
    if (result) {
      setUserLocation({ lat: result.lat, lng: result.lng });
      setFocus({ lat: result.lat, lng: result.lng, nonce: Date.now() });
      setActiveCityLabel(result.label);
      setIsLiveLocation(false);
      setCitySearch('');
    } else {
      setCitySearchError(true);
    }
  };

  const resetToLiveLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setUserLocation(loc);
          setFocus({ ...loc, nonce: Date.now() });
        },
        () => {},
        { enableHighAccuracy: true, timeout: 8000 }
      );
    }
    setActiveCityLabel(null);
    setIsLiveLocation(true);
    setCitySearch('');
    setCitySearchError(false);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.user) return;
    supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single()
      .then(async ({ data, error }) => {
        if (data) {
          setUserProfile(data);
        } else if (error?.code === 'PGRST116') {
          const { data: created } = await supabase
            .from('profiles')
            .insert({
              id: session.user.id,
              email: session.user.email,
              role: 'user',
              username: session.user.email?.split('@')[0],
            })
            .select()
            .single();
          if (created) setUserProfile(created);
        }
      });
  }, [session]);

  const handleVote = async (placeId: string, type: 1 | -1 = 1) => {
    if (!session) return;

    const existing = votes.find(
      (v: any) => v.place_id === placeId && v.user_id === session.user.id
    );

    if (existing) {
      if (existing.vote_type === type) {
        // same direction again → toggle off
        await supabase
          .from('votes')
          .delete()
          .match({ place_id: placeId, user_id: session.user.id });
      } else {
        // switch sides
        await supabase
          .from('votes')
          .update({ vote_type: type })
          .match({ place_id: placeId, user_id: session.user.id });
      }
    } else {
      const { error } = await supabase
        .from('votes')
        .insert({ place_id: placeId, user_id: session.user.id, vote_type: type });
      if (error && error.code === '23505') {
        await supabase
          .from('votes')
          .update({ vote_type: type })
          .match({ place_id: placeId, user_id: session.user.id });
      }
    }
  };

  const handleFinalize = async (placeId: string) => {
    await supabase
      .from('places')
      .update({ status: 'approved' })
      .eq('id', placeId);
    
    await supabase
      .from('daily_plans')
      .insert({ 
        date: new Date().toISOString().split('T')[0],
        place_id: placeId,
        order: plans.length + 1,
        assigned_by: session.user.id
      });
  };

  const handleAddFavorite = async (p: DiscoveryPlace) => {
    if (!session) return 'Brak sesji';
    const { data, error } = await supabase.from('favorites').insert({
      user_id: session.user.id,
      name: p.name,
      category: p.category,
      lat: p.lat,
      lng: p.lng,
      google_place_id: p.placeId,
      photo_url: p.photoUrl,
    }).select().single();
    if (error) {
      console.error('Add favorite failed:', error.message);
      return error.message;
    }
    if (data) setFavorites(prev => [...prev, data]);
    return null;
  };

  const handleRemoveFavorite = async (id: string) => {
    const { error } = await supabase.from('favorites').delete().eq('id', id);
    if (!error) setFavorites(prev => prev.filter(f => f.id !== id));
  };

  // From a discovery point: add the place to today's daily plan (creating the place row if needed).
  const handleAddToPlan = async (p: DiscoveryPlace): Promise<string | null> => {
    if (!session) return 'Brak sesji';
    const today = new Date().toISOString().split('T')[0];

    // find or create the underlying place row
    let placeId: string;
    const { data: existing } = await supabase
      .from('places')
      .select('id')
      .eq('name', p.name)
      .maybeSingle();
    if (existing) {
      placeId = existing.id;
      await supabase.from('places').update({ status: 'approved' }).eq('id', placeId);
    } else {
      const { data: created, error: insErr } = await supabase
        .from('places')
        .insert({
          name: p.name,
          description: '',
          category: p.category,
          lat: p.lat,
          lng: p.lng,
          google_place_id: p.placeId,
          photo_url: p.photoUrl,
          created_by: session.user.id,
          status: 'approved',
          ai_suggested: true,
        })
        .select('id')
        .single();
      if (insErr || !created) return insErr?.message ?? 'Błąd dodawania miejsca';
      placeId = created.id;
    }

    // skip if already in today's plan
    const { data: dup } = await supabase
      .from('daily_plans')
      .select('id')
      .eq('date', today)
      .eq('place_id', placeId)
      .maybeSingle();
    if (dup) return null;

    const { error } = await supabase.from('daily_plans').insert({
      date: today,
      place_id: placeId,
      order: plans.length + 1,
      assigned_by: session.user.id,
    });
    if (error) return error.message;
    return null;
  };

  const placeExists = async (name: string): Promise<boolean> => {
    const { data } = await supabase.from('places').select('id').eq('name', name).maybeSingle();
    return !!data;
  };

  const addCandidate = async (p: DiscoveryPlace, roundId: string) => {
    if (await placeExists(p.name)) return;
    const { error } = await supabase.from('places').insert({
      name: p.name,
      description: '',
      category: p.category,
      lat: p.lat,
      lng: p.lng,
      google_place_id: p.placeId,
      photo_url: p.photoUrl,
      rating: p.rating ?? null,
      user_ratings_total: p.userRatingsTotal ?? null,
      created_by: session.user.id,
      status: 'proposed',
      ai_suggested: false,
      round_id: roundId,
    });
    if (error) console.error('Add candidate failed:', error.message);
  };

  // mark an existing board place as a candidate of a round
  const addExistingCandidate = async (placeId: string, roundId: string) => {
    const { error } = await supabase
      .from('places')
      .update({ round_id: roundId, status: 'proposed' })
      .eq('id', placeId);
    if (error) console.error('Add candidate failed:', error.message);
  };

  // From a discovery point: add to the live round, or open the day-picker to start one.
  const handleSendToVote = (p: DiscoveryPlace) => {
    if (!session) return;
    setDiscoveryPlace(null);
    if (activeRound) addCandidate(p, activeRound.id);
    else setPendingVote({ name: p.name, discovery: p });
  };

  // Tap a candidate's name in the voting banner → pan the map there and open its detail card
  const handleSelectCandidate = (place: any) => {
    setDiscoveryPlace(null);
    setSelectedPlace(place);
    setFocus({ lat: Number(place.lat), lng: Number(place.lng), nonce: Date.now() });
  };

  // From a board place already on the map
  const handleSendExistingToVote = (place: any) => {
    if (!session) return;
    setSelectedPlace(null);
    if (activeRound) addExistingCandidate(place.id, activeRound.id);
    else setPendingVote({ name: place.name, existingId: place.id });
  };

  const handleStartRound = async (date: string) => {
    if (!session || !pendingVote) return;
    const endsAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from('voting_rounds')
      .insert({ started_by: session.user.id, target_date: date, ends_at: endsAt, status: 'active' })
      .select()
      .single();
    if (error) {
      console.error('Start round failed:', error.message);
    } else if (data) {
      if (pendingVote.discovery) await addCandidate(pendingVote.discovery, data.id);
      else if (pendingVote.existingId) await addExistingCandidate(pendingVote.existingId, data.id);
    }
    setPendingVote(null);
  };

  // Timer hit 0 — top-voted candidate wins. Conditional status update so only one
  // client transitions the round and writes the winner to the daily plan.
  const finalizeRound = async (round: any) => {
    if (finalizingRef.current.has(round.id)) return;
    finalizingRef.current.add(round.id);

    const candidates = places
      .filter((p: any) => p.round_id === round.id)
      .map((p: any) => ({
        id: p.id,
        n: votes
          .filter((v: any) => v.place_id === p.id)
          .reduce((s: number, v: any) => s + (v.vote_type ?? 1), 0),
      }))
      .sort((a, b) => b.n - a.n);
    const winner = candidates[0];

    const { data } = await supabase
      .from('voting_rounds')
      .update({ status: 'finished', winner_place_id: winner?.id ?? null })
      .eq('id', round.id)
      .eq('status', 'active')
      .select();

    // only the client that actually flipped the status saves the winner
    if (data && data.length && winner) {
      await supabase.from('places').update({ status: 'approved' }).eq('id', winner.id);
      await supabase.from('daily_plans').insert({
        date: round.target_date,
        place_id: winner.id,
        order: plans.length + 1,
        assigned_by: session.user.id,
      });
    }
  };


  const handleShowSuggestionsOnMap = (route: any) => {
    setSuggestionPreviewRoute(route);
    setShowWizard(false);
    setSuggestionFitNonce(n => n + 1);
  };

  const handleReturnToSuggestionsList = () => {
    setShowWizard(true);
  };

  const handleWizardConfirm = async (places: any[], name: string, alreadySaved = false) => {
    setShowWizard(false);
    setPreviewPlaces(null);
    setSuggestionPlaces(null);
    setSuggestionPreviewRoute(null);
    setPlanningPlaces(places);
    setPlanningMode(true);
    setPlanningRouteName(name);
    setPlanningRouteSaved(alreadySaved);
    for (const s of places) {
      if (await placeExists(s.name)) continue;
      const { error } = await supabase.from('places').insert({
        name: s.name,
        description: s.description ?? '',
        category: s.category,
        lat: s.lat,
        lng: s.lng,
        created_by: session.user.id,
        ai_suggested: true,
        status: 'proposed',
      });
      if (error) console.error('Place insert failed:', error.message, s);
    }
  };

  const handleSavePlanningRoute = () => {
    try {
      const existing = JSON.parse(localStorage.getItem('saved_routes') ?? '[]');
      const route = {
        id: crypto.randomUUID(),
        name: planningRouteName || 'Moja trasa',
        places: planningPlaces,
        createdAt: new Date().toISOString(),
      };
      localStorage.setItem('saved_routes', JSON.stringify([route, ...existing].slice(0, 10)));
      setPlanningRouteSaved(true);
    } catch (e) {
      console.error('Save route failed', e);
    }
  };

  const exitPlanningMode = () => {
    setPlanningMode(false);
    setPlanningPlaces([]);
    setPlanningRouteName('');
    setPlanningRouteSaved(false);
    setPreviewPlaces(null);
    setSuggestionPlaces(null);
    setSuggestionPreviewRoute(null);
  };

  if (!session) return <Auth />;

  return (
    <>
    <div className="fixed inset-0 bg-spanish-bg flex flex-col overflow-hidden">
      {/* Main Content */}
      <div className="flex-1 relative overflow-hidden">
        <AnimatePresence mode="wait">
          {view === 'map' && (
            <motion.div
              key="map"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              className="w-full h-full relative"
            >
              {/* Filter pills + city search */}
              <div className="absolute top-4 left-0 right-0 z-10 px-4 flex flex-col gap-2">
                {/* City search bar */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 flex items-center gap-2 bg-white/95 dark:bg-gray-800/95 backdrop-blur rounded-2xl px-3 h-10">
                    <Search size={15} className="text-gray-400 shrink-0" />
                    <input
                      type="text"
                      value={citySearch}
                      onChange={e => { setCitySearch(e.target.value); setCitySearchError(false); }}
                      onKeyDown={e => e.key === 'Enter' && handleCitySearch()}
                      placeholder="Szukaj miasta..."
                      className="flex-1 bg-transparent text-sm text-gray-800 dark:text-gray-100 placeholder-gray-400 outline-none"
                    />
                    {citySearching && <div className="w-4 h-4 border-2 border-spanish-orange border-t-transparent rounded-full animate-spin shrink-0" />}
                    {!citySearching && citySearch.length > 0 && (
                      <button onClick={handleCitySearch} className="shrink-0 text-spanish-orange font-semibold text-xs active:opacity-70">
                        Szukaj
                      </button>
                    )}
                    {!citySearching && citySearch.length === 0 && !isLiveLocation && (
                      <button onClick={resetToLiveLocation} className="shrink-0 text-gray-400 active:opacity-70">
                        <X size={14} />
                      </button>
                    )}
                  </div>
                  {!isLiveLocation && (
                    <button
                      onClick={resetToLiveLocation}
                      className="w-10 h-10 rounded-2xl bg-white/95 dark:bg-gray-800/95 backdrop-blur flex items-center justify-center shrink-0"
                      title="Wróć do mojej lokalizacji"
                    >
                      <Navigation size={16} className="text-spanish-orange" />
                    </button>
                  )}
                </div>

                {/* Active city label or error */}
                <AnimatePresence>
                  {citySearchError && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      className="mx-1 px-3 py-1.5 rounded-xl bg-red-100/90 dark:bg-red-900/40 text-red-600 dark:text-red-400 text-xs font-medium"
                    >
                      Nie znaleziono miasta. Spróbuj inaczej.
                    </motion.div>
                  )}
                  {activeCityLabel && !citySearchError && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      className="mx-1 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-spanish-orange/15 self-start"
                    >
                      <MapIcon size={11} className="text-spanish-orange" />
                      <span className="text-spanish-orange text-xs font-semibold">{activeCityLabel}</span>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Filter pills */}
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                  {FILTERS.map(f => (
                    <button
                      key={f.id}
                      onClick={() => setActiveFilter(f.id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                        activeFilter === f.id
                          ? 'bg-spanish-orange text-white shadow-lg scale-105'
                          : 'bg-white/90 dark:bg-gray-700/90 backdrop-blur text-gray-600 dark:text-gray-300'
                      }`}
                    >
                      <span>{f.emoji}</span>
                      <span>{f.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Live voting round */}
              <AnimatePresence>
                {activeRound && (
                  <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="absolute top-36 left-4 right-4 z-20"
                  >
                    <VotingBanner
                      round={activeRound}
                      places={places}
                      votes={votes}
                      userId={session.user.id}
                      onVote={handleVote}
                      onExpire={finalizeRound}
                      onSelectCandidate={handleSelectCandidate}
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              <Map
                places={filteredPlaces}
                categoryFilter={activeFilter}
                onMapClick={handleMapClick}
                onMarkerClick={handleMarkerClick}
                onDiscoveryClick={handleDiscoveryClick}
                onLocate={handleLocate}
                focus={focus}
                planningMode={planningMode}
                planningPlaces={planningPlaces}
                previewPlaces={previewPlaces ?? EMPTY_PLACES}
                suggestionPlaces={suggestionPlaces ?? EMPTY_PLACES}
                suggestionFitRequest={suggestionFitNonce}
              />
            </motion.div>
          )}
          {view === 'discover' && (
            <motion.div
              key="discover"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="w-full h-full"
            >
              <DiscoverMode
                onFavorite={handleAddFavorite}
                onRemoveFavorite={handleRemoveFavorite}
                onAddToPlan={handleAddToPlan}
                favorites={favorites}
                userLocation={userLocation}
              />
            </motion.div>
          )}
          {view === 'favorites' && (
            <motion.div
              key="favorites"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="w-full h-full"
            >
              <FavoritesList
                favorites={favorites}
                onClose={() => setView('map')}
                onRemove={handleRemoveFavorite}
                onShowOnMap={(fav) => {
                  setView('map');
                  setFocus({ lat: Number(fav.lat), lng: Number(fav.lng), nonce: Date.now() });
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>
        

        {/* Trip Wizard (full-screen overlay, rendered via portal-like fixed positioning) */}

        {/* Discovery preview Overlay */}
        <AnimatePresence>
          {discoveryPlace && view === 'map' && (
            <motion.div
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              className="absolute bottom-4 left-0 right-0 flex justify-center z-30 px-4"
            >
              <DiscoveryCard
                place={discoveryPlace}
                hasActiveRound={!!activeRound}
                onClose={() => setDiscoveryPlace(null)}
                onFavorite={handleAddFavorite}
                onSendToVote={handleSendToVote}
                onImageClick={() => setEnlargedPhoto(discoveryPlace.photoUrl)}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Detail Overlay */}
        <AnimatePresence>
          {selectedPlace && view === 'map' && (
            <motion.div
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              className="absolute bottom-4 left-0 right-0 flex justify-center z-10 px-4"
            >
              <LocationCard
                place={selectedPlace}
                votes={votes}
                userId={session.user.id}
                hasActiveRound={!!activeRound}
                onVote={handleVote}
                onFinalize={handleFinalize}
                onFavorite={handleAddFavorite}
                onSendToVote={handleSendExistingToVote}
                onImageClick={() => setEnlargedPhoto(selectedPlace.photo_url)}
                isAdmin={userProfile?.role === 'admin'}
                isCandidate={!!activeRound && selectedPlace?.round_id === activeRound.id}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Profile Overlay */}
        <AnimatePresence>
          {showProfile && (
            <motion.div
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              className="absolute inset-x-0 bottom-4 z-30 px-4 flex justify-center"
            >
              <ProfilePage
                session={session}
                userProfile={userProfile}
                dark={dark}
                onDarkToggle={() => setDark(d => !d)}
                onClose={() => setShowProfile(false)}
                onSignOut={() => { setShowProfile(false); supabase.auth.signOut(); }}
                onAvatarChange={async (seed) => {
                  await supabase.from('profiles').update({ avatar_url: seed }).eq('id', session.user.id);
                  setUserProfile((p: any) => ({ ...p, avatar_url: seed }));
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Start-a-round day picker */}
        <AnimatePresence>
          {pendingVote && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-40"
            >
              <StartVoteModal
                placeName={pendingVote.name}
                onConfirm={handleStartRound}
                onCancel={() => setPendingVote(null)}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Enlarged Photo Lightbox */}
        <AnimatePresence>
          {enlargedPhoto && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
              onClick={() => setEnlargedPhoto(null)}
            >
              <button 
                className="absolute top-6 right-6 text-white bg-white/10 hover:bg-white/20 p-2 rounded-full backdrop-blur transition-colors"
                onClick={() => setEnlargedPhoto(null)}
              >
                <X size={24} />
              </button>
              <motion.img 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                src={enlargedPhoto} 
                alt="" 
                className="w-[95vw] h-[85vh] rounded-2xl object-contain shadow-2xl" 
                onClick={(e) => e.stopPropagation()}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Return-to-suggestions floating button */}
        <AnimatePresence>
          {!showWizard && !planningMode && !!suggestionPreviewRoute && !!suggestionPlaces?.length && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              className="absolute bottom-20 left-0 right-0 flex justify-center z-20 px-4 pointer-events-none"
            >
              <button
                onClick={handleReturnToSuggestionsList}
                className="pointer-events-auto flex items-center gap-2 px-4 py-2.5 rounded-full bg-white/95 dark:bg-gray-800/95 backdrop-blur shadow-lg text-sm font-semibold text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 active:scale-[0.97] transition-all"
              >
                <span className="text-spanish-orange">✦</span>
                Wróć do sugestii AI
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom Bar */}
      <AnimatePresence mode="wait">
        {planningMode ? (
          <motion.div
            key="planning-bar"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="shrink-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-t border-gray-200/50 dark:border-gray-700/50 flex items-center justify-center gap-3 px-4 h-20"
          >
            <button
              onClick={() => setShowWizard(true)}
              className="flex items-center gap-2 px-4 py-3 rounded-full font-semibold text-sm shadow-xl active:scale-[0.97] transition-all bg-spanish-bg dark:bg-gray-800 text-gray-700 dark:text-gray-200"
            >
              <List size={15} />
              Lista
            </button>
            {planningRouteSaved ? (
              <div className="flex items-center gap-1.5 px-4 py-3 rounded-full bg-green-500 text-white text-sm font-semibold shadow-lg">
                <Check size={13} />
                Zapisano
              </div>
            ) : (
              <button
                onClick={handleSavePlanningRoute}
                className="flex items-center gap-2 px-4 py-3 rounded-full bg-spanish-orange text-white font-bold text-sm shadow-xl active:scale-[0.97] transition-all"
              >
                <Bookmark size={15} />
                Zapisz trasę
              </button>
            )}
            <button
              onClick={exitPlanningMode}
              className="flex items-center gap-2 px-4 py-3 rounded-full bg-gray-800 dark:bg-gray-700 text-white font-semibold text-sm shadow-xl active:scale-[0.97] transition-all"
            >
              <X size={14} />
              Koniec
            </button>
          </motion.div>
        ) : (
          <motion.div
            key="nav-bar"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="shrink-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-t border-gray-200/50 dark:border-gray-700/50 flex items-center justify-around px-2 h-16"
          >
            <Button
              variant={view === 'map' ? 'primary' : 'neutral'}
              size="icon"
              className="w-12 h-12"
              onClick={() => setView('map')}
            >
              <MapIcon size={22} />
            </Button>
            <Button
              variant={view === 'favorites' ? 'primary' : 'neutral'}
              size="icon"
              className="w-12 h-12"
              onClick={() => setView('favorites')}
            >
              <Star size={22} className={view === 'favorites' ? '' : 'text-spanish-orange'} />
            </Button>
            <Button
              variant="primary"
              size="icon"
              className="w-14 h-14 shadow-lg -mt-5"
              onClick={() => setShowActionMenu(true)}
            >
              <Sparkles size={26} />
            </Button>
            <Button
              variant={view === 'discover' ? 'primary' : 'neutral'}
              size="icon"
              className="w-12 h-12"
              onClick={() => setView('discover')}
            >
              <Compass size={22} />
            </Button>
            <button
              onClick={() => setShowProfile(true)}
              className="w-11 h-11 rounded-full bg-spanish-bg shadow-neu-flat border-2 border-white dark:border-gray-700 overflow-hidden active:shadow-neu-pressed transition-all"
            >
              <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${userProfile?.avatar_url ?? session.user.email}`} alt="Avatar" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Center-button action menu — choose route planning or AI chat */}
      <AnimatePresence>
        {showActionMenu && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center"
            onClick={() => setShowActionMenu(false)}
          >
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: 0.96 }}
              transition={{ type: 'spring', damping: 26, stiffness: 320 }}
              onClick={e => e.stopPropagation()}
              className="relative mb-24 w-[min(92vw,22rem)] flex flex-col gap-3 px-4"
            >
              <button
                onClick={() => { setShowActionMenu(false); setShowWizard(true); }}
                className="flex items-center gap-3 p-4 rounded-2xl bg-white dark:bg-gray-800 shadow-xl active:scale-[0.98] transition-all"
              >
                <div className="w-11 h-11 rounded-xl bg-spanish-orange/15 flex items-center justify-center shrink-0">
                  <Route size={22} className="text-spanish-orange" />
                </div>
                <div className="text-left">
                  <p className="font-bold text-gray-800 dark:text-gray-100 text-sm">Planowanie trasy</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">Zbuduj trasę z AI i zobacz ją na mapie</p>
                </div>
              </button>
              <button
                onClick={() => { if (!locationReady) return; setShowActionMenu(false); setShowChat(true); }}
                className={`flex items-center gap-3 p-4 rounded-2xl bg-white dark:bg-gray-800 shadow-xl transition-all ${
                  locationReady ? 'active:scale-[0.98]' : 'opacity-60 cursor-wait'
                }`}
              >
                <div className="w-11 h-11 rounded-xl bg-spanish-orange/15 flex items-center justify-center shrink-0">
                  {locationReady
                    ? <MessageCircle size={22} className="text-spanish-orange" />
                    : <div className="w-5 h-5 rounded-full border-2 border-spanish-orange border-t-transparent animate-spin" />}
                </div>
                <div className="text-left">
                  <p className="font-bold text-gray-800 dark:text-gray-100 text-sm">Chat z AI</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    {locationReady ? 'Polecenia miejsc i dań w Twojej okolicy' : 'Pobieranie lokalizacji…'}
                  </p>
                </div>
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>

    {/* Trip Wizard — fixed overlay outside the main layout stack */}
    <AnimatePresence>
      {showWizard && (
        <Suspense fallback={null}>
        <TripWizard
          currentLocation={userLocation}
          onConfirm={(places, name, alreadySaved) => handleWizardConfirm(places, name, alreadySaved)}
          onClose={() => {
            setShowWizard(false);
            setSuggestionPreviewRoute(null);
            setPreviewPlaces(null);
            setSuggestionPlaces(null);
          }}
          initialRoute={
            planningMode
              ? { id: 'planning-current', name: planningRouteName || 'Aktualna trasa', places: planningPlaces, createdAt: new Date().toISOString(), pendingSuggestions: suggestionPreviewRoute?.pendingSuggestions }
              : (suggestionPreviewRoute ?? undefined)
          }
          onRouteUpdate={planningMode ? (places) => setPlanningPlaces(places) : undefined}
          onPreviewChange={(places) => setPreviewPlaces(places)}
          onSuggestionsChange={(places) => setSuggestionPlaces(places)}
          onShowSuggestionsOnMap={handleShowSuggestionsOnMap}
        />
        </Suspense>
      )}
    </AnimatePresence>

    {/* AI Chat — fixed overlay outside the main layout stack */}
    <AnimatePresence>
      {showChat && (
        <Suspense fallback={null}>
          <AIChat
            userId={session.user.id}
            currentLocation={userLocation}
            locationLabel={activeCityLabel}
            nearbyPlaces={nearbyPlaceNames}
            onClose={() => setShowChat(false)}
          />
        </Suspense>
      )}
    </AnimatePresence>
    </>
  );
}

export default App;

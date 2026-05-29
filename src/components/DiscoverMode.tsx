import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Heart, ExternalLink, Loader2, Sparkles, Map as MapIcon, X, Search, Plus, Check, Star, MapPin } from 'lucide-react';
import { Utensils, Landmark, Zap, Mountain } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { model } from '../lib/gemini';
import { supabase } from '../lib/supabase';
import { fetchPlacePhoto, searchNearbyFiltered } from '../lib/google-maps';
import type { DiscoverFilter, NearbyPlace } from '../lib/google-maps';
import type { DiscoveryPlace } from './DiscoveryCard';

const NEARBY_FILTERS: { id: DiscoverFilter; label: string; icon: React.ReactNode }[] = [
  { id: 'food', label: 'Restauracja', icon: <Utensils size={13} /> },
  { id: 'attraction', label: 'Atrakcje', icon: <Zap size={13} /> },
  { id: 'history', label: 'Historia', icon: <Landmark size={13} /> },
];

const CATEGORY_LABEL: Record<string, string> = {
  food: 'Restauracja', sightseeing: 'Kulturalne', activity: '4fun', scenery: 'Widoczki',
};
const CATEGORY_ICON: Record<string, React.ReactNode> = {
  food: <Utensils size={10} />,
  sightseeing: <Landmark size={10} />,
  activity: <Zap size={10} />,
  scenery: <Mountain size={10} />,
};
const CATEGORY_BADGE: Record<string, string> = {
  food: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  sightseeing: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  activity: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  scenery: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
};
const CATEGORY_FALLBACK: Record<string, string> = {
  food: 'from-orange-300 to-red-400',
  sightseeing: 'from-blue-300 to-indigo-500',
  activity: 'from-emerald-300 to-teal-500',
  scenery: 'from-amber-200 to-orange-400',
};

const MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
const OPENAI_KEY = import.meta.env.VITE_OPENAI_API_KEY ?? '';

async function runAIPrompt(prompt: string): Promise<any[]> {
  const provider = (localStorage.getItem('ai_provider') as 'openai' | 'gemini') || 'gemini';
  if (provider === 'gemini') {
    try {
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      const match = text.match(/\[[\s\S]*\]/);
      const parsed = JSON.parse(match ? match[0] : text);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.warn('Gemini failed, falling back to OpenAI:', e);
    }
  }
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_KEY}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'You are a travel assistant. Return only valid JSON with a "places" array.' },
        { role: 'user', content: prompt },
      ],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message ?? `OpenAI ${res.status}`);
  const text = data.choices?.[0]?.message?.content ?? '{}';
  const parsed = JSON.parse(text);
  return Array.isArray(parsed) ? parsed : (parsed.places ?? []);
}

async function generateText(prompt: string): Promise<string> {
  const provider = (localStorage.getItem('ai_provider') as 'openai' | 'gemini') || 'gemini';
  if (provider === 'gemini') {
    try {
      const result = await model.generateContent(prompt);
      return result.response.text().trim();
    } catch (e) {
      console.warn('Gemini failed, falling back to OpenAI:', e);
    }
  }
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_KEY}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'Jesteś ekspertem od podróżowania po Hiszpanii. Odpowiadasz po polsku.' },
        { role: 'user', content: prompt },
      ],
    }),
  });
  const data = await res.json();
  return (data.choices?.[0]?.message?.content ?? '').trim();
}

const staticMapUrl = (lat: number, lng: number, type: 'satellite' | 'roadmap') =>
  `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=16&size=600x400&maptype=${type}&markers=color:red%7C${lat},${lng}&key=${MAPS_KEY}`;

// Run async tasks with a bounded concurrency so we never hit Google Places
// with more than `limit` photo requests at once.
async function runPool<T>(items: T[], limit: number, worker: (item: T) => Promise<void>) {
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const i = cursor++;
      await worker(items[i]);
    }
  });
  await Promise.all(runners);
}

interface DiscoverItem {
  id: string;
  name: string;
  description: string;
  category: string;
  lat: number;
  lng: number;
  photoUrl: string | null;
  rating?: number | null;
  userRatingsTotal?: number | null;
  aiDescription?: string;
  generatingDesc: boolean;
  savingFav: boolean;
  favError?: string;
  addingPlan: boolean;
  inPlan?: boolean;
  planError?: string;
}

function nearbyToItem(p: NearbyPlace): DiscoverItem {
  return {
    id: p.id,
    name: p.name,
    description: '',
    category: p.category,
    lat: p.lat,
    lng: p.lng,
    photoUrl: p.photoUrl,
    rating: p.rating,
    userRatingsTotal: p.userRatingsTotal,
    generatingDesc: false,
    savingFav: false,
    addingPlan: false,
  };
}

function dbRowToItem(p: any): DiscoverItem {
  return {
    id: crypto.randomUUID(),
    name: String(p.name),
    description: String(p.description),
    category: String(p.category ?? 'sightseeing'),
    lat: Number(p.lat),
    lng: Number(p.lng),
    photoUrl: p.photo_url ?? null,
    generatingDesc: false,
    savingFav: false,
    addingPlan: false,
  };
}

interface DiscoverModeProps {
  onFavorite: (place: DiscoveryPlace) => Promise<string | null>;
  onRemoveFavorite: (id: string) => void;
  onAddToPlan: (place: DiscoveryPlace) => Promise<string | null>;
  favorites: any[];
  userLocation: { lat: number; lng: number };
}

function SkeletonCard() {
  return (
    <div className="rounded-3xl overflow-hidden bg-white dark:bg-gray-800 shadow-neu-flat animate-pulse">
      <div className="h-56 bg-gray-200 dark:bg-gray-700" />
      <div className="p-4 space-y-3">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded-full w-3/4" />
        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full w-full" />
        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full w-5/6" />
        <div className="flex gap-2 mt-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-9 bg-gray-200 dark:bg-gray-700 rounded-2xl flex-1" />
          ))}
        </div>
      </div>
    </div>
  );
}

function DiscoverCard({
  item,
  liked,
  onLike,
  onGenerateDesc,
  onAddToPlan,
}: {
  item: DiscoverItem;
  liked: boolean;
  onLike: () => void;
  onGenerateDesc: () => void;
  onAddToPlan: () => void;
}) {
  const satUrl = staticMapUrl(item.lat, item.lng, 'satellite');
  const [imgSrc, setImgSrc] = useState(() => item.photoUrl ?? satUrl);
  const [showFallback, setShowFallback] = useState(false);
  const mapsUrl = `https://maps.google.com/?q=${item.lat},${item.lng}`;
  const badge = CATEGORY_BADGE[item.category] ?? 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300';
  const fallback = CATEGORY_FALLBACK[item.category] ?? 'from-gray-300 to-gray-400';

  useEffect(() => {
    setImgSrc(item.photoUrl ?? satUrl);
    setShowFallback(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.photoUrl]);

  const handleImgError = () => {
    if (imgSrc !== satUrl) { setImgSrc(satUrl); }
    else { setShowFallback(true); }
  };

  return (
    <motion.div layout className="rounded-3xl overflow-hidden bg-white dark:bg-gray-800 shadow-neu-flat">
      {/* Hero */}
      <div className="relative h-56 overflow-hidden bg-gray-100 dark:bg-gray-700">
        {!showFallback ? (
          <img
            src={imgSrc}
            alt={item.name}
            className="w-full h-full object-cover"
            onError={handleImgError}
          />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${fallback} flex items-center justify-center`}>
            <MapIcon size={48} className="text-white/30" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <h3 className="text-lg font-bold text-white leading-tight drop-shadow-md line-clamp-2">
            {item.name}
          </h3>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${badge}`}>
              {CATEGORY_ICON[item.category]}
              {CATEGORY_LABEL[item.category] ?? item.category}
            </span>
            {item.rating != null && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-white/90 text-gray-800">
                <Star size={10} className="fill-amber-400 text-amber-400" />
                {item.rating.toFixed(1)}
                {item.userRatingsTotal != null && (
                  <span className="text-gray-500 font-normal">({item.userRatingsTotal.toLocaleString('pl-PL')})</span>
                )}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Base description */}
      {item.description && (
        <div className="px-4 pt-3 pb-1">
          <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
            {item.description}
          </p>
        </div>
      )}

      {/* AI extended description */}
      <AnimatePresence>
        {item.aiDescription && (
          <motion.div
            key="ai-desc"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mx-4 mb-1 mt-2 p-3 rounded-2xl bg-[#F5F5F0] dark:bg-gray-700/60 border border-orange-200/60 dark:border-orange-800/30">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Sparkles size={11} className="text-spanish-orange" />
                <span className="text-xs font-semibold text-spanish-orange">Opis AI</span>
              </div>
              <p className="text-xs text-gray-700 dark:text-gray-200 leading-relaxed">{item.aiDescription}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {(item.favError || item.planError) && (
        <p className="px-4 pb-1 text-xs text-red-500">{item.favError ?? item.planError}</p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-1.5 px-3 pb-4 pt-2">
        <button
          onClick={onAddToPlan}
          disabled={item.addingPlan || item.inPlan}
          className={`flex items-center gap-1 px-3 py-2 rounded-2xl text-xs font-semibold transition-all active:scale-95 disabled:cursor-default ${
            item.inPlan
              ? 'bg-emerald-500 text-white shadow-sm'
              : 'bg-spanish-orange text-white shadow-sm'
          }`}
        >
          {item.addingPlan ? (
            <Loader2 size={13} className="animate-spin" />
          ) : item.inPlan ? (
            <Check size={13} />
          ) : (
            <Plus size={13} />
          )}
          {item.inPlan ? 'W planie' : 'Plan'}
        </button>

        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 px-3 py-2 rounded-2xl text-xs font-semibold bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 active:scale-95 transition-all"
        >
          <ExternalLink size={13} />
          Maps
        </a>

        <button
          onClick={onGenerateDesc}
          disabled={item.generatingDesc || !!item.aiDescription}
          className={`flex items-center gap-1 px-3 py-2 rounded-2xl text-xs font-semibold transition-all active:scale-95 flex-1 justify-center disabled:opacity-60 ${
            item.aiDescription
              ? 'bg-orange-50 dark:bg-orange-900/20 text-spanish-orange'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
          }`}
        >
          {item.generatingDesc ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <Sparkles size={13} />
          )}
          Opis AI
        </button>

        <button
          onClick={onLike}
          disabled={item.savingFav}
          className={`p-2.5 rounded-2xl transition-all active:scale-90 disabled:cursor-default ${
            liked
              ? 'bg-red-500 text-white shadow-sm'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500'
          }`}
        >
          {item.savingFav ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Heart size={16} className={liked ? 'fill-white' : ''} />
          )}
        </button>
      </div>
    </motion.div>
  );
}

const DiscoverMode: React.FC<DiscoverModeProps> = ({ onFavorite, onRemoveFavorite, onAddToPlan, favorites, userLocation }) => {
  const [items, setItems] = useState<DiscoverItem[]>([]);
  const [loading, setLoading] = useState(true);
  const pendingLikesRef = useRef<Set<string>>(new Set());

  const [cityInput, setCityInput] = useState('');
  const [cityQuery, setCityQuery] = useState('');
  const [cityItems, setCityItems] = useState<DiscoverItem[]>([]);
  const [cityLoading, setCityLoading] = useState(false);
  const [cityError, setCityError] = useState(false);

  const [nearbyFilter, setNearbyFilter] = useState<DiscoverFilter | null>(null);
  const [nearbyItems, setNearbyItems] = useState<DiscoverItem[]>([]);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [nearbyError, setNearbyError] = useState(false);

  const loadPhotos = useCallback((batch: DiscoverItem[], setter: React.Dispatch<React.SetStateAction<DiscoverItem[]>>) => {
    runPool(batch, 3, async (item) => {
      if (item.photoUrl) return;
      const url = await fetchPlacePhoto(item.lat, item.lng);
      if (url) setter(prev => prev.map(i => i.id === item.id ? { ...i, photoUrl: url } : i));
    });
  }, []);

  // Default landing list = curated Alicante places from Supabase (no AI).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase
          .from('curated_places')
          .select('*')
          .ilike('city', 'Alicante')
          .order('sort_order', { ascending: true });
        if (!cancelled && data) {
          const curated = data.map(dbRowToItem);
          setItems(curated);
          loadPhotos(curated, setItems);
        }
      } catch (e) {
        console.warn('Alicante feed fetch failed:', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [loadPhotos]);

  const updateItem = useCallback((id: string, patch: Partial<DiscoverItem>) =>
    setItems(prev => prev.map(i => i.id === id ? { ...i, ...patch } : i)), []);

  const updateCityItem = useCallback((id: string, patch: Partial<DiscoverItem>) =>
    setCityItems(prev => prev.map(i => i.id === id ? { ...i, ...patch } : i)), []);

  const handleLike = useCallback(async (item: DiscoverItem) => {
    if (item.savingFav || pendingLikesRef.current.has(item.name)) return;
    const allExisting = favorites.filter((f: any) => f.name === item.name);
    if (allExisting.length > 0) {
      allExisting.forEach((fav: any) => onRemoveFavorite(fav.id));
      return;
    }
    pendingLikesRef.current.add(item.name);
    updateItem(item.id, { savingFav: true, favError: undefined });
    const err = await onFavorite({
      lat: item.lat, lng: item.lng, name: item.name, category: item.category,
      placeId: `ai:${item.lat.toFixed(5)},${item.lng.toFixed(5)}`, photoUrl: item.photoUrl,
    });
    pendingLikesRef.current.delete(item.name);
    updateItem(item.id, { savingFav: false, favError: err ?? undefined });
  }, [onFavorite, onRemoveFavorite, favorites, updateItem]);

  const handleGenerateDesc = useCallback(async (item: DiscoverItem) => {
    if (item.generatingDesc || item.aiDescription) return;
    updateItem(item.id, { generatingDesc: true });
    try {
      const prompt = `Napisz szczegółowy opis turystyczny (3-4 zdania po polsku) miejsca "${item.name}" w Hiszpanii.
Uwzględnij: co czyni je wyjątkowym, najlepszy czas na wizytę, co zobaczyć lub zrobić, praktyczne wskazówki.
Tylko czysty tekst, bez formatowania.`;
      const desc = await generateText(prompt);
      updateItem(item.id, { generatingDesc: false, aiDescription: desc });
    } catch {
      updateItem(item.id, { generatingDesc: false });
    }
  }, [updateItem]);

  const handleAddToPlan = useCallback(async (item: DiscoverItem) => {
    if (item.addingPlan || item.inPlan) return;
    updateItem(item.id, { addingPlan: true, planError: undefined });
    const err = await onAddToPlan({
      lat: item.lat, lng: item.lng, name: item.name, category: item.category,
      placeId: `ai:${item.lat.toFixed(5)},${item.lng.toFixed(5)}`, photoUrl: item.photoUrl,
    });
    updateItem(item.id, { addingPlan: false, inPlan: !err, planError: err ?? undefined });
  }, [onAddToPlan, updateItem]);

  const handleCityLike = useCallback(async (item: DiscoverItem) => {
    if (item.savingFav || pendingLikesRef.current.has(item.name)) return;
    const allExisting = favorites.filter((f: any) => f.name === item.name);
    if (allExisting.length > 0) {
      allExisting.forEach((fav: any) => onRemoveFavorite(fav.id));
      return;
    }
    pendingLikesRef.current.add(item.name);
    updateCityItem(item.id, { savingFav: true, favError: undefined });
    const err = await onFavorite({
      lat: item.lat, lng: item.lng, name: item.name, category: item.category,
      placeId: `ai:${item.lat.toFixed(5)},${item.lng.toFixed(5)}`, photoUrl: item.photoUrl,
    });
    pendingLikesRef.current.delete(item.name);
    updateCityItem(item.id, { savingFav: false, favError: err ?? undefined });
  }, [onFavorite, onRemoveFavorite, favorites, updateCityItem]);

  const handleCityGenerateDesc = useCallback(async (item: DiscoverItem) => {
    if (item.generatingDesc || item.aiDescription) return;
    updateCityItem(item.id, { generatingDesc: true });
    try {
      const prompt = `Napisz zachęcający opis turystyczny (3-4 zdania po polsku) miejsca "${item.name}" w Hiszpanii.
Uwzględnij: co czyni je wyjątkowym, atmosferę i nastrój tego miejsca, co poczujesz lub zobaczysz, dlaczego musisz tu być.
Pisz w stylu inspirującym, zachęcającym do odwiedzin. Tylko czysty tekst, bez formatowania.`;
      const desc = await generateText(prompt);
      updateCityItem(item.id, { generatingDesc: false, aiDescription: desc });
    } catch {
      updateCityItem(item.id, { generatingDesc: false });
    }
  }, [updateCityItem]);

  const handleCityAddToPlan = useCallback(async (item: DiscoverItem) => {
    if (item.addingPlan || item.inPlan) return;
    updateCityItem(item.id, { addingPlan: true, planError: undefined });
    const err = await onAddToPlan({
      lat: item.lat, lng: item.lng, name: item.name, category: item.category,
      placeId: `ai:${item.lat.toFixed(5)},${item.lng.toFixed(5)}`, photoUrl: item.photoUrl,
    });
    updateCityItem(item.id, { addingPlan: false, inPlan: !err, planError: err ?? undefined });
  }, [onAddToPlan, updateCityItem]);

  const updateNearbyItem = useCallback((id: string, patch: Partial<DiscoverItem>) =>
    setNearbyItems(prev => prev.map(i => i.id === id ? { ...i, ...patch } : i)), []);

  const handleNearbyLike = useCallback(async (item: DiscoverItem) => {
    if (item.savingFav || pendingLikesRef.current.has(item.name)) return;
    const allExisting = favorites.filter((f: any) => f.name === item.name);
    if (allExisting.length > 0) {
      allExisting.forEach((fav: any) => onRemoveFavorite(fav.id));
      return;
    }
    pendingLikesRef.current.add(item.name);
    updateNearbyItem(item.id, { savingFav: true, favError: undefined });
    const err = await onFavorite({
      lat: item.lat, lng: item.lng, name: item.name, category: item.category,
      placeId: `ai:${item.lat.toFixed(5)},${item.lng.toFixed(5)}`, photoUrl: item.photoUrl,
    });
    pendingLikesRef.current.delete(item.name);
    updateNearbyItem(item.id, { savingFav: false, favError: err ?? undefined });
  }, [onFavorite, onRemoveFavorite, favorites, updateNearbyItem]);

  const handleNearbyGenerateDesc = useCallback(async (item: DiscoverItem) => {
    if (item.generatingDesc || item.aiDescription) return;
    updateNearbyItem(item.id, { generatingDesc: true });
    try {
      const prompt = `Napisz zachęcający opis turystyczny (3-4 zdania po polsku) miejsca "${item.name}" w Hiszpanii.
Uwzględnij: co czyni je wyjątkowym, atmosferę i nastrój tego miejsca, co poczujesz lub zobaczysz, dlaczego musisz tu być.
Pisz w stylu inspirującym, zachęcającym do odwiedzin. Tylko czysty tekst, bez formatowania.`;
      const desc = await generateText(prompt);
      updateNearbyItem(item.id, { generatingDesc: false, aiDescription: desc });
    } catch {
      updateNearbyItem(item.id, { generatingDesc: false });
    }
  }, [updateNearbyItem]);

  const handleNearbyAddToPlan = useCallback(async (item: DiscoverItem) => {
    if (item.addingPlan || item.inPlan) return;
    updateNearbyItem(item.id, { addingPlan: true, planError: undefined });
    const err = await onAddToPlan({
      lat: item.lat, lng: item.lng, name: item.name, category: item.category,
      placeId: `ai:${item.lat.toFixed(5)},${item.lng.toFixed(5)}`, photoUrl: item.photoUrl,
    });
    updateNearbyItem(item.id, { addingPlan: false, inPlan: !err, planError: err ?? undefined });
  }, [onAddToPlan, updateNearbyItem]);

  const fetchNearby = useCallback(async (filter: DiscoverFilter) => {
    setNearbyLoading(true);
    setNearbyError(false);
    setNearbyItems([]);
    try {
      const places = await searchNearbyFiltered(userLocation.lat, userLocation.lng, filter, 5000);
      setNearbyItems(places.map(nearbyToItem));
    } catch (e) {
      console.error('fetchNearby error:', e);
      setNearbyError(true);
    } finally {
      setNearbyLoading(false);
    }
  }, [userLocation.lat, userLocation.lng]);

  const handleNearbyFilter = useCallback((filter: DiscoverFilter) => {
    // Toggling a chip is its own mode — clear any active city search.
    setCityQuery('');
    setCityInput('');
    setCityItems([]);
    setCityError(false);
    if (nearbyFilter === filter) {
      setNearbyFilter(null);
      setNearbyItems([]);
      return;
    }
    setNearbyFilter(filter);
    fetchNearby(filter);
  }, [nearbyFilter, fetchNearby]);

  const fetchCityPlaces = useCallback(async (city: string) => {
    setCityLoading(true);
    setCityItems([]);
    setCityError(false);

    const curatedNames = new Set<string>();
    let hadCurated = false;

    // 1) Curated places from the database — instant first paint.
    try {
      const { data } = await supabase
        .from('curated_places')
        .select('*')
        .ilike('city', city)
        .order('sort_order', { ascending: true });
      if (data && data.length > 0) {
        hadCurated = true;
        const curated = data.map(dbRowToItem);
        curated.forEach(c => curatedNames.add(c.name));
        setCityItems(curated);
        setCityLoading(false); // list is visible already
        runPool(curated, 3, async (item) => {
          if (item.photoUrl) return;
          const url = await fetchPlacePhoto(item.lat, item.lng);
          if (url) setCityItems(prev => prev.map(i => i.id === item.id ? { ...i, photoUrl: url } : i));
        });
      }
    } catch (e) {
      console.warn('curated_places fetch failed:', e);
    }

    // 2) Fill the rest with AI (skips anything already shown from the DB).
    const excludeStr = curatedNames.size > 0
      ? `\nNie powtarzaj tych miejsc (są już na liście): ${[...curatedNames].join(', ')}.`
      : '';
    const prompt = `Jesteś ekspertem od turystyki w Hiszpanii. Zaproponuj 12 wartych odwiedzenia miejsc w mieście lub regionie: ${city}.

Zwróć TYLKO tablicę JSON (zero tekstu poza tablicą):
[{"name":"...","description":"...","category":"...","lat":0.0,"lng":0.0}]

Zasady:
- description: dokładnie 2 zdania po polsku — dlaczego warto i co zobaczysz
- category: dokładnie jedno z: "food", "sightseeing", "activity", "scenery"
- Prawdziwe miejsca z dokładnymi współrzędnymi GPS${excludeStr}
Zwróć dokładnie 12 miejsc.`;
    try {
      const raw = await runAIPrompt(prompt);
      const parsed = raw
        .filter(p => p.name && p.description && p.lat && p.lng)
        .filter(p => !curatedNames.has(p.name))
        .map(p => ({
          id: crypto.randomUUID(),
          name: String(p.name),
          description: String(p.description),
          category: String(p.category ?? 'sightseeing'),
          lat: Number(p.lat),
          lng: Number(p.lng),
          photoUrl: null,
          generatingDesc: false,
          savingFav: false,
          addingPlan: false,
        }));
      setCityItems(prev => [...prev, ...parsed]);
      runPool(parsed, 3, async (item) => {
        const url = await fetchPlacePhoto(item.lat, item.lng);
        if (url) setCityItems(prev => prev.map(i => i.id === item.id ? { ...i, photoUrl: url } : i));
      });
    } catch (e) {
      console.error('fetchCityPlaces error:', e);
      if (!hadCurated) setCityError(true); // only a hard error if DB gave us nothing
    } finally {
      setCityLoading(false);
    }
  }, []);

  const handleCitySearch = () => {
    const q = cityInput.trim();
    if (!q || cityLoading) return;
    // City search is its own mode — clear any active nearby filter.
    setNearbyFilter(null);
    setNearbyItems([]);
    setCityQuery(q);
    fetchCityPlaces(q);
  };

  const clearCitySearch = () => {
    setCityQuery('');
    setCityInput('');
    setCityItems([]);
    setCityError(false);
  };

  return (
    <>
      <div className="h-full overflow-y-auto bg-[#F5F5F0] dark:bg-gray-900">
        {/* Sticky header */}
        <div className="sticky top-0 z-10 bg-[#F5F5F0]/90 dark:bg-gray-900/90 backdrop-blur px-4 pt-4 pb-3">
          <div className="flex items-center gap-2 mb-2.5">
            <Sparkles size={18} className="text-spanish-orange shrink-0" />
            <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">Odkrywaj Hiszpanię</h2>
            {!loading && !cityQuery && !nearbyFilter && (
              <span className="text-xs text-gray-400 dark:text-gray-500 ml-auto">Alicante · {items.length}</span>
            )}
            {cityQuery && !cityLoading && (
              <span className="text-xs text-gray-400 dark:text-gray-500 ml-auto">{cityItems.length} w {cityQuery}</span>
            )}
            {nearbyFilter && !nearbyLoading && !nearbyError && (
              <span className="text-xs text-gray-400 dark:text-gray-500 ml-auto">{nearbyItems.length} w pobliżu</span>
            )}
          </div>

          {/* Search bar */}
          <div className="flex gap-2">
            <div className="flex-1 flex items-center gap-2 bg-white dark:bg-gray-800 rounded-2xl px-3 shadow-neu-flat">
              <button
                type="button"
                onClick={handleCitySearch}
                className="text-gray-400 shrink-0 active:scale-90 transition-transform"
              >
                <Search size={14} />
              </button>
              <input
                type="text"
                value={cityInput}
                onChange={e => setCityInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCitySearch()}
                placeholder="Szukaj miasta… np. Barcelona"
                className="flex-1 py-2.5 text-sm bg-transparent outline-none text-gray-700 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500"
              />
              {cityQuery && (
                <button
                  type="button"
                  onClick={clearCitySearch}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={handleCitySearch}
              disabled={!cityInput.trim() || cityLoading}
              className="px-3 py-2 rounded-2xl bg-spanish-orange text-white disabled:opacity-50 active:scale-95 transition-all"
            >
              {cityLoading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
            </button>
          </div>

          {/* Nearby filter chips */}
          <div className="flex items-center gap-2 mt-2.5 overflow-x-auto no-scrollbar">
            <span className="inline-flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500 shrink-0">
              <MapPin size={12} /> W pobliżu
            </span>
            {NEARBY_FILTERS.map(f => {
              const active = nearbyFilter === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => handleNearbyFilter(f.id)}
                  className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold shrink-0 active:scale-95 transition-all ${
                    active
                      ? 'bg-spanish-orange text-white shadow-sm'
                      : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 shadow-neu-flat'
                  }`}
                >
                  {f.icon}
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="px-4 pb-6 space-y-2">
          {nearbyFilter ? (
            nearbyLoading ? (
              [1, 2, 3].map(i => <SkeletonCard key={i} />)
            ) : nearbyError ? (
              <div className="flex flex-col items-center gap-2 py-12 text-center">
                <span className="text-2xl">⚠️</span>
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">Błąd pobierania miejsc</p>
                <p className="text-xs text-gray-400">Sprawdź połączenie i spróbuj ponownie.</p>
                <button
                  onClick={() => fetchNearby(nearbyFilter)}
                  className="mt-2 px-4 py-2 rounded-2xl bg-spanish-orange text-white text-sm font-semibold active:scale-95 transition-transform"
                >
                  Spróbuj ponownie
                </button>
              </div>
            ) : nearbyItems.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-12 text-center">
                <span className="text-2xl">📍</span>
                <p className="text-sm text-gray-500 dark:text-gray-400">Brak miejsc w promieniu 5 km</p>
              </div>
            ) : (
              nearbyItems.map((item, idx) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(idx * 0.04, 0.3), duration: 0.3, ease: 'easeOut' }}
                >
                  <DiscoverCard
                    item={item}
                    liked={favorites.some((f: any) => f.name === item.name)}
                    onLike={() => handleNearbyLike(item)}
                    onGenerateDesc={() => handleNearbyGenerateDesc(item)}
                    onAddToPlan={() => handleNearbyAddToPlan(item)}
                  />
                </motion.div>
              ))
            )
          ) : cityQuery ? (
            cityLoading ? (
              [1, 2, 3].map(i => <SkeletonCard key={i} />)
            ) : cityError ? (
              <div className="flex flex-col items-center gap-2 py-12 text-center">
                <span className="text-2xl">⚠️</span>
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">Błąd pobierania miejsc</p>
                <p className="text-xs text-gray-400">Sprawdź połączenie i spróbuj ponownie.</p>
                <button
                  onClick={() => fetchCityPlaces(cityQuery)}
                  className="mt-2 px-4 py-2 rounded-2xl bg-spanish-orange text-white text-sm font-semibold active:scale-95 transition-transform"
                >
                  Spróbuj ponownie
                </button>
              </div>
            ) : cityItems.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-12 text-center">
                <span className="text-2xl">🔍</span>
                <p className="text-sm text-gray-500 dark:text-gray-400">Brak wyników dla <strong>{cityQuery}</strong></p>
              </div>
            ) : (
              cityItems.map((item, idx) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(idx * 0.04, 0.3), duration: 0.3, ease: 'easeOut' }}
                >
                  <DiscoverCard
                    item={item}
                    liked={favorites.some((f: any) => f.name === item.name)}
                    onLike={() => handleCityLike(item)}
                    onGenerateDesc={() => handleCityGenerateDesc(item)}
                    onAddToPlan={() => handleCityAddToPlan(item)}
                  />
                </motion.div>
              ))
            )
          ) : (
            <>
              {loading ? (
                [1, 2, 3].map(i => <SkeletonCard key={i} />)
              ) : (
                items.map((item, idx) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(idx * 0.04, 0.25), duration: 0.3, ease: 'easeOut' }}
                  >
                    <DiscoverCard
                      item={item}
                      liked={favorites.some((f: any) => f.name === item.name)}
                      onLike={() => handleLike(item)}
                      onGenerateDesc={() => handleGenerateDesc(item)}
                      onAddToPlan={() => handleAddToPlan(item)}
                    />
                  </motion.div>
                ))
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default DiscoverMode;

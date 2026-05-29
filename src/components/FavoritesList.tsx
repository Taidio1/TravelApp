import React, { useState, useEffect, useRef } from 'react';
import { X, Trash2, ExternalLink, Star, MapPin, Map as MapIcon, Utensils, Landmark, Zap, Mountain } from 'lucide-react';
import { motion } from 'framer-motion';
import { fetchPlacePhoto } from '../lib/google-maps';

const MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

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

const staticMapUrl = (lat: number, lng: number) =>
  `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=16&size=600x400&maptype=satellite&markers=color:red%7C${lat},${lng}&key=${MAPS_KEY}`;

const FILTERS = [
  { id: 'all', label: 'Wszystkie' },
  { id: 'food', label: 'Restauracje' },
  { id: 'sightseeing', label: 'Kulturalne' },
  { id: 'activity', label: '4fun' },
  { id: 'scenery', label: 'Widoczki' },
] as const;

type FilterId = typeof FILTERS[number]['id'];

interface FavoritesListProps {
  favorites: any[];
  onClose: () => void;
  onRemove: (id: string) => void;
  onShowOnMap?: (fav: any) => void;
}

function FavoriteCard({
  fav,
  onRemove,
  onShowOnMap,
}: {
  fav: any;
  onRemove: () => void;
  onShowOnMap?: () => void;
}) {
  const lat = Number(fav.lat);
  const lng = Number(fav.lng);
  const satUrl = staticMapUrl(lat, lng);
  const [imgSrc, setImgSrc] = useState(() => fav.photo_url ?? satUrl);
  const [showFallback, setShowFallback] = useState(false);
  const triedRefreshRef = useRef(false);
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fav.name)}${fav.google_place_id ? `&query_place_id=${fav.google_place_id}` : ''}`;
  const badge = CATEGORY_BADGE[fav.category] ?? 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300';
  const fallback = CATEGORY_FALLBACK[fav.category] ?? 'from-gray-300 to-gray-400';

  useEffect(() => {
    setImgSrc(fav.photo_url ?? satUrl);
    setShowFallback(false);
    triedRefreshRef.current = false;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fav.photo_url]);

  // Stored photo_url is a Google Places getURI() link that expires. When it
  // fails, fetch a fresh one once, then fall back to the satellite tile, then
  // to the category gradient.
  const handleImgError = async () => {
    if (!triedRefreshRef.current && Number.isFinite(lat) && Number.isFinite(lng)) {
      triedRefreshRef.current = true;
      const fresh = await fetchPlacePhoto(lat, lng);
      if (fresh && fresh !== imgSrc) { setImgSrc(fresh); return; }
    }
    if (imgSrc !== satUrl) { setImgSrc(satUrl); return; }
    setShowFallback(true);
  };

  return (
    <motion.div layout className="rounded-3xl overflow-hidden bg-white dark:bg-gray-800 shadow-neu-flat">
      {/* Hero */}
      <div className="relative h-56 overflow-hidden bg-gray-100 dark:bg-gray-700">
        {!showFallback ? (
          <img
            src={imgSrc}
            referrerPolicy="no-referrer"
            alt={fav.name}
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
            {fav.name}
          </h3>
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold mt-1 ${badge}`}>
            {CATEGORY_ICON[fav.category]}
            {CATEGORY_LABEL[fav.category] ?? fav.category}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5 px-3 pb-4 pt-3">
        {onShowOnMap && (
          <button
            onClick={onShowOnMap}
            className="flex items-center gap-1 px-3 py-2 rounded-2xl text-xs font-semibold bg-spanish-orange text-white shadow-sm active:scale-95 transition-all"
          >
            <MapPin size={13} />
            Na mapie
          </button>
        )}

        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 px-3 py-2 rounded-2xl text-xs font-semibold bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 active:scale-95 transition-all flex-1 justify-center"
        >
          <ExternalLink size={13} />
          Maps
        </a>

        <button
          onClick={onRemove}
          className="p-2.5 rounded-2xl bg-gray-100 dark:bg-gray-700 text-spanish-red active:scale-90 transition-all"
          title="Usuń z ulubionych"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </motion.div>
  );
}

const FavoritesList: React.FC<FavoritesListProps> = ({ favorites, onClose, onRemove, onShowOnMap }) => {
  const [activeFilter, setActiveFilter] = useState<FilterId>('all');

  const filtered = activeFilter === 'all'
    ? favorites
    : favorites.filter((f) => f.category === activeFilter);

  return (
    <div className="h-full overflow-y-auto bg-[#F5F5F0] dark:bg-gray-900">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 bg-[#F5F5F0]/90 dark:bg-gray-900/90 backdrop-blur px-4 pt-4 pb-3">
        <div className="flex items-center gap-2 mb-2.5">
          <Star size={18} className="text-spanish-orange fill-spanish-orange shrink-0" />
          <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">Moje ulubione</h2>
          {favorites.length > 0 && (
            <span className="text-xs text-gray-400 dark:text-gray-500 ml-auto">{favorites.length} miejsc</span>
          )}
          <button onClick={onClose} className="p-1 text-gray-400 dark:text-gray-500 shrink-0 ml-1 active:scale-90 transition-transform">
            <X size={20} />
          </button>
        </div>

        {/* Category filter chips */}
        {favorites.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-hide">
            {FILTERS.map(f => (
              <button
                key={f.id}
                onClick={() => setActiveFilter(f.id)}
                className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                  activeFilter === f.id
                    ? 'bg-spanish-orange text-white shadow-sm'
                    : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 shadow-neu-flat'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="px-4 pb-6 space-y-2">
        {filtered.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 py-12 text-center">
            {favorites.length === 0
              ? 'Nic tu jeszcze nie ma. Dodaj miejsca z mapy!'
              : 'Brak miejsc w tej kategorii.'}
          </p>
        ) : (
          filtered.map((f, idx) => (
            <motion.div
              key={f.id}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(idx * 0.04, 0.25), duration: 0.3, ease: 'easeOut' }}
            >
              <FavoriteCard
                fav={f}
                onRemove={() => onRemove(f.id)}
                onShowOnMap={onShowOnMap ? () => onShowOnMap(f) : undefined}
              />
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
};

export default FavoritesList;

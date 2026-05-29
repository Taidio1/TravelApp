import React, { useState } from 'react';
import Card from './Card';
import { X, Trash2, ExternalLink, Star, MapPin, Utensils, Landmark, Zap, Mountain } from 'lucide-react';

const CATEGORY_LABEL: Record<string, string> = {
  food: 'Restauracja', sightseeing: 'Kulturalne', activity: '4fun', scenery: 'Widoczki',
};
const CATEGORY_ICON: Record<string, React.ReactNode> = {
  food: <Utensils size={11} />, sightseeing: <Landmark size={11} />, activity: <Zap size={11} />, scenery: <Mountain size={11} />,
};
const CATEGORY_BADGE: Record<string, string> = {
  food: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  sightseeing: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  activity: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  scenery: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
};

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

const FavoritesList: React.FC<FavoritesListProps> = ({ favorites, onClose, onRemove, onShowOnMap }) => {
  const [activeFilter, setActiveFilter] = useState<FilterId>('all');

  const filtered = activeFilter === 'all'
    ? favorites
    : favorites.filter((f) => f.category === activeFilter);

  return (
    <Card className="flex flex-col gap-3 w-full max-w-sm max-h-[72vh]">
      <div className="flex justify-between items-center shrink-0">
        <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
          <Star size={18} className="text-spanish-orange fill-spanish-orange" /> Moje ulubione
          {favorites.length > 0 && (
            <span className="text-xs font-normal text-gray-400 dark:text-gray-500">({favorites.length})</span>
          )}
        </h3>
        <button onClick={onClose} className="p-1.5 text-gray-400 dark:text-gray-500 shrink-0">
          <X size={20} />
        </button>
      </div>

      {/* Category filter chips */}
      {favorites.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-0.5 shrink-0 scrollbar-hide">
          {FILTERS.map(f => (
            <button
              key={f.id}
              onClick={() => setActiveFilter(f.id)}
              className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                activeFilter === f.id
                  ? 'bg-spanish-orange text-white shadow-sm'
                  : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 shadow-neu-flat'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400 py-6 text-center">
          {favorites.length === 0
            ? 'Nic tu jeszcze nie ma. Dodaj miejsca z mapy!'
            : 'Brak miejsc w tej kategorii.'}
        </p>
      ) : (
        <ul className="flex flex-col gap-2 overflow-y-auto">
          {filtered.map((f) => {
            const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(f.name)}${f.google_place_id ? `&query_place_id=${f.google_place_id}` : ''}`;
            return (
              <li
                key={f.id}
                className="flex items-center gap-3 bg-white dark:bg-gray-700 rounded-2xl p-2.5 shadow-neu-flat"
              >
                {f.photo_url ? (
                  <img
                    src={f.photo_url}
                    referrerPolicy="no-referrer"
                    alt=""
                    className="w-14 h-14 rounded-xl object-cover shrink-0"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-xl bg-spanish-bg dark:bg-gray-600 flex items-center justify-center shrink-0">
                    <MapPin size={18} className="text-gray-400" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate leading-tight">{f.name}</p>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold mt-1 ${CATEGORY_BADGE[f.category] ?? 'bg-gray-100 text-gray-600'}`}>
                    {CATEGORY_ICON[f.category]}
                    {CATEGORY_LABEL[f.category] ?? f.category}
                  </span>
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  {onShowOnMap && (
                    <button
                      onClick={() => onShowOnMap(f)}
                      className="p-2 text-spanish-orange rounded-xl active:scale-90 transition-transform"
                      title="Pokaż na mapie"
                    >
                      <MapPin size={16} />
                    </button>
                  )}
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 text-blue-500 rounded-xl"
                    title="Otwórz w Google Maps"
                  >
                    <ExternalLink size={16} />
                  </a>
                  <button
                    onClick={() => onRemove(f.id)}
                    className="p-2 text-spanish-red rounded-xl active:scale-90 transition-transform"
                    title="Usuń z ulubionych"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
};

export default FavoritesList;

import React from 'react';
import Card from './Card';
import { X, Trash2, ExternalLink, Star } from 'lucide-react';

const CATEGORY_LABEL: Record<string, string> = {
  food: '🍽️ Restauracja',
  sightseeing: '🏛️ Kulturalne',
  activity: '🎢 4fun',
  scenery: '🌅 Widoczki',
};

interface FavoritesListProps {
  favorites: any[];
  onClose: () => void;
  onRemove: (id: string) => void;
}

const FavoritesList: React.FC<FavoritesListProps> = ({ favorites, onClose, onRemove }) => {
  return (
    <Card className="flex flex-col gap-3 w-full max-w-sm max-h-[70vh]">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
          <Star size={20} className="text-spanish-orange" /> Moje ulubione
        </h3>
        <button onClick={onClose} className="text-gray-400 dark:text-gray-500 shrink-0">
          <X size={20} />
        </button>
      </div>

      {favorites.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400 py-6 text-center">
          Nic tu jeszcze nie ma. Dodaj miejsca z mapy ⭐
        </p>
      ) : (
        <ul className="flex flex-col gap-2 overflow-y-auto">
          {favorites.map((f) => {
            const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
              f.name
            )}${f.google_place_id ? `&query_place_id=${f.google_place_id}` : ''}`;
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
                    className="w-11 h-11 rounded-xl object-cover shrink-0"
                  />
                ) : (
                  <span className="w-11 h-11 rounded-xl bg-spanish-bg flex items-center justify-center shrink-0">
                    📍
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">{f.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{CATEGORY_LABEL[f.category] ?? f.category}</p>
                </div>
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-spanish-orange shrink-0 p-1.5"
                >
                  <ExternalLink size={16} />
                </a>
                <button onClick={() => onRemove(f.id)} className="text-spanish-red shrink-0 p-1.5">
                  <Trash2 size={16} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
};

export default FavoritesList;

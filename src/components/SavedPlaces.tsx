import React, { useEffect, useState } from 'react';
import { Bookmark, ExternalLink, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

const CATEGORY_LABEL: Record<string, string> = {
  food: '🍽️ Restauracja',
  sightseeing: '🏛️ Kulturalne',
  activity: '🎢 4fun',
  scenery: '🌅 Widoczki',
};

const avatarUrl = (seed: string) =>
  `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`;

interface SavedPlacesProps {
  favorites: any[];
  currentUserId: string;
  onRemove: (id: string) => void;
}

const SavedPlaces: React.FC<SavedPlacesProps> = ({ favorites, currentUserId, onRemove }) => {
  const [profiles, setProfiles] = useState<Record<string, any>>({});

  useEffect(() => {
    supabase.from('profiles').select('id, username, email, avatar_url').then(({ data }) => {
      if (data) {
        const map: Record<string, any> = {};
        data.forEach(p => { map[p.id] = p; });
        setProfiles(map);
      }
    });
  }, []);

  // Group favorites by user_id
  const grouped = favorites.reduce<Record<string, any[]>>((acc, f) => {
    (acc[f.user_id] ??= []).push(f);
    return acc;
  }, {});

  // Current user first, then others alphabetically
  const userIds = Object.keys(grouped).sort((a, b) => {
    if (a === currentUserId) return -1;
    if (b === currentUserId) return 1;
    const na = profiles[a]?.username ?? '';
    const nb = profiles[b]?.username ?? '';
    return na.localeCompare(nb);
  });

  return (
    <div className="flex flex-col gap-5 overflow-y-auto h-full p-2">
      <div className="flex items-center gap-2 px-2">
        <Bookmark className="text-spanish-orange" size={22} />
        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Zapisane miejsca</h2>
      </div>

      {userIds.length === 0 && (
        <p className="text-center text-gray-400 dark:text-gray-500 mt-10 text-sm">
          Nikt jeszcze nic nie zapisał ⭐
        </p>
      )}

      {userIds.map(uid => {
        const profile = profiles[uid];
        const seed = profile?.avatar_url ?? profile?.email ?? uid;
        const name = profile?.username ?? profile?.email?.split('@')[0] ?? '...';
        const isMe = uid === currentUserId;

        return (
          <div key={uid} className="flex flex-col gap-2">
            {/* User header */}
            <div className="flex items-center gap-2 px-2">
              <div className="w-8 h-8 rounded-full bg-spanish-bg shadow-neu-flat border border-white dark:border-gray-700 overflow-hidden shrink-0">
                <img src={avatarUrl(seed)} alt={name} />
              </div>
              <span className="text-sm font-bold text-gray-700 dark:text-gray-200">
                {name}{isMe && <span className="ml-1 text-spanish-orange text-xs">(Ty)</span>}
              </span>
              <span className="text-xs text-gray-400 dark:text-gray-500">· {grouped[uid].length}</span>
            </div>

            {/* Places */}
            <div className="flex flex-col gap-2 pl-10">
              {grouped[uid].map(f => {
                const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(f.name)}${f.google_place_id ? `&query_place_id=${f.google_place_id}` : ''}`;
                return (
                  <div
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
                      <span className="w-11 h-11 rounded-xl bg-spanish-bg flex items-center justify-center shrink-0 text-xl">
                        📍
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">{f.name}</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">{CATEGORY_LABEL[f.category] ?? f.category}</p>
                    </div>
                    <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="text-spanish-orange shrink-0 p-1.5">
                      <ExternalLink size={16} />
                    </a>
                    {isMe && (
                      <button onClick={() => onRemove(f.id)} className="text-spanish-red shrink-0 p-1.5">
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default SavedPlaces;

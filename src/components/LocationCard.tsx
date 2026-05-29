import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Card from './Card';
import Button from './Button';
import { ThumbsUp, ThumbsDown, ExternalLink, Star, Check, Loader2, Vote, Utensils, Landmark, Zap, Mountain } from 'lucide-react';
import type { DiscoveryPlace } from './DiscoveryCard';

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

interface LocationCardProps {
  place: any;
  votes: any[];
  userId?: string;
  hasActiveRound?: boolean;
  isCandidate?: boolean;
  onVote: (placeId: string, type: 1 | -1) => void;
  onFinalize?: (placeId: string) => void;
  onFavorite?: (place: DiscoveryPlace) => Promise<string | null>;
  onSendToVote?: (place: any) => void;
  onImageClick?: () => void;
  isAdmin?: boolean;
}

const LocationCard: React.FC<LocationCardProps> = ({
  place,
  votes,
  userId,
  isCandidate: isCandidate_prop,
  onVote,
  onFinalize,
  onFavorite,
  onSendToVote,
  onImageClick,
  isAdmin,
}) => {
  const isCandidate = isCandidate_prop ?? !!place.round_id;
  const placeVotes = votes.filter(v => v.place_id === place.id);
  const score = placeVotes.reduce((sum, v) => sum + (v.vote_type ?? 1), 0);
  const myVote = placeVotes.find(v => v.user_id === userId)?.vote_type;
  const [saving, setSaving] = useState(false);
  const [faved, setFaved] = useState(false);

  // precise link if we kept a Google place id, otherwise search by name + coords
  const placeId = place.google_place_id || place.place_id;
  const mapsUrl = placeId
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.name)}&query_place_id=${placeId}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${place.name} ${place.lat},${place.lng}`)}`;

  const addFavorite = async () => {
    if (!onFavorite) return;
    setSaving(true);
    const err = await onFavorite({
      name: place.name,
      category: place.category,
      lat: Number(place.lat),
      lng: Number(place.lng),
      placeId: placeId || '',
      photoUrl: place.photo_url || null,
    });
    setSaving(false);
    if (!err) setFaved(true);
  };

  return (
    <Card className="flex flex-col gap-0 w-full max-w-sm overflow-hidden p-0">
      {/* Hero photo */}
      {place.photo_url ? (
        <div className="relative w-full h-44 cursor-pointer" onClick={onImageClick}>
          <img src={place.photo_url} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          <div className="absolute bottom-3 left-4 right-4">
            <h3 className="text-lg font-bold text-white leading-tight drop-shadow">{place.name}</h3>
            <div className="flex items-center gap-2 mt-1">
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${CATEGORY_BADGE[place.category] ?? 'bg-gray-100 text-gray-600'}`}>
                {CATEGORY_ICON[place.category]}
                {CATEGORY_LABEL[place.category] ?? place.category}
              </span>
              {place.rating != null && (
                <span className="flex items-center gap-1 text-xs font-semibold text-amber-300">
                  <Star size={11} className="fill-amber-300 text-amber-300" />
                  {Number(place.rating).toFixed(1)}
                  {place.user_ratings_total != null && (
                    <span className="text-white/60 font-normal">({Number(place.user_ratings_total).toLocaleString('pl-PL')})</span>
                  )}
                </span>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="px-5 pt-5 pb-1">
          <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">{place.name}</h3>
          <div className="flex items-center gap-2 mt-1">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${CATEGORY_BADGE[place.category] ?? 'bg-gray-100 text-gray-600'}`}>
              {CATEGORY_ICON[place.category]}
              {CATEGORY_LABEL[place.category] ?? place.category}
            </span>
            {place.rating != null && (
              <span className="flex items-center gap-1 text-sm font-semibold text-amber-500">
                <Star size={13} className="fill-amber-400 text-amber-400" />
                {Number(place.rating).toFixed(1)}
                {place.user_ratings_total != null && (
                  <span className="text-gray-400 font-normal text-xs ml-0.5">({Number(place.user_ratings_total).toLocaleString('pl-PL')})</span>
                )}
              </span>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3 px-5 pt-4 pb-5">
        {/* Vote row */}
        <div className="flex justify-end items-center gap-1.5">
          <Button
            size="icon"
            variant="neutral"
            onClick={() => onVote(place.id, -1)}
            className={`w-10 h-10 transition-all ${myVote === -1 ? 'shadow-neu-pressed scale-90' : ''}`}
          >
            <ThumbsDown size={18} className="text-spanish-red" />
          </Button>
          <span className="text-lg font-bold text-gray-700 dark:text-gray-200 w-7 text-center tabular-nums overflow-hidden">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={score}
                initial={{ y: -14, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 14, opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="inline-block"
              >
                {score}
              </motion.span>
            </AnimatePresence>
          </span>
          <Button
            size="icon"
            variant="neutral"
            onClick={() => onVote(place.id, 1)}
            className={`w-10 h-10 transition-all ${myVote === 1 ? 'shadow-neu-pressed scale-90' : ''}`}
          >
            <ThumbsUp size={18} className="text-spanish-orange" />
          </Button>
        </div>

        {place.description && (
          <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed">{place.description}</p>
        )}

        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1.5 text-sm font-semibold text-spanish-orange"
        >
          <ExternalLink size={14} /> Opinie i zdjęcia w Google Maps
        </a>

        <div className="flex gap-2">
          <Button variant="neutral" onClick={addFavorite} disabled={saving || faved} className="flex-1 flex items-center justify-center gap-1.5">
            {saving ? (
              <Loader2 size={16} className="animate-spin" />
            ) : faved ? (
              <><Check size={16} /><span className="text-sm font-semibold">Zapisano</span></>
            ) : (
              <><Star size={16} /><span className="text-sm font-semibold">Ulubione</span></>
            )}
          </Button>
          {!isCandidate && (
            <Button variant="primary" onClick={() => onSendToVote && onSendToVote(place)} className="flex-1 flex items-center justify-center gap-1.5">
              <Vote size={16} /><span className="text-sm font-semibold">Do głosowania</span>
            </Button>
          )}
        </div>

        {isAdmin && place.status === 'proposed' && (
          <Button variant="secondary" onClick={() => onFinalize && onFinalize(place.id)}>
            Dodaj do planu dnia
          </Button>
        )}
      </div>
    </Card>
  );
};

export default LocationCard;

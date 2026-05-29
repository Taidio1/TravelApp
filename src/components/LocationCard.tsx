import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Card from './Card';
import Button from './Button';
import { ThumbsUp, ThumbsDown, MapPin, ExternalLink, Star, Check, Loader2, Vote } from 'lucide-react';
import type { DiscoveryPlace } from './DiscoveryCard';

interface LocationCardProps {
  place: any;
  votes: any[];
  userId?: string;
  hasActiveRound?: boolean;
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
  hasActiveRound,
  onVote,
  onFinalize,
  onFavorite,
  onSendToVote,
  onImageClick,
  isAdmin,
}) => {
  const isCandidate = !!place.round_id;
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
    <Card className="flex flex-col gap-4 w-full max-w-sm">
      <div className="flex justify-between items-start gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {place.photo_url && (
            <img
              src={place.photo_url}
              alt=""
              onClick={onImageClick}
              className="w-14 h-14 rounded-2xl object-cover shadow-neu-flat shrink-0 cursor-pointer hover:scale-105 transition-transform"
            />
          )}
          <div className="min-w-0">
            <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 truncate">{place.name}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
              <MapPin size={14} /> {place.category}
            </p>
            {place.rating != null && (
              <p className="flex items-center gap-1 text-sm font-semibold text-amber-500 mt-0.5">
                <span>{Number(place.rating).toFixed(1)}/5</span>
                <Star size={13} className="fill-amber-400 text-amber-400" />
                {place.user_ratings_total != null && (
                  <span className="text-gray-400 dark:text-gray-500 font-normal">/ {Number(place.user_ratings_total).toLocaleString('pl-PL')}</span>
                )}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
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
      </div>

      {place.description && (
        <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed">
          {place.description}
        </p>
      )}

      <a
        href={mapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-1.5 text-sm font-semibold text-spanish-orange hover:underline"
      >
        <ExternalLink size={15} /> Zobacz opinie i zdjęcia w Google Maps
      </a>

      <div className="flex gap-2">
        <Button variant="neutral" onClick={addFavorite} disabled={saving || faved} className="flex-1">
          {saving ? (
            <Loader2 size={18} className="animate-spin" />
          ) : faved ? (
            <Check size={18} />
          ) : (
            <Star size={18} />
          )}
        </Button>
        {!isCandidate && (
          <Button variant="primary" onClick={() => onSendToVote && onSendToVote(place)} className="flex-1">
            <Vote size={18} />
          </Button>
        )}
      </div>

      {isAdmin && place.status === 'proposed' && (
        <Button
          variant="secondary"
          onClick={() => onFinalize && onFinalize(place.id)}
        >
          Add to Daily Plan
        </Button>
      )}
    </Card>
  );
};

export default LocationCard;

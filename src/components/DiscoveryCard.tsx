import React, { useState } from 'react';
import Card from './Card';
import Button from './Button';
import { X, ExternalLink, Star, Check, Loader2, Vote } from 'lucide-react';

const CATEGORY_LABEL: Record<string, string> = {
  food: '🍽️ Restauracja',
  sightseeing: '🏛️ Kulturalne',
  activity: '🎢 4fun',
  scenery: '🌅 Widoczki',
};

export interface DiscoveryPlace {
  lat: number;
  lng: number;
  name: string;
  category: string;
  placeId: string;
  photoUrl: string | null;
  rating?: number | null;
  userRatingsTotal?: number | null;
}

interface DiscoveryCardProps {
  place: DiscoveryPlace;
  hasActiveRound: boolean;
  onClose: () => void;
  // returns an error message to display, or null on success
  onFavorite: (place: DiscoveryPlace) => Promise<string | null>;
  onSendToVote: (place: DiscoveryPlace) => void;
  onImageClick?: () => void;
}

const DiscoveryCard: React.FC<DiscoveryCardProps> = ({
  place,
  hasActiveRound,
  onClose,
  onFavorite,
  onSendToVote,
  onImageClick,
}) => {
  const [saving, setSaving] = useState(false);
  const [faved, setFaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    place.name
  )}&query_place_id=${place.placeId}`;

  const addFavorite = async () => {
    setSaving(true);
    setError(null);
    const err = await onFavorite(place);
    setSaving(false);
    if (err) setError(err);
    else setFaved(true);
  };

  return (
    <Card className="flex flex-col gap-3 w-full max-w-sm">
      <div className="flex justify-between items-start gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {place.photoUrl && (
            <img
              src={place.photoUrl}
              alt=""
              onClick={onImageClick}
              className="w-14 h-14 rounded-2xl object-cover shadow-neu-flat shrink-0 cursor-pointer hover:scale-105 transition-transform"
            />
          )}
          <div className="min-w-0">
            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 truncate">{place.name}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">{CATEGORY_LABEL[place.category] ?? place.category}</p>
            {place.rating != null && (
              <p className="flex items-center gap-1 text-sm font-semibold text-amber-500 mt-0.5">
                <span>{place.rating.toFixed(1)}/5</span>
                <Star size={13} className="fill-amber-400 text-amber-400" />
                {place.userRatingsTotal != null && (
                  <span className="text-gray-400 dark:text-gray-500 font-normal">/ {place.userRatingsTotal.toLocaleString('pl-PL')}</span>
                )}
              </p>
            )}
          </div>
        </div>
        <button onClick={onClose} className="text-gray-400 dark:text-gray-500 shrink-0">
          <X size={20} />
        </button>
      </div>

      <a
        href={mapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-1.5 text-sm font-semibold text-spanish-orange hover:underline"
      >
        <ExternalLink size={15} /> Zobacz opinie i zdjęcia w Google Maps
      </a>

      {error && <p className="text-sm text-spanish-red">{error}</p>}

      <div className="flex gap-2 mt-1">
        <Button
          variant="neutral"
          onClick={addFavorite}
          disabled={saving || faved}
          className="flex-1"
        >
          {saving ? (
            <Loader2 size={18} className="animate-spin" />
          ) : faved ? (
            <Check size={18} />
          ) : (
            <Star size={18} />
          )}
        </Button>
        <Button
          variant="primary"
          onClick={() => onSendToVote(place)}
          className="flex-1"
        >
          <Vote size={18} />
        </Button>
      </div>
    </Card>
  );
};

export default DiscoveryCard;

import React, { useState } from 'react';
import Card from './Card';
import Button from './Button';
import { X, ExternalLink, Star, Check, Loader2, Vote, Utensils, Landmark, Zap, Mountain } from 'lucide-react';

const CATEGORY_LABEL: Record<string, string> = {
  food: 'Restauracja',
  sightseeing: 'Kulturalne',
  activity: '4fun',
  scenery: 'Widoczki',
};

const CATEGORY_ICON: Record<string, React.ReactNode> = {
  food: <Utensils size={11} />,
  sightseeing: <Landmark size={11} />,
  activity: <Zap size={11} />,
  scenery: <Mountain size={11} />,
};

const CATEGORY_BADGE: Record<string, string> = {
  food: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  sightseeing: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  activity: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  scenery: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
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
  hasActiveRound: _hasActiveRound,
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
    <Card className="flex flex-col gap-0 w-full max-w-sm overflow-hidden p-0">
      {/* Hero photo */}
      {place.photoUrl ? (
        <div className="relative w-full h-48 cursor-pointer" onClick={onImageClick}>
          <img
            src={place.photoUrl}
            alt=""
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          <button
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center active:scale-90 transition-transform"
          >
            <X size={16} className="text-white" />
          </button>
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
                  {place.rating.toFixed(1)}
                  {place.userRatingsTotal != null && (
                    <span className="text-white/60 font-normal">({place.userRatingsTotal.toLocaleString('pl-PL')})</span>
                  )}
                </span>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-start justify-between gap-3 px-5 pt-5">
          <div className="min-w-0">
            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 leading-tight">{place.name}</h3>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold mt-1 ${CATEGORY_BADGE[place.category] ?? 'bg-gray-100 text-gray-600'}`}>
              {CATEGORY_ICON[place.category]}
              {CATEGORY_LABEL[place.category] ?? place.category}
            </span>
            {place.rating != null && (
              <p className="flex items-center gap-1 text-sm font-semibold text-amber-500 mt-1">
                <Star size={13} className="fill-amber-400 text-amber-400" />
                {place.rating.toFixed(1)}
                {place.userRatingsTotal != null && (
                  <span className="text-gray-400 dark:text-gray-500 font-normal text-xs ml-0.5">({place.userRatingsTotal.toLocaleString('pl-PL')})</span>
                )}
              </p>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 dark:text-gray-500 shrink-0">
            <X size={20} />
          </button>
        </div>
      )}

      <div className="flex flex-col gap-3 px-5 pt-4 pb-5">
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1.5 text-sm font-semibold text-spanish-orange"
        >
          <ExternalLink size={14} /> Opinie i zdjęcia w Google Maps
        </a>

        {error && <p className="text-sm text-spanish-red">{error}</p>}

        <div className="flex gap-2">
          <Button
            variant="neutral"
            onClick={addFavorite}
            disabled={saving || faved}
            className="flex-1 flex items-center justify-center gap-1.5"
          >
            {saving ? (
              <Loader2 size={16} className="animate-spin" />
            ) : faved ? (
              <><Check size={16} /><span className="text-sm font-semibold">Zapisano</span></>
            ) : (
              <><Star size={16} /><span className="text-sm font-semibold">Ulubione</span></>
            )}
          </Button>
          <Button
            variant="primary"
            onClick={() => onSendToVote(place)}
            className="flex-1 flex items-center justify-center gap-1.5"
          >
            <Vote size={16} /><span className="text-sm font-semibold">Do głosowania</span>
          </Button>
        </div>
      </div>
    </Card>
  );
};

export default DiscoveryCard;

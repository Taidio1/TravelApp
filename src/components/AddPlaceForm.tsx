import React, { useState } from 'react';
import Card from './Card';
import Button from './Button';
import Input from './Input';
import { MapPin, X, Loader2, ExternalLink } from 'lucide-react';

// matches the App filter categories (minus 'all' / 'must_have')
const CATEGORIES = [
  { id: 'food',        label: 'Restauracje', emoji: '🍽️' },
  { id: 'sightseeing', label: 'Kulturalne',  emoji: '🏛️' },
  { id: 'activity',    label: '4fun',        emoji: '🎢' },
  { id: 'scenery',     label: 'Widoczki',    emoji: '🌅' },
] as const;

interface AddPlaceFormProps {
  coords: { lat: number; lng: number };
  onClose: () => void;
  // returns an error message to display, or null on success
  onSave: (data: { name: string; description: string; category: string }) => Promise<string | null>;
  initial?: { name?: string; category?: string };
  mapsUrl?: string;
}

const AddPlaceForm: React.FC<AddPlaceFormProps> = ({ coords, onClose, onSave, initial, mapsUrl }) => {
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<string>(initial?.category ?? 'food');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!name.trim()) {
      setError('Podaj nazwę miejsca');
      return;
    }
    setSaving(true);
    setError(null);
    const err = await onSave({ name: name.trim(), description: description.trim(), category });
    setSaving(false);
    if (err) setError(err);
    else onClose();
  };

  return (
    <Card className="flex flex-col gap-4 w-full max-w-sm">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-xl font-bold text-gray-800">Nowe miejsce</h3>
          <p className="text-sm text-gray-500 flex items-center gap-1">
            <MapPin size={14} /> {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
          </p>
        </div>
        <button onClick={onClose} className="text-gray-400 shrink-0">
          <X size={20} />
        </button>
      </div>

      <Input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Nazwa (np. La Tasca)"
      />
      <Input
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Opis (opcjonalnie)"
      />

      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            onClick={() => setCategory(c.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
              category === c.id
                ? 'bg-spanish-orange text-white shadow-lg scale-105'
                : 'bg-spanish-bg text-gray-600 shadow-neu-flat'
            }`}
          >
            <span>{c.emoji}</span>
            <span>{c.label}</span>
          </button>
        ))}
      </div>

      {mapsUrl && (
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1.5 text-sm font-semibold text-spanish-orange hover:underline"
        >
          <ExternalLink size={15} /> Zobacz opinie i zdjęcia w Google Maps
        </a>
      )}

      {error && <p className="text-sm text-spanish-red">{error}</p>}

      <Button variant="primary" onClick={submit} disabled={saving} className="mt-1">
        {saving ? <Loader2 size={20} className="animate-spin" /> : 'Dodaj miejsce'}
      </Button>
    </Card>
  );
};

export default AddPlaceForm;

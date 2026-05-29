import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, Loader2, ExternalLink, Trash2, Plus, MapPin } from 'lucide-react';
import { model } from '../lib/gemini';

type WizardStep = 'home' | 'route_detail' | 1 | 2 | 3 | 4 | 'loading' | 'results';

interface FormData {
  duration: string;
  transport: string;
  food: string;
  vibe: string;
}

interface SavedRoute {
  id: string;
  name: string;
  places: any[];
  createdAt: string;
}

const CATEGORY_EMOJI: Record<string, string> = {
  food: '🍽️', sightseeing: '🏛️', activity: '🎢', scenery: '🌅',
};
const CATEGORY_LABELS: Record<string, string> = {
  food: 'Restauracja', sightseeing: 'Kulturalne', activity: 'Aktywność', scenery: 'Widoki',
};

const STEPS = {
  1: {
    question: 'Jak długo masz czas?',
    field: 'duration' as keyof FormData,
    options: [
      { value: '1h', label: '⏱ 1 godzina' },
      { value: '2h', label: '⏱ 2 godziny' },
      { value: '3h', label: '⏱ 3 godziny' },
      { value: 'half_day', label: '🌅 Pół dnia' },
      { value: 'full_day', label: '☀️ Cały dzień' },
    ],
  },
  2: {
    question: 'Jak się poruszacie?',
    field: 'transport' as keyof FormData,
    options: [
      { value: 'walking', label: '🚶 Pieszo' },
      { value: 'car', label: '🚗 Autem' },
      { value: 'public', label: '🚇 Metro / Bus' },
    ],
  },
  3: {
    question: 'Co z jedzeniem?',
    field: 'food' as keyof FormData,
    options: [
      { value: 'snack', label: '☕ Przekąska w trakcie' },
      { value: 'lunch', label: '🍽️ Pełny lunch' },
      { value: 'dinner', label: '🌙 Kolacja na koniec' },
      { value: 'none', label: '⏭️ Pomijamy' },
    ],
  },
  4: {
    question: 'Czego szukacie?',
    field: 'vibe' as keyof FormData,
    options: [
      { value: 'culture', label: '🏛️ Kultura & historia' },
      { value: 'scenery', label: '🌅 Widoki' },
      { value: 'fun', label: '🎢 Fun & aktywność' },
      { value: 'relax', label: '🍷 Spokojnie, klimatycznie' },
      { value: 'mix', label: '✨ Mix wszystkiego' },
    ],
  },
} as const;

const DURATION_TEXT: Record<string, string> = {
  '1h': '1 hour', '2h': '2 hours', '3h': '3 hours',
  half_day: 'half a day (4-5 hours)', full_day: 'a full day (7-8 hours)',
};
const TRANSPORT_TEXT: Record<string, string> = {
  walking: 'on foot', car: 'by car', public: 'by public transport',
};
const FOOD_TEXT: Record<string, string> = {
  none: '', snack: ' Include a coffee or snack stop.',
  lunch: ' Include a lunch break at a local restaurant.',
  dinner: ' End the trip with dinner at a nice restaurant.',
};
const VIBE_TEXT: Record<string, string> = {
  culture: 'cultural and historical sites',
  scenery: 'scenic viewpoints and photography spots',
  fun: 'fun activities and entertainment venues',
  relax: 'relaxed and atmospheric local spots',
  mix: 'a diverse mix of culture, scenery, food and activities',
};

// Route name labels (Polish, short)
const DURATION_LABEL: Record<string, string> = {
  '1h': '1h', '2h': '2h', '3h': '3h', half_day: 'Pół dnia', full_day: 'Cały dzień',
};
const TRANSPORT_LABEL: Record<string, string> = {
  walking: 'pieszo', car: 'autem', public: 'komunikacją',
};
const VIBE_LABEL: Record<string, string> = {
  culture: 'kultura', scenery: 'widoki', fun: 'fun', relax: 'relaks', mix: 'mix',
};

function routeNameFromForm(form: Partial<FormData>): string {
  const parts = [
    form.duration ? DURATION_LABEL[form.duration] : '',
    form.transport ? TRANSPORT_LABEL[form.transport] : '',
    form.vibe ? VIBE_LABEL[form.vibe] : '',
  ].filter(Boolean);
  return parts.join(' · ');
}

function loadRoutes(): SavedRoute[] {
  try { return JSON.parse(localStorage.getItem('saved_routes') ?? '[]'); }
  catch { return []; }
}

function persistRoutes(routes: SavedRoute[]) {
  localStorage.setItem('saved_routes', JSON.stringify(routes));
}

async function callAI(lat: number, lng: number, form: FormData): Promise<any[]> {
  const provider = (localStorage.getItem('ai_provider') as 'openai' | 'gemini') || 'gemini';
  const prompt = `I am at coordinates ${lat}, ${lng}. I am planning a ${DURATION_TEXT[form.duration] ?? '2 hours'} trip traveling ${TRANSPORT_TEXT[form.transport] ?? 'on foot'}.
I want to visit ${VIBE_TEXT[form.vibe] ?? 'interesting places'}.${FOOD_TEXT[form.food] ?? ''}
Suggest 6-8 specific real places near these exact coordinates, ordered as a logical travel route.
Return ONLY a JSON array with objects: name (string), description (string, 1 sentence), category (exactly one of: food, sightseeing, activity, scenery), lat (number), lng (number).
No markdown, no extra text.`;

  if (provider === 'gemini') {
    try {
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      const match = text.match(/\[[\s\S]*\]/);
      const parsed = JSON.parse(match ? match[0] : text);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.error('Gemini wizard error:', e);
      return [];
    }
  }

  try {
    const openAIPrompt = prompt.replace(
      'Return ONLY a JSON array',
      'Return a JSON object { "places": [...] } where each item has'
    );
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${import.meta.env.VITE_OPENAI_API_KEY ?? ''}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: 'You are a travel assistant that returns only valid JSON.' },
          { role: 'user', content: openAIPrompt },
        ],
      }),
    });
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content ?? '{}';
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : (parsed.places ?? []);
  } catch (e) {
    console.error('OpenAI wizard error:', e);
    return [];
  }
}

interface TripWizardProps {
  currentLocation: { lat: number; lng: number };
  onConfirm: (places: any[], name: string, alreadySaved?: boolean) => void;
  onClose: () => void;
}

const TripWizard: React.FC<TripWizardProps> = ({ currentLocation, onConfirm, onClose }) => {
  const [step, setStep] = useState<WizardStep>('home');
  const [form, setForm] = useState<Partial<FormData>>({});
  const [results, setResults] = useState<any[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [savedRoutes, setSavedRoutes] = useState<SavedRoute[]>(loadRoutes);
  const [previewRoute, setPreviewRoute] = useState<SavedRoute | null>(null);

  const stepNum = typeof step === 'number' ? step : null;
  const stepCfg = stepNum ? STEPS[stepNum as 1 | 2 | 3 | 4] : null;

  const deleteRoute = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = savedRoutes.filter(r => r.id !== id);
    persistRoutes(next);
    setSavedRoutes(next);
  };

  const handlePick = (field: keyof FormData, value: string) => {
    const next = { ...form, [field]: value };
    setForm(next);
    if (step === 4) runAI(next as FormData);
    else if (typeof step === 'number') setStep((step + 1) as WizardStep);
  };

  const runAI = async (formData: FormData) => {
    setStep('loading');
    const data = await callAI(currentLocation.lat, currentLocation.lng, formData);
    setResults(data);
    setSelected(new Set());
    setStep('results');
  };

  const toggleSelect = (i: number) =>
    setSelected(prev => {
      const s = new Set(prev);
      s.has(i) ? s.delete(i) : s.add(i);
      return s;
    });

  const handleConfirm = () => {
    const places = Array.from(selected).map(i => results[i]);
    onConfirm(places, routeNameFromForm(form), false);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col justify-end"
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="relative bg-spanish-bg dark:bg-gray-900 rounded-t-3xl max-h-[88vh] flex flex-col"
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 shrink-0">
          <div className="flex items-center gap-2">
            {step !== 'home' && (
              <button
                onClick={() => {
                  if (step === 'route_detail') { setStep('home'); setPreviewRoute(null); }
                  else if (step === 1) setStep('home');
                  else if (typeof step === 'number') setStep((step - 1) as WizardStep);
                }}
                className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mr-1"
              >
                <span className="text-gray-500 text-sm">←</span>
              </button>
            )}
            <Sparkles size={20} className="text-spanish-orange" />
            <span className="font-bold text-gray-800 dark:text-gray-100">
              {step === 'home' ? 'Moje trasy' : step === 'route_detail' ? (previewRoute?.name || 'Podgląd trasy') : 'Zaplanuj trasę'}
            </span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center"
          >
            <X size={16} className="text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 pb-8">
          <AnimatePresence mode="wait">

            {/* Home — saved routes + new trip button */}
            {step === 'home' && (
              <motion.div
                key="home"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.18 }}
              >
                {/* New trip CTA */}
                <button
                  onClick={() => { setForm({}); setStep(1); }}
                  className="w-full flex items-center justify-center gap-2 p-4 rounded-2xl bg-spanish-orange text-white font-bold text-base shadow-lg active:scale-[0.98] transition-all mb-5"
                >
                  <Plus size={20} />
                  Nowa trasa
                </button>

                {savedRoutes.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-10 text-gray-400 dark:text-gray-500">
                    <MapPin size={32} className="opacity-40" />
                    <p className="text-sm font-medium">Brak zapisanych tras</p>
                    <p className="text-xs text-center">Zaplanuj pierwszą trasę klikając przycisk powyżej</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">
                      Zapisane trasy ({savedRoutes.length})
                    </p>
                    {savedRoutes.map(route => (
                      <motion.div
                        key={route.id}
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        onClick={() => { setPreviewRoute(route); setStep('route_detail'); }}
                        className="flex items-center gap-3 p-4 rounded-2xl bg-white dark:bg-gray-800 shadow-neu-flat cursor-pointer active:scale-[0.98] transition-all"
                      >
                        <div className="w-10 h-10 rounded-xl bg-spanish-orange/10 flex items-center justify-center shrink-0">
                          <MapPin size={18} className="text-spanish-orange" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm text-gray-800 dark:text-gray-100 truncate">
                            {route.name || 'Trasa bez nazwy'}
                          </p>
                          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                            {new Date(route.createdAt).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long' })}
                            {' · '}{route.places.length} miejsc
                          </p>
                        </div>
                        <button
                          onClick={(e) => deleteRoute(route.id, e)}
                          className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-gray-300 dark:text-gray-600 hover:text-spanish-red hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        >
                          <Trash2 size={15} />
                        </button>
                      </motion.div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {/* Route detail / preview */}
            {step === 'route_detail' && previewRoute && (
              <motion.div
                key="route_detail"
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -30 }}
                transition={{ duration: 0.18 }}
              >
                <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">
                  {new Date(previewRoute.createdAt).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' })}
                  {' · '}{previewRoute.places.length} miejsc
                </p>

                <div className="flex flex-col gap-2.5 mb-5">
                  {previewRoute.places.map((place, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-3 p-3.5 rounded-2xl bg-white dark:bg-gray-800 shadow-neu-flat"
                    >
                      <div className="w-7 h-7 rounded-full bg-spanish-orange/15 flex items-center justify-center shrink-0 mt-0.5">
                        <span className="text-xs font-bold text-spanish-orange">{i + 1}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-bold text-sm text-gray-800 dark:text-gray-100 leading-tight">
                            {place.name}
                          </span>
                          <a
                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.name)}&ll=${place.lat},${place.lng}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="shrink-0 flex items-center gap-1 text-xs text-blue-500 font-medium"
                          >
                            <ExternalLink size={11} />
                            Maps
                          </a>
                        </div>
                        {place.description && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">
                            {place.description}
                          </p>
                        )}
                        <span className="text-xs text-spanish-orange font-semibold mt-1 block">
                          {CATEGORY_EMOJI[place.category] ?? '📍'}{' '}
                          {CATEGORY_LABELS[place.category] ?? place.category}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => onConfirm(previewRoute.places, previewRoute.name, true)}
                  className="w-full py-4 rounded-2xl bg-spanish-orange text-white font-bold text-base shadow-lg active:scale-[0.98] transition-all"
                >
                  Pokaż trasę na mapie
                </button>
              </motion.div>
            )}

            {/* Steps 1–4 */}
            {stepNum && stepCfg && (
              <motion.div
                key={step}
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -30 }}
                transition={{ duration: 0.18 }}
              >
                <div className="flex gap-1.5 mb-5">
                  {[1, 2, 3, 4].map(n => (
                    <div
                      key={n}
                      className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                        n <= stepNum ? 'bg-spanish-orange' : 'bg-gray-200 dark:bg-gray-700'
                      }`}
                    />
                  ))}
                </div>

                <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-4">
                  {stepCfg.question}
                </h2>

                <div className="flex flex-col gap-2.5">
                  {stepCfg.options.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => handlePick(stepCfg.field, opt.value)}
                      className={`p-4 rounded-2xl text-left font-semibold text-base transition-all active:scale-[0.98] ${
                        form[stepCfg.field] === opt.value
                          ? 'bg-spanish-orange text-white shadow-lg'
                          : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 shadow-neu-flat'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Loading */}
            {step === 'loading' && (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center py-16 gap-4"
              >
                <Loader2 size={40} className="animate-spin text-spanish-orange" />
                <p className="text-gray-500 dark:text-gray-400 font-medium">
                  Szukam najlepszych miejsc...
                </p>
              </motion.div>
            )}

            {/* Results */}
            {step === 'results' && (
              <motion.div
                key="results"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  Wybierz miejsca które chcesz odwiedzić
                </p>

                {results.length === 0 ? (
                  <div className="text-center py-8 text-gray-400 dark:text-gray-500">
                    Brak wyników. Spróbuj ponownie.
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {results.map((place, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.06 }}
                        onClick={() => toggleSelect(i)}
                        className={`p-4 rounded-2xl cursor-pointer transition-all active:scale-[0.99] ${
                          selected.has(i)
                            ? 'bg-spanish-orange/10 border-2 border-spanish-orange'
                            : 'bg-white dark:bg-gray-800 border-2 border-transparent shadow-neu-flat'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 mt-0.5 transition-all ${
                              selected.has(i)
                                ? 'bg-spanish-orange text-white'
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-400'
                            }`}
                          >
                            {selected.has(i) ? '✓' : i + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <span className="font-bold text-gray-800 dark:text-gray-100 text-sm leading-tight">
                                {place.name}
                              </span>
                              <a
                                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.name)}&ll=${place.lat},${place.lng}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={e => e.stopPropagation()}
                                className="shrink-0 flex items-center gap-1 text-xs text-blue-500 font-medium"
                              >
                                <ExternalLink size={11} />
                                Maps
                              </a>
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">
                              {place.description}
                            </p>
                            <span className="text-xs text-spanish-orange font-semibold mt-1.5 block">
                              {CATEGORY_EMOJI[place.category] ?? '📍'}{' '}
                              {CATEGORY_LABELS[place.category] ?? place.category}
                            </span>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}

                <button
                  onClick={handleConfirm}
                  disabled={selected.size === 0}
                  className={`mt-5 w-full py-4 rounded-2xl font-bold text-base transition-all ${
                    selected.size > 0
                      ? 'bg-spanish-orange text-white shadow-lg active:scale-[0.98]'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  {selected.size > 0 ? `Pokaż trasę (${selected.size} miejsc)` : 'Wybierz miejsca'}
                </button>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default TripWizard;

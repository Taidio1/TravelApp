import React, { useState } from 'react';
import { suggestPlaces as geminiSuggest } from '../lib/gemini';
import { suggestPlaces as openaiSuggest } from '../lib/openai';
import Card from './Card';
import Button from './Button';
import Input from './Input';
import { Sparkles, Loader2 } from 'lucide-react';

type Provider = 'openai' | 'gemini';
const PROVIDERS: { id: Provider; label: string }[] = [
  { id: 'openai', label: 'OpenAI' },
  { id: 'gemini', label: 'Gemini' },
];

interface AIAssistantProps {
  currentLocation: { lat: number, lng: number };
  onSuggestions: (suggestions: any[]) => void;
}

const AIAssistant: React.FC<AIAssistantProps> = ({ currentLocation, onSuggestions }) => {
  const [loading, setLoading] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [provider, setProvider] = useState<Provider>(
    () => (localStorage.getItem('ai_provider') as Provider) || 'gemini'
  );

  const selectProvider = (p: Provider) => {
    setProvider(p);
    localStorage.setItem('ai_provider', p);
  };

  const handleAsk = async () => {
    setLoading(true);
    try {
      const theme = prompt || 'interesting places';
      const suggest = provider === 'openai' ? openaiSuggest : geminiSuggest;
      let suggestions = await suggest(currentLocation.lat, currentLocation.lng, theme);
      // OpenAI returns [] on error (e.g. 429/quota) — fall back to Gemini so the user isn't stuck.
      if (provider === 'openai' && (!suggestions || suggestions.length === 0)) {
        suggestions = await geminiSuggest(currentLocation.lat, currentLocation.lng, theme);
      }
      onSuggestions(suggestions);
      setPrompt('');
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <Sparkles className="text-spanish-orange" size={20} />
          <h4 className="font-bold text-gray-800 dark:text-gray-100">Ask your AI Guide</h4>
        </div>
        <div className="flex gap-1 bg-spanish-bg rounded-full p-1 shadow-neu-pressed">
          {PROVIDERS.map((p) => (
            <button
              key={p.id}
              onClick={() => selectProvider(p.id)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                provider === p.id ? 'bg-spanish-orange text-white shadow' : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex gap-2">
        <Input 
          placeholder="What are you looking for?" 
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          className="flex-1"
        />
        <Button 
          variant="primary" 
          size="icon" 
          onClick={handleAsk}
          disabled={loading}
        >
          {loading ? <Loader2 className="animate-spin" size={20} /> : <Sparkles size={20} />}
        </Button>
      </div>
    </Card>
  );
};

export default AIAssistant;

import React, { useState } from 'react';
import { suggestPlaces } from '../lib/gemini';
import Card from './Card';
import Button from './Button';
import Input from './Input';
import { Sparkles, Loader2 } from 'lucide-react';

interface AIAssistantProps {
  currentLocation: { lat: number, lng: number };
  onSuggestions: (suggestions: any[]) => void;
}

const AIAssistant: React.FC<AIAssistantProps> = ({ currentLocation, onSuggestions }) => {
  const [loading, setLoading] = useState(false);
  const [prompt, setPrompt] = useState('');

  const handleAsk = async () => {
    setLoading(true);
    try {
      const suggestions = await suggestPlaces(currentLocation.lat, currentLocation.lng, prompt || 'interesting places');
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
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="text-spanish-orange" size={20} />
        <h4 className="font-bold text-gray-800">Ask your AI Guide</h4>
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

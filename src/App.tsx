import React, { useState } from 'react';
import Map from './components/Map';
import LocationCard from './components/LocationCard';
import { useRealtime } from './hooks/useRealtime';
import { supabase } from './lib/supabase';
import { Sparkles, Plus } from 'lucide-react';
import Button from './components/Button';

function App() {
  const places = useRealtime<any>('places');
  const votes = useRealtime<any>('votes');
  const [selectedPlace, setSelectedPlace] = useState<any>(null);
  const [isAdmin] = useState(true); // Temporary for dev

  const handleVote = async (placeId: string) => {
    // In a real app, we'd get the user ID from auth
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return alert('Please login to vote');

    const { error } = await supabase
      .from('votes')
      .insert({ place_id: placeId, user_id: user.id });
    
    if (error) {
      if (error.code === '23505') {
        // Already voted, let's remove it (toggle)
        await supabase
          .from('votes')
          .delete()
          .match({ place_id: placeId, user_id: user.id });
      } else {
        console.error(error);
      }
    }
  };

  const handleMapClick = (lat: number, lng: number) => {
    // Open a modal or show a form to add a place
    console.log('Map clicked at', lat, lng);
  };

  const handleFinalize = async (placeId: string) => {
    await supabase
      .from('places')
      .update({ status: 'approved' })
      .eq('id', placeId);
    
    await supabase
      .from('daily_plans')
      .insert({ 
        date: new Date().toISOString().split('T')[0],
        place_id: placeId,
        order: 1
      });
  };

  return (
    <div className="fixed inset-0 bg-spanish-bg flex flex-col p-4 gap-4">
      {/* Header */}
      <div className="flex justify-between items-center px-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">SpainTrip 2026</h1>
          <p className="text-sm text-gray-500">Hola, explorers! 🇪🇸</p>
        </div>
        <div className="w-12 h-12 rounded-full bg-spanish-bg shadow-neu-flat border-2 border-white overflow-hidden">
          <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=Juan`} alt="Avatar" />
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 relative">
        <Map 
          places={places} 
          onMapClick={handleMapClick}
        />
        
        {/* Floating Actions */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-4 items-center">
          <Button variant="primary" size="icon" className="w-16 h-16 shadow-lg">
            <Sparkles size={28} />
          </Button>
          <Button variant="neutral" size="icon" className="w-14 h-14">
            <Plus size={24} />
          </Button>
        </div>
      </div>

      {/* Detail Overlay */}
      {selectedPlace && (
        <div className="absolute bottom-24 left-4 right-4 flex justify-center animate-in slide-in-from-bottom-10 duration-300">
          <LocationCard 
            place={selectedPlace}
            votes={votes}
            onVote={handleVote}
            onFinalize={handleFinalize}
            isAdmin={isAdmin}
          />
        </div>
      )}

      {/* Temporary Selector for Testing */}
      <div className="overflow-x-auto flex gap-4 pb-2">
        {places.map((p: any) => (
          <button 
            key={p.id}
            onClick={() => setSelectedPlace(p)}
            className={`px-4 py-2 rounded-full whitespace-nowrap ${selectedPlace?.id === p.id ? 'bg-spanish-orange text-white' : 'bg-white shadow-neu-flat'}`}
          >
            {p.name}
          </button>
        ))}
      </div>
    </div>
  );
}

export default App;

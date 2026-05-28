import React, { useState, useEffect } from 'react';
import Map from './components/Map';
import LocationCard from './components/LocationCard';
import AIAssistant from './components/AIAssistant';
import Planner from './components/Planner';
import Auth from './components/Auth';
import { useRealtime } from './hooks/useRealtime';
import { supabase } from './lib/supabase';
import { Sparkles, Plus, List, Map as MapIcon, LogOut } from 'lucide-react';
import Button from './components/Button';
import { AnimatePresence, motion } from 'framer-motion';

function App() {
  const [session, setSession] = useState<any>(null);
  const places = useRealtime<any>('places');
  const votes = useRealtime<any>('votes');
  const plans = useRealtime<any>('daily_plans');
  
  const [selectedPlace, setSelectedPlace] = useState<any>(null);
  const [showAI, setShowAI] = useState(false);
  const [view, setView] = useState<'map' | 'planner'>('map');
  const [userProfile, setUserProfile] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session?.user) {
      supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single()
        .then(({ data }) => setUserProfile(data));
    }
  }, [session]);

  const handleVote = async (placeId: string) => {
    if (!session) return;
    
    const { error } = await supabase
      .from('votes')
      .insert({ place_id: placeId, user_id: session.user.id });
    
    if (error && error.code === '23505') {
      await supabase
        .from('votes')
        .delete()
        .match({ place_id: placeId, user_id: session.user.id });
    }
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
        order: plans.length + 1,
        assigned_by: session.user.id
      });
  };

  const handleAISuggestions = async (suggestions: any[]) => {
    for (const s of suggestions) {
      await supabase.from('places').insert({
        ...s,
        created_by: session.user.id,
        ai_suggested: true
      });
    }
    setShowAI(false);
  };

  if (!session) return <Auth />;

  return (
    <div className="fixed inset-0 bg-spanish-bg flex flex-col p-4 gap-4 overflow-hidden">
      {/* Header */}
      <div className="flex justify-between items-center px-2 shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">SpainTrip 2026</h1>
          <p className="text-sm text-gray-500">Hola, {userProfile?.username || 'explorer'}! 🇪🇸</p>
        </div>
        <div className="flex items-center gap-3">
          <Button size="icon" variant="neutral" onClick={() => supabase.auth.signOut()} className="w-10 h-10 shadow-none">
            <LogOut size={18} />
          </Button>
          <div className="w-12 h-12 rounded-full bg-spanish-bg shadow-neu-flat border-2 border-white overflow-hidden">
            <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${session.user.email}`} alt="Avatar" />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 relative overflow-hidden">
        <AnimatePresence mode="wait">
          {view === 'map' ? (
            <motion.div 
              key="map"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              className="w-full h-full"
            >
              <Map 
                places={places} 
                onMapClick={(lat, lng) => console.log(lat, lng)}
              />
            </motion.div>
          ) : (
            <motion.div 
              key="planner"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="w-full h-full"
            >
              <Planner plans={plans} places={places} />
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Floating Actions */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-4 items-center z-20">
          <Button 
            variant={view === 'map' ? 'primary' : 'neutral'} 
            size="icon" 
            className="w-14 h-14"
            onClick={() => setView('map')}
          >
            <MapIcon size={24} />
          </Button>
          <Button 
            variant="primary" 
            size="icon" 
            className="w-16 h-16 shadow-lg"
            onClick={() => setShowAI(!showAI)}
          >
            <Sparkles size={28} />
          </Button>
          <Button 
            variant={view === 'planner' ? 'primary' : 'neutral'} 
            size="icon" 
            className="w-14 h-14"
            onClick={() => setView('planner')}
          >
            <List size={24} />
          </Button>
        </div>

        {/* AI Assistant Overlay */}
        <AnimatePresence>
          {showAI && (
            <motion.div 
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              className="absolute inset-x-0 bottom-28 z-30 px-4"
            >
              <AIAssistant 
                currentLocation={{ lat: 40.4168, lng: -3.7038 }} 
                onSuggestions={handleAISuggestions} 
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Detail Overlay */}
        <AnimatePresence>
          {selectedPlace && view === 'map' && (
            <motion.div 
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              className="absolute bottom-28 left-0 right-0 flex justify-center z-10 px-4"
            >
              <LocationCard 
                place={selectedPlace}
                votes={votes}
                onVote={handleVote}
                onFinalize={handleFinalize}
                isAdmin={userProfile?.role === 'admin'}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Temporary Selector for Testing */}
      {view === 'map' && (
        <div className="overflow-x-auto flex gap-4 pb-2 shrink-0">
          {places.map((p: any) => (
            <button 
              key={p.id}
              onClick={() => setSelectedPlace(p)}
              className={`px-4 py-2 rounded-full whitespace-nowrap text-xs font-medium transition-all ${selectedPlace?.id === p.id ? 'bg-spanish-orange text-white shadow-lg' : 'bg-white shadow-neu-flat text-gray-600'}`}
            >
              {p.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default App;

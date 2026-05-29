import { useState, useEffect, useRef } from 'react';
import Map from './components/Map';
import LocationCard from './components/LocationCard';
import AIAssistant from './components/AIAssistant';
import SavedPlaces from './components/SavedPlaces';
import DiscoveryCard from './components/DiscoveryCard';
import type { DiscoveryPlace } from './components/DiscoveryCard';
import VotingBanner from './components/VotingBanner';
import FavoritesList from './components/FavoritesList';
import StartVoteModal from './components/StartVoteModal';
import ProfilePage from './components/ProfilePage';
import Auth from './components/Auth';
import { useRealtime } from './hooks/useRealtime';
import { supabase } from './lib/supabase';
import { Sparkles, List, Map as MapIcon, Star, Moon, Sun, X } from 'lucide-react';
import Button from './components/Button';
import { AnimatePresence, motion } from 'framer-motion';
import { useDarkMode } from './hooks/useDarkMode';

const FILTERS = [
  { id: 'all',        label: 'Wszystkie',  emoji: '🗺️' },
  { id: 'food',       label: 'Restauracje', emoji: '🍽️' },
  { id: 'sightseeing',label: 'Kulturalne',  emoji: '🏛️' },
  { id: 'activity',   label: '4fun',        emoji: '🎢' },
  { id: 'scenery',    label: 'Widoczki',    emoji: '🌅' },
  { id: 'must_have',  label: 'Must Have',   emoji: '⭐' },
] as const;

type FilterId = typeof FILTERS[number]['id'];

function App() {
  const [session, setSession] = useState<any>(null);
  const places = useRealtime<any>('places');
  const votes = useRealtime<any>('votes');
  const plans = useRealtime<any>('daily_plans');
  const favorites = useRealtime<any>('favorites');
  const rounds = useRealtime<any>('voting_rounds');

  const [selectedPlace, setSelectedPlace] = useState<any>(null);
  const [showAI, setShowAI] = useState(false);
  const [view, setView] = useState<'map' | 'saved'>('map');
  const [userProfile, setUserProfile] = useState<any>(null);
  const [activeFilter, setActiveFilter] = useState<FilterId>('all');
  const [discoveryPlace, setDiscoveryPlace] = useState<DiscoveryPlace | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number }>({ lat: 40.4168, lng: -3.7038 });
  const [showFavorites, setShowFavorites] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [pendingVote, setPendingVote] = useState<{ name: string; discovery?: DiscoveryPlace; existingId?: string } | null>(null);
  const [focus, setFocus] = useState<{ lat: number; lng: number; nonce: number } | null>(null);
  const [dark, setDark] = useDarkMode();
  const [enlargedPhoto, setEnlargedPhoto] = useState<string | null>(null);

  const activeRound = rounds.find((r: any) => r.status === 'active');
  const finalizingRef = useRef<Set<string>>(new Set());

  const filteredPlaces = activeFilter === 'all'
    ? places
    : activeFilter === 'must_have'
      ? places.filter((p: any) => p.status === 'approved')
      : places.filter((p: any) => p.category === activeFilter);

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
    if (!session?.user) return;
    supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single()
      .then(async ({ data, error }) => {
        if (data) {
          setUserProfile(data);
        } else if (error?.code === 'PGRST116') {
          const { data: created } = await supabase
            .from('profiles')
            .insert({
              id: session.user.id,
              email: session.user.email,
              role: 'user',
              username: session.user.email?.split('@')[0],
            })
            .select()
            .single();
          if (created) setUserProfile(created);
        }
      });
  }, [session]);

  const handleVote = async (placeId: string, type: 1 | -1 = 1) => {
    if (!session) return;

    const existing = votes.find(
      (v: any) => v.place_id === placeId && v.user_id === session.user.id
    );

    if (existing) {
      if (existing.vote_type === type) {
        // same direction again → toggle off
        await supabase
          .from('votes')
          .delete()
          .match({ place_id: placeId, user_id: session.user.id });
      } else {
        // switch sides
        await supabase
          .from('votes')
          .update({ vote_type: type })
          .match({ place_id: placeId, user_id: session.user.id });
      }
    } else {
      const { error } = await supabase
        .from('votes')
        .insert({ place_id: placeId, user_id: session.user.id, vote_type: type });
      if (error && error.code === '23505') {
        await supabase
          .from('votes')
          .update({ vote_type: type })
          .match({ place_id: placeId, user_id: session.user.id });
      }
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

  const handleAddFavorite = async (p: DiscoveryPlace) => {
    if (!session) return 'Brak sesji';
    const { error } = await supabase.from('favorites').insert({
      user_id: session.user.id,
      name: p.name,
      category: p.category,
      lat: p.lat,
      lng: p.lng,
      google_place_id: p.placeId,
      photo_url: p.photoUrl,
    });
    if (error) {
      console.error('Add favorite failed:', error.message);
      return error.message;
    }
    return null;
  };

  const handleRemoveFavorite = async (id: string) => {
    await supabase.from('favorites').delete().eq('id', id);
  };

  const addCandidate = async (p: DiscoveryPlace, roundId: string) => {
    const { error } = await supabase.from('places').insert({
      name: p.name,
      description: '',
      category: p.category,
      lat: p.lat,
      lng: p.lng,
      google_place_id: p.placeId,
      photo_url: p.photoUrl,
      rating: p.rating ?? null,
      user_ratings_total: p.userRatingsTotal ?? null,
      created_by: session.user.id,
      status: 'proposed',
      ai_suggested: false,
      round_id: roundId,
    });
    if (error) console.error('Add candidate failed:', error.message);
  };

  // mark an existing board place as a candidate of a round
  const addExistingCandidate = async (placeId: string, roundId: string) => {
    const { error } = await supabase
      .from('places')
      .update({ round_id: roundId, status: 'proposed' })
      .eq('id', placeId);
    if (error) console.error('Add candidate failed:', error.message);
  };

  // From a discovery point: add to the live round, or open the day-picker to start one.
  const handleSendToVote = (p: DiscoveryPlace) => {
    if (!session) return;
    setDiscoveryPlace(null);
    if (activeRound) addCandidate(p, activeRound.id);
    else setPendingVote({ name: p.name, discovery: p });
  };

  // Tap a candidate's name in the voting banner → pan the map there and open its detail card
  const handleSelectCandidate = (place: any) => {
    setDiscoveryPlace(null);
    setSelectedPlace(place);
    setFocus({ lat: Number(place.lat), lng: Number(place.lng), nonce: Date.now() });
  };

  // From a board place already on the map
  const handleSendExistingToVote = (place: any) => {
    if (!session) return;
    setSelectedPlace(null);
    if (activeRound) addExistingCandidate(place.id, activeRound.id);
    else setPendingVote({ name: place.name, existingId: place.id });
  };

  const handleStartRound = async (date: string) => {
    if (!session || !pendingVote) return;
    const endsAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from('voting_rounds')
      .insert({ started_by: session.user.id, target_date: date, ends_at: endsAt, status: 'active' })
      .select()
      .single();
    if (error) {
      console.error('Start round failed:', error.message);
    } else if (data) {
      if (pendingVote.discovery) await addCandidate(pendingVote.discovery, data.id);
      else if (pendingVote.existingId) await addExistingCandidate(pendingVote.existingId, data.id);
    }
    setPendingVote(null);
  };

  // Timer hit 0 — top-voted candidate wins. Conditional status update so only one
  // client transitions the round and writes the winner to the daily plan.
  const finalizeRound = async (round: any) => {
    if (finalizingRef.current.has(round.id)) return;
    finalizingRef.current.add(round.id);

    const candidates = places
      .filter((p: any) => p.round_id === round.id)
      .map((p: any) => ({
        id: p.id,
        n: votes
          .filter((v: any) => v.place_id === p.id)
          .reduce((s: number, v: any) => s + (v.vote_type ?? 1), 0),
      }))
      .sort((a, b) => b.n - a.n);
    const winner = candidates[0];

    const { data } = await supabase
      .from('voting_rounds')
      .update({ status: 'finished', winner_place_id: winner?.id ?? null })
      .eq('id', round.id)
      .eq('status', 'active')
      .select();

    // only the client that actually flipped the status saves the winner
    if (data && data.length && winner) {
      await supabase.from('places').update({ status: 'approved' }).eq('id', winner.id);
      await supabase.from('daily_plans').insert({
        date: round.target_date,
        place_id: winner.id,
        order: plans.length + 1,
        assigned_by: session.user.id,
      });
    }
  };

  const handleAISuggestions = async (suggestions: any[]) => {
    for (const s of suggestions) {
      const { error } = await supabase.from('places').insert({
        ...s,
        created_by: session.user.id,
        ai_suggested: true
      });
      if (error) console.error('Place insert failed:', error.message, s);
    }
    setShowAI(false);
  };

  if (!session) return <Auth />;

  return (
    <div className="fixed inset-0 bg-spanish-bg flex flex-col p-4 gap-4 overflow-hidden">
      {/* Header */}
      <div className="flex justify-end items-center px-2 shrink-0">
        <div className="flex items-center gap-3">
          <Button size="icon" variant="neutral" onClick={() => setShowFavorites(true)} className="w-10 h-10 !p-1 shadow-none">
            <Star size={26} className="text-spanish-orange" />
          </Button>
          <Button size="icon" variant="neutral" onClick={() => setDark(d => !d)} className="w-10 h-10 !p-1 shadow-none">
            {dark ? <Sun size={22} className="text-spanish-orange" /> : <Moon size={22} className="text-gray-600 dark:text-gray-300" />}
          </Button>
          <button
            onClick={() => setShowProfile(true)}
            className="w-10 h-10 rounded-full bg-spanish-bg shadow-neu-flat border-2 border-white dark:border-gray-700 overflow-hidden active:shadow-neu-pressed transition-all"
          >
            <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${userProfile?.avatar_url ?? session.user.email}`} alt="Avatar" />
          </button>
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
              className="w-full h-full relative"
            >
              {/* Filter pills */}
              <div className="absolute top-4 left-0 right-0 z-10 px-4">
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                  {FILTERS.map(f => (
                    <button
                      key={f.id}
                      onClick={() => setActiveFilter(f.id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                        activeFilter === f.id
                          ? 'bg-spanish-orange text-white shadow-lg scale-105'
                          : 'bg-white/90 dark:bg-gray-700/90 backdrop-blur text-gray-600 dark:text-gray-300 shadow-neu-flat'
                      }`}
                    >
                      <span>{f.emoji}</span>
                      <span>{f.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Live voting round */}
              <AnimatePresence>
                {activeRound && (
                  <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="absolute top-16 left-4 right-20 z-20"
                  >
                    <VotingBanner
                      round={activeRound}
                      places={places}
                      votes={votes}
                      userId={session.user.id}
                      onVote={handleVote}
                      onExpire={finalizeRound}
                      onSelectCandidate={handleSelectCandidate}
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              <Map
                places={filteredPlaces}
                categoryFilter={activeFilter}
                onMapClick={() => { setSelectedPlace(null); setDiscoveryPlace(null); }}
                onMarkerClick={(place) => { setDiscoveryPlace(null); setSelectedPlace(place); }}
                onDiscoveryClick={(p) => { setSelectedPlace(null); setDiscoveryPlace(p); }}
                onLocate={(lat, lng) => setUserLocation({ lat, lng })}
                focus={focus}
              />
            </motion.div>
          ) : (
            <motion.div
              key="saved"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="w-full h-full"
            >
              <SavedPlaces
                favorites={favorites}
                currentUserId={session.user.id}
                onRemove={handleRemoveFavorite}
              />
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
            variant={view === 'saved' ? 'primary' : 'neutral'} 
            size="icon" 
            className="w-14 h-14"
            onClick={() => setView('saved')}
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
                currentLocation={userLocation}
                onSuggestions={handleAISuggestions}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Discovery preview Overlay */}
        <AnimatePresence>
          {discoveryPlace && view === 'map' && (
            <motion.div
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              className="absolute bottom-28 left-0 right-0 flex justify-center z-30 px-4"
            >
              <DiscoveryCard
                place={discoveryPlace}
                hasActiveRound={!!activeRound}
                onClose={() => setDiscoveryPlace(null)}
                onFavorite={handleAddFavorite}
                onSendToVote={handleSendToVote}
                onImageClick={() => setEnlargedPhoto(discoveryPlace.photoUrl)}
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
                userId={session.user.id}
                hasActiveRound={!!activeRound}
                onVote={handleVote}
                onFinalize={handleFinalize}
                onFavorite={handleAddFavorite}
                onSendToVote={handleSendExistingToVote}
                onImageClick={() => setEnlargedPhoto(selectedPlace.photo_url)}
                isAdmin={userProfile?.role === 'admin'}
                isCandidate={!!activeRound && selectedPlace?.round_id === activeRound.id}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Favorites Overlay (private) */}
        <AnimatePresence>
          {showFavorites && (
            <motion.div
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              className="absolute inset-x-0 bottom-28 z-30 px-4 flex justify-center"
            >
              <FavoritesList
                favorites={favorites}
                onClose={() => setShowFavorites(false)}
                onRemove={handleRemoveFavorite}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Profile Overlay */}
        <AnimatePresence>
          {showProfile && (
            <motion.div
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              className="absolute inset-x-0 bottom-28 z-30 px-4 flex justify-center"
            >
              <ProfilePage
                session={session}
                userProfile={userProfile}
                onClose={() => setShowProfile(false)}
                onSignOut={() => { setShowProfile(false); supabase.auth.signOut(); }}
                onAvatarChange={async (seed) => {
                  await supabase.from('profiles').update({ avatar_url: seed }).eq('id', session.user.id);
                  setUserProfile((p: any) => ({ ...p, avatar_url: seed }));
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Start-a-round day picker */}
        <AnimatePresence>
          {pendingVote && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-40"
            >
              <StartVoteModal
                placeName={pendingVote.name}
                onConfirm={handleStartRound}
                onCancel={() => setPendingVote(null)}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Enlarged Photo Lightbox */}
        <AnimatePresence>
          {enlargedPhoto && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
              onClick={() => setEnlargedPhoto(null)}
            >
              <button 
                className="absolute top-6 right-6 text-white bg-white/10 hover:bg-white/20 p-2 rounded-full backdrop-blur transition-colors"
                onClick={() => setEnlargedPhoto(null)}
              >
                <X size={24} />
              </button>
              <motion.img 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                src={enlargedPhoto} 
                alt="" 
                className="w-[95vw] h-[85vh] rounded-2xl object-contain shadow-2xl" 
                onClick={(e) => e.stopPropagation()}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

    </div>
  );
}

export default App;

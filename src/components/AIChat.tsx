import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { X, MessageCircle, Plus, Trash2, Loader2, Sparkles, ArrowUp, MapPin } from 'lucide-react';
import { chatWithAI, type ChatMsg, type NearbyPlace } from '../lib/ai-chat';

const MAX_CHATS = 3;

interface ChatSession {
  id: string;
  title: string;
  messages: ChatMsg[];
  createdAt: string;
}

interface AIChatProps {
  userId: string;
  currentLocation: { lat: number; lng: number };
  locationLabel?: string | null;
  nearbyPlaces?: NearbyPlace[];
  onClose: () => void;
}

const storageKey = (userId: string) => `ai_chats_${userId}`;

function loadSessions(userId: string): ChatSession[] {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveSessions(userId: string, sessions: ChatSession[]) {
  localStorage.setItem(storageKey(userId), JSON.stringify(sessions.slice(0, MAX_CHATS)));
}

// Render assistant text, turning [[Place Name]] markers into blue Google Maps links.
function renderAssistant(text: string, locationLabel?: string | null): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const re = /\[\[(.+?)\]\]/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const name = m[1];
    const query = encodeURIComponent(locationLabel ? `${name}, ${locationLabel}` : name);
    parts.push(
      <a
        key={`l${key++}`}
        href={`https://www.google.com/maps/search/?api=1&query=${query}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-500 dark:text-blue-400 font-semibold underline underline-offset-2"
      >
        {name}
      </a>
    );
    last = re.lastIndex;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

const STARTERS = [
  'Co dobrego zjeść w okolicy?',
  'Polecasz jakąś knajpę na wieczór?',
  'Jakie regionalne danie muszę spróbować?',
  'Co warto zobaczyć w pobliżu?',
];

const AIChat: React.FC<AIChatProps> = ({ userId, currentLocation, locationLabel, nearbyPlaces, onClose }) => {
  const [sessions, setSessions] = useState<ChatSession[]>(() => loadSessions(userId));
  const [view, setView] = useState<'list' | 'chat'>('list');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    saveSessions(userId, sessions);
  }, [sessions, userId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, sending]);

  const atCap = sessions.length >= MAX_CHATS;

  const startNewChat = () => {
    if (atCap) return;
    setActiveId(null);
    setMessages([]);
    setInput('');
    setView('chat');
  };

  const openChat = (s: ChatSession) => {
    setActiveId(s.id);
    setMessages(s.messages);
    setInput('');
    setView('chat');
  };

  const deleteChat = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSessions(prev => prev.filter(s => s.id !== id));
  };

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    const next = [...messages, { role: 'user', content: trimmed } as ChatMsg];
    setMessages(next);
    setInput('');
    setSending(true);

    const reply = await chatWithAI(next, {
      lat: currentLocation.lat,
      lng: currentLocation.lng,
      locationLabel,
      nearbyPlaces,
    });
    const withReply = [...next, { role: 'assistant', content: reply } as ChatMsg];
    setMessages(withReply);
    setSending(false);

    if (activeId) {
      setSessions(prev => prev.map(s => (s.id === activeId ? { ...s, messages: withReply } : s)));
    } else {
      const id = crypto.randomUUID();
      const title = next[0].content.slice(0, 42);
      const sess: ChatSession = { id, title, messages: withReply, createdAt: new Date().toISOString() };
      setActiveId(id);
      setSessions(prev => [sess, ...prev].slice(0, MAX_CHATS));
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    send(input);
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
        className="relative bg-spanish-bg dark:bg-gray-900 rounded-t-3xl h-[88vh] flex flex-col"
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 shrink-0">
          <div className="flex items-center gap-2">
            {view === 'chat' && (
              <button
                onClick={() => setView('list')}
                className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mr-1"
              >
                <span className="text-gray-500 text-sm">←</span>
              </button>
            )}
            <MessageCircle size={20} className="text-spanish-orange" />
            <span className="font-bold text-gray-800 dark:text-gray-100">
              {view === 'list' ? 'Czaty z AI' : 'Asystent okolicy'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {/* Location pill — always visible so user knows what context AI uses */}
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-spanish-orange/10 max-w-[140px]">
              <MapPin size={11} className="text-spanish-orange shrink-0" />
              <span className="text-spanish-orange text-xs font-semibold truncate">
                {locationLabel ?? `${currentLocation.lat.toFixed(3)}, ${currentLocation.lng.toFixed(3)}`}
              </span>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center"
            >
              <X size={16} className="text-gray-500" />
            </button>
          </div>
        </div>

        {view === 'list' ? (
          /* ===== Chat history list ===== */
          <div className="flex-1 overflow-y-auto px-5 pb-8">
            <button
              onClick={startNewChat}
              disabled={atCap}
              className={`w-full flex items-center justify-center gap-2 p-4 rounded-2xl font-bold text-base shadow-lg transition-all mb-2 ${
                atCap
                  ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed'
                  : 'bg-spanish-orange text-white active:scale-[0.98]'
              }`}
            >
              <Plus size={20} />
              Nowy czat
            </button>
            <p className="text-xs text-gray-400 dark:text-gray-500 text-center mb-5">
              {atCap ? 'Limit 3 czatów — usuń któryś, aby zacząć nowy' : `${sessions.length}/${MAX_CHATS} czatów`}
            </p>

            {sessions.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-gray-400 dark:text-gray-500">
                <MessageCircle size={32} className="opacity-40" />
                <p className="text-sm font-medium">Brak czatów</p>
                <p className="text-xs text-center">Zapytaj AI o najlepsze miejsca i dania w Twojej okolicy</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {sessions.map(s => {
                  const last = s.messages[s.messages.length - 1];
                  return (
                    <motion.div
                      key={s.id}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      onClick={() => openChat(s)}
                      className="flex items-center gap-3 p-4 rounded-2xl bg-white dark:bg-gray-800 shadow-neu-flat cursor-pointer active:scale-[0.98] transition-all"
                    >
                      <div className="w-10 h-10 rounded-xl bg-spanish-orange/10 flex items-center justify-center shrink-0">
                        <MessageCircle size={18} className="text-spanish-orange" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm text-gray-800 dark:text-gray-100 truncate">{s.title}</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 truncate">
                          {last ? last.content : 'Pusty czat'}
                        </p>
                      </div>
                      <button
                        onClick={(e) => deleteChat(s.id, e)}
                        className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-gray-300 dark:text-gray-600 hover:text-spanish-red hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      >
                        <Trash2 size={15} />
                      </button>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          /* ===== Conversation ===== */
          <>
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 pb-4">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center gap-3 pt-8">
                  <div className="w-14 h-14 rounded-2xl bg-spanish-orange/10 flex items-center justify-center">
                    <Sparkles size={26} className="text-spanish-orange" />
                  </div>
                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 text-center">
                    Cześć! Powiedz czego szukasz w okolicy
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 text-center px-6">
                    Polecę Ci miejsca, knajpy i regionalne dania{locationLabel ? ` w: ${locationLabel}` : ' w pobliżu'}.
                  </p>
                  <div className="flex flex-col gap-2 w-full mt-3">
                    {STARTERS.map(s => (
                      <button
                        key={s}
                        onClick={() => send(s)}
                        className="text-left text-sm px-4 py-3 rounded-2xl bg-white dark:bg-gray-800 shadow-neu-flat text-gray-700 dark:text-gray-200 active:scale-[0.98] transition-all"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-3 pt-2">
                  {messages.map((m, i) => (
                    <div
                      key={i}
                      className={`max-w-[82%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                        m.role === 'user'
                          ? 'self-end bg-spanish-orange text-white rounded-br-md'
                          : 'self-start bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 shadow-neu-flat rounded-bl-md'
                      }`}
                    >
                      {m.role === 'assistant' ? renderAssistant(m.content, locationLabel) : m.content}
                    </div>
                  ))}
                  {sending && (
                    <div className="self-start flex items-center gap-2 px-4 py-2.5 rounded-2xl rounded-bl-md bg-white dark:bg-gray-800 shadow-neu-flat text-gray-400">
                      <Loader2 size={15} className="animate-spin" />
                      <span className="text-sm">Myślę...</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Composer */}
            <form
              onSubmit={onSubmit}
              className="shrink-0 px-4 pt-2 pb-6 flex items-end gap-2 bg-spanish-bg dark:bg-gray-900 border-t border-gray-200/60 dark:border-gray-700/60"
            >
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Napisz wiadomość..."
                className="flex-1 bg-white dark:bg-gray-800 rounded-2xl px-4 h-12 text-sm text-gray-800 dark:text-gray-100 placeholder-gray-400 shadow-neu-flat outline-none"
              />
              <button
                type="submit"
                disabled={!input.trim() || sending}
                className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-all ${
                  input.trim() && !sending
                    ? 'bg-spanish-orange text-white shadow-lg active:scale-[0.95]'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-400'
                }`}
              >
                {sending ? <Loader2 size={18} className="animate-spin" /> : <ArrowUp size={18} />}
              </button>
            </form>
          </>
        )}
      </motion.div>
    </motion.div>
  );
};

export default AIChat;

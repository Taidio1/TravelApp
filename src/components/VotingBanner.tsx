import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Button from './Button';
import { ThumbsUp, ThumbsDown, Timer, Trophy } from 'lucide-react';

interface VotingBannerProps {
  round: any;
  places: any[];
  votes: any[];
  userId?: string;
  onVote: (placeId: string, type: 1 | -1) => void;
  onExpire: (round: any) => void;
  onSelectCandidate?: (place: any) => void;
}

const fmt = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

const VotingBanner: React.FC<VotingBannerProps> = ({ round, places, votes, userId, onVote, onExpire, onSelectCandidate }) => {
  const [now, setNow] = useState(Date.now());
  const firedRef = useRef(false);

  const endsAt = new Date(round.ends_at).getTime();
  const remaining = endsAt - now;

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (remaining <= 0 && !firedRef.current) {
      firedRef.current = true;
      onExpire(round);
    }
  }, [remaining, round, onExpire]);

  const candidates = places
    .filter((p) => p.round_id === round.id)
    .map((p) => {
      const pv = votes.filter((v) => v.place_id === p.id);
      return {
        ...p,
        n: pv.reduce((s, v) => s + (v.vote_type ?? 1), 0),
        mine: pv.find((v) => v.user_id === userId)?.vote_type,
      };
    })
    .sort((a, b) => b.n - a.n);

  return (
    <div className="bg-white/95 dark:bg-gray-800/95 backdrop-blur rounded-3xl shadow-neu-flat overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 bg-spanish-orange text-white">
        <span className="flex items-center gap-1.5 text-sm font-bold">
          <Trophy size={16} /> Głosowanie na {round.target_date}
        </span>
        <span className="flex items-center gap-1.5 text-sm font-bold tabular-nums">
          <Timer size={16} /> {fmt(remaining)}
        </span>
      </div>

      {candidates.length === 0 ? (
        <p className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">Brak kandydatów — dorzuć miejsce z mapy.</p>
      ) : (
        <motion.ul layout className="max-h-52 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700">
          <AnimatePresence initial={false}>
            {candidates.map((c, i) => (
              <motion.li
                key={c.id}
                layout
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                className="flex items-center gap-2 px-3 py-2"
              >
                <span className={`w-5 text-center text-sm font-bold ${i === 0 ? 'text-spanish-orange' : 'text-gray-300 dark:text-gray-600'}`}>
                  {i + 1}
                </span>
                <button
                  onClick={() => onSelectCandidate?.(c)}
                  className="flex-1 min-w-0 text-left text-sm font-medium text-gray-700 dark:text-gray-200 truncate hover:text-spanish-orange active:text-spanish-orange transition-colors"
                >
                  {c.name}
                </button>
                <Button
                  size="icon"
                  variant="neutral"
                  onClick={() => onVote(c.id, -1)}
                  className={`w-8 h-8 !p-0 transition-all ${c.mine === -1 ? 'shadow-neu-pressed scale-90' : ''}`}
                >
                  <ThumbsDown size={15} className="text-spanish-red" />
                </Button>
                <span className="w-6 text-center text-sm font-bold text-gray-700 dark:text-gray-200 tabular-nums overflow-hidden">
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.span
                      key={c.n}
                      initial={{ y: -12, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      exit={{ y: 12, opacity: 0 }}
                      transition={{ duration: 0.18 }}
                      className="inline-block"
                    >
                      {c.n}
                    </motion.span>
                  </AnimatePresence>
                </span>
                <Button
                  size="icon"
                  variant="neutral"
                  onClick={() => onVote(c.id, 1)}
                  className={`w-8 h-8 !p-0 transition-all ${c.mine === 1 ? 'shadow-neu-pressed scale-90' : ''}`}
                >
                  <ThumbsUp size={15} className="text-spanish-orange" />
                </Button>
              </motion.li>
            ))}
          </AnimatePresence>
        </motion.ul>
      )}
    </div>
  );
};

export default VotingBanner;

import React, { useState } from 'react';
import { X, LogOut, User, Crown, Mail, Pencil, Check, Moon, Sun } from 'lucide-react';
import Card from './Card';
import Button from './Button';

const AVATAR_SEEDS = [
  'traveler', 'explorer', 'wanderer', 'adventurer',
  'madrid', 'barcelona', 'flamenco', 'siesta',
  'tapas', 'paella', 'fiesta', 'barca',
];

const avatarUrl = (seed: string) =>
  `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`;

interface ProfilePageProps {
  session: any;
  userProfile: any;
  dark: boolean;
  onDarkToggle: () => void;
  onClose: () => void;
  onSignOut: () => void;
  onAvatarChange: (seed: string) => void;
}

const ProfilePage: React.FC<ProfilePageProps> = ({ session, userProfile, dark, onDarkToggle, onClose, onSignOut, onAvatarChange }) => {
  const email = session?.user?.email ?? '';
  const username = userProfile?.username ?? email.split('@')[0];
  const isAdmin = userProfile?.role === 'admin';
  const currentSeed = userProfile?.avatar_url ?? email;

  const [picking, setPicking] = useState(false);
  const [selected, setSelected] = useState(currentSeed);

  const handleConfirm = () => {
    if (selected !== currentSeed) onAvatarChange(selected);
    setPicking(false);
  };

  return (
    <Card className="flex flex-col gap-5 w-full max-w-sm">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
          <User size={20} className="text-spanish-orange" /> Profil
        </h3>
        <button onClick={onClose} className="text-gray-400 dark:text-gray-500">
          <X size={20} />
        </button>
      </div>

      <div className="flex flex-col items-center gap-3">
        <div className="relative">
          <div className="w-20 h-20 rounded-full bg-spanish-bg shadow-neu-flat border-2 border-white dark:border-gray-700 overflow-hidden">
            <img src={avatarUrl(picking ? selected : currentSeed)} alt="Avatar" />
          </div>
          <button
            onClick={() => { setPicking(p => !p); setSelected(currentSeed); }}
            className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-spanish-orange text-white flex items-center justify-center shadow-md"
          >
            <Pencil size={13} />
          </button>
        </div>

        <div className="text-center">
          <p className="text-xl font-bold text-gray-800 dark:text-gray-100">{username}</p>
          {isAdmin && (
            <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-spanish-orange/10 text-spanish-orange">
              <Crown size={11} /> Admin
            </span>
          )}
        </div>
      </div>

      {picking && (
        <div className="flex flex-col gap-3">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 text-center">Wybierz avatar</p>
          <div className="grid grid-cols-4 gap-2">
            {AVATAR_SEEDS.map(seed => (
              <button
                key={seed}
                onClick={() => setSelected(seed)}
                className={`w-full aspect-square rounded-full overflow-hidden border-2 transition-all ${
                  selected === seed
                    ? 'border-spanish-orange shadow-lg scale-110'
                    : 'border-transparent shadow-neu-flat'
                }`}
              >
                <img src={avatarUrl(seed)} alt={seed} />
              </button>
            ))}
          </div>
          <Button variant="primary" onClick={handleConfirm} className="flex items-center justify-center gap-2">
            <Check size={16} /> Zapisz
          </Button>
        </div>
      )}

      <div className="bg-white dark:bg-gray-700 rounded-2xl p-3 shadow-neu-flat flex items-center gap-3">
        <Mail size={16} className="text-gray-400 shrink-0" />
        <p className="text-sm text-gray-600 dark:text-gray-300 truncate">{email}</p>
      </div>

      <button
        onClick={onDarkToggle}
        className="flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-700 rounded-2xl shadow-neu-flat active:shadow-neu-pressed transition-all"
      >
        <div className="flex items-center gap-3">
          {dark ? <Moon size={16} className="text-spanish-orange" /> : <Sun size={16} className="text-spanish-orange" />}
          <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
            {dark ? 'Tryb ciemny' : 'Tryb jasny'}
          </span>
        </div>
        <div className={`w-10 h-6 rounded-full transition-colors flex items-center px-0.5 ${dark ? 'bg-spanish-orange' : 'bg-gray-300'}`}>
          <div className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${dark ? 'translate-x-4' : 'translate-x-0'}`} />
        </div>
      </button>

      <Button variant="neutral" onClick={onSignOut} className="flex items-center justify-center gap-2 text-spanish-red">
        <LogOut size={18} />
        Wyloguj się
      </Button>
    </Card>
  );
};

export default ProfilePage;

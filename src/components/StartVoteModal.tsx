import React, { useState } from 'react';
import Card from './Card';
import Button from './Button';
import { X, Vote, CalendarDays } from 'lucide-react';

interface StartVoteModalProps {
  placeName: string;
  onConfirm: (date: string) => void;
  onCancel: () => void;
}

const today = () => new Date().toISOString().slice(0, 10);

const StartVoteModal: React.FC<StartVoteModalProps> = ({ placeName, onConfirm, onCancel }) => {
  const [date, setDate] = useState(today());
  const [submitting, setSubmitting] = useState(false);

  const confirm = () => {
    setSubmitting(true);
    onConfirm(date);
  };

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/30 px-6">
      <Card className="flex flex-col gap-4 w-full max-w-sm">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
              <Vote size={20} className="text-spanish-orange" /> Nowe głosowanie
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Pierwszy kandydat: <span className="font-semibold">{placeName}</span>
            </p>
          </div>
          <button onClick={onCancel} className="text-gray-400 dark:text-gray-500 shrink-0">
            <X size={20} />
          </button>
        </div>

        <p className="text-sm text-gray-600 dark:text-gray-300">
          Masz 5 minut. Inni dorzucą propozycje i zagłosują — zwycięzca trafi do planu na wybrany dzień.
        </p>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
            <CalendarDays size={14} /> Dzień wyjazdu
          </span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="bg-white dark:bg-gray-700 rounded-2xl px-4 py-3 text-sm text-gray-700 dark:text-gray-200 shadow-neu-pressed outline-none"
          />
        </label>

        <Button variant="primary" onClick={confirm} disabled={submitting || !date} className="mt-1">
          Start 5:00
        </Button>
      </Card>
    </div>
  );
};

export default StartVoteModal;

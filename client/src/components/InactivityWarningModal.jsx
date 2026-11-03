import React from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { translations } from '../data/translations';

export default function InactivityWarningModal({ secondsRemaining, onStillHere, currentLang }) {
  const t = translations[currentLang] || translations.fr;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-6 animate-fadeIn">
      <div className="bg-slate-900 border-4 border-amber-500 rounded-3xl p-8 md:p-12 max-w-lg w-full text-center shadow-2xl flex flex-col items-center">
        {/* Animated Warning Icon */}
        <div className="w-20 h-20 rounded-full bg-amber-500/20 border-2 border-amber-400 flex items-center justify-center mb-6 animate-pulse">
          <AlertCircle className="w-12 h-12 text-amber-400" />
        </div>

        <h2 className="text-3xl md:text-4xl font-black text-white">
          {t.inactivityWarning}
        </h2>

        <p className="text-slate-300 text-lg mt-3">
          {t.inactivitySub} <span className="font-mono font-bold text-amber-400 text-2xl">{secondsRemaining}s</span>
        </p>

        {/* Huge Tactile Button to confirm presence */}
        <button
          onClick={onStillHere}
          className="mt-8 w-full py-5 px-8 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 text-xl font-black uppercase tracking-wider shadow-xl flex items-center justify-center space-x-3 active:scale-95 transition-transform"
        >
          <CheckCircle2 className="w-8 h-8 text-slate-950" />
          <span>{t.imHere}</span>
        </button>
      </div>
    </div>
  );
}


import React, { useEffect, useState } from 'react';
import { ArrowLeft, Sparkles, Clock, Globe } from 'lucide-react';
import CountryFlag from '../../components/CountryFlag';

export default function LanguageSelectView({ onSelectLanguage, onBackToScreensaver, kioskConfig }) {
  const [secondsLeft, setSecondsLeft] = useState(15);
  const activeCity = kioskConfig?.active_city || 'Fianarantsoa';

  // 15 seconds timeout to return to screensaver if untouched
  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onBackToScreensaver();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [onBackToScreensaver]);

  const languages = [
    {
      code: 'mg',
      country: 'Madagasikara',
      name: 'Malagasy',
      greeting: `Tongasoa eto ${activeCity} !`,
      subtitle: `Fikarohana sy torolalana amin’ny teny malagasy eto ${activeCity}`,
      action: 'Safidio ny teny Malagasy',
      accentColor: 'border-emerald-500/50 hover:border-emerald-400 bg-gradient-to-b from-slate-900 to-emerald-950/40 text-emerald-300',
      btnColor: 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/40'
    },
    {
      code: 'fr',
      country: 'France / Francophonie',
      name: 'Français',
      greeting: `Bienvenue à ${activeCity} !`,
      subtitle: `Découvrez les sites, hôtels, restos et circuits de ${activeCity}`,
      action: 'Choisir le Français',
      accentColor: 'border-blue-500/50 hover:border-blue-400 bg-gradient-to-b from-slate-900 to-blue-950/40 text-blue-300',
      btnColor: 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/40'
    },
    {
      code: 'en',
      country: 'International / English',
      name: 'English',
      greeting: `Welcome to ${activeCity} !`,
      subtitle: `Explore historic sites, maps, hotels and tours in ${activeCity}`,
      action: 'Select English',
      accentColor: 'border-amber-500/50 hover:border-amber-400 bg-gradient-to-b from-slate-900 to-amber-950/40 text-amber-300',
      btnColor: 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-900/40'
    }
  ];

  return (
    <div className="relative w-full h-full bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 flex flex-col justify-between p-6 md:p-10 select-none overflow-hidden pb-20">
      {/* Top Header */}
      <div className="flex items-center justify-between z-10">
        <button
          onClick={onBackToScreensaver}
          className="flex items-center space-x-2 bg-slate-900/90 hover:bg-slate-800 text-slate-200 px-5 py-3 rounded-2xl border border-slate-700/80 font-bold active:scale-95 transition shadow-lg"
        >
          <ArrowLeft className="w-5 h-5 text-amber-400" />
          <span>Retour à l'écran de veille</span>
        </button>

        <div className="flex items-center space-x-3 bg-slate-900/80 border border-slate-700/80 px-4 py-2 rounded-2xl shadow-lg">
          <Clock className="w-4 h-4 text-amber-400 animate-pulse" />
          <div className="text-right">
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Inactivité</span>
            <span className="text-sm font-black text-amber-400 font-mono leading-none">{secondsLeft}s</span>
          </div>
        </div>
      </div>

      {/* Center Welcome Banner */}
      <div className="text-center max-w-3xl mx-auto my-2 z-10">
        <div className="inline-flex items-center space-x-2 bg-gradient-to-r from-amber-500/20 via-emerald-500/20 to-blue-500/20 px-5 py-2 rounded-full border border-amber-400/40 shadow-inner mb-3">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span className="text-xs font-black uppercase tracking-widest text-amber-300">
            Kiosque Touristique Numérique • {activeCity}
          </span>
        </div>
        <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight">
          Safidio ny teninao • Choisissez votre langue • Choose your language
        </h1>
        <p className="text-slate-400 text-sm md:text-base mt-2 max-w-2xl mx-auto">
          Touchez votre drapeau ou votre langue pour débuter la navigation interactive
        </p>
      </div>

      {/* 3 Massive Tactile Language Cards with Official Crisp Flags */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 max-w-6xl mx-auto w-full my-auto z-10">
        {languages.map((lang) => (
          <button
            key={lang.code}
            onClick={() => onSelectLanguage(lang.code)}
            className={`group relative flex flex-col items-center justify-between border-2 ${lang.accentColor} rounded-3xl p-6 md:p-8 shadow-2xl transition-all duration-200 active:scale-95 hover:scale-[1.02] cursor-pointer min-h-[360px] md:min-h-[400px]`}
          >
            {/* Top Tag */}
            <span className="text-[11px] uppercase font-black tracking-wider text-slate-400 bg-slate-950/60 px-3 py-1 rounded-full border border-slate-800">
              {lang.country}
            </span>

            {/* Crisp HD Vector Flag */}
            <div className="my-4 transform group-hover:scale-105 transition-transform duration-300 filter drop-shadow-xl">
              <CountryFlag
                code={lang.code}
                className="w-36 h-24 md:w-44 md:h-28"
                rounded="rounded-2xl"
              />
            </div>

            {/* Language Name */}
            <div className="text-center my-2">
              <h2 className="text-3xl md:text-4xl font-black text-white tracking-tight group-hover:text-amber-300 transition-colors">
                {lang.name}
              </h2>
              <p className="text-white/90 text-sm md:text-base font-bold mt-1">
                "{lang.greeting}"
              </p>
              <p className="text-slate-400 text-xs mt-1 max-w-xs font-normal">
                {lang.subtitle}
              </p>
            </div>

            {/* Big Tactile Selection Button */}
            <div className={`w-full mt-4 py-3 rounded-2xl font-black text-xs md:text-sm uppercase tracking-wider shadow-lg flex items-center justify-center space-x-2 transition-all ${lang.btnColor}`}>
              <Globe className="w-4 h-4" />
              <span>{lang.action}</span>
            </div>
          </button>
        ))}
      </div>

      {/* Bottom Progress Bar for 15s timeout */}
      <div className="w-full max-w-4xl mx-auto bg-slate-800/80 h-2.5 rounded-full overflow-hidden mt-4 z-10 border border-slate-700/60">
        <div
          className="bg-gradient-to-r from-amber-400 to-emerald-400 h-full transition-all duration-1000 ease-linear rounded-full"
          style={{ width: `${(secondsLeft / 15) * 100}%` }}
        />
      </div>
    </div>
  );
}

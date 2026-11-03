import React, { useState, useEffect } from 'react';
import { Clock, CloudSun, Home, ArrowLeft } from 'lucide-react';
import { translations } from '../data/translations';
import { fetchLiveWeather } from '../services/weather';
import CountryFlag from './CountryFlag';

export default function Header({ currentScreen, currentLang, onBack, onHome, onChangeLang, kioskConfig }) {
  const [time, setTime] = useState('');
  const city = kioskConfig?.active_city || 'Fianarantsoa';
  const region = kioskConfig?.active_region || 'Haute Matsiatra';
  const lat = kioskConfig?.active_lat ?? -21.4536;
  const lng = kioskConfig?.active_lng ?? 47.0858;
  const [weather, setWeather] = useState({ temp: 24, city });
  const t = translations[currentLang] || translations.fr;

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Load real live weather from Open-Meteo API using active city GPS
    fetchLiveWeather(lat, lng, city).then((data) => {
      if (data) setWeather(data);
    });
    // Refresh weather every 15 minutes
    const weatherInterval = setInterval(() => {
      fetchLiveWeather(lat, lng, city).then((data) => {
        if (data) setWeather(data);
      });
    }, 15 * 60 * 1000);
    return () => clearInterval(weatherInterval);
  }, [lat, lng, city]);

  const langNames = {
    mg: 'Malagasy',
    fr: 'Français',
    en: 'English'
  };

  return (
    <header className="w-full bg-slate-900/95 backdrop-blur-md border-b border-slate-800 text-white px-4 md:px-8 py-3.5 flex items-center justify-between z-30 shadow-xl flex-shrink-0">
      {/* Navigation gauche: Retour / Accueil / Titre Kiosque */}
      <div className="flex items-center space-x-3">
        {currentScreen !== 'MAIN_MENU' && currentScreen !== 'LANG_SELECT' && (
          <div className="flex items-center space-x-2">
            <button
              onClick={onBack}
              className="flex items-center space-x-2 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 border border-slate-700 text-white px-4 py-2.5 rounded-2xl text-sm font-bold shadow-md active:scale-95 transition"
              title="Page précédente"
            >
              <ArrowLeft className="w-5 h-5 text-amber-400" />
              <span className="hidden sm:inline">{t.back || 'Retour'}</span>
            </button>

            <button
              onClick={onHome}
              className="flex items-center space-x-2 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 border border-slate-700 text-white px-4 py-2.5 rounded-2xl text-sm font-bold shadow-md active:scale-95 transition"
              title="Menu principal"
            >
              <Home className="w-5 h-5 text-emerald-400" />
              <span className="hidden sm:inline">{t.home || 'Menu'}</span>
            </button>
          </div>
        )}

        <div className="flex flex-col ml-1">
          <div className="flex items-center space-x-2">
            <span className="text-lg md:text-xl font-black tracking-tight text-white uppercase">
              {city}
            </span>
            <span className="text-[10px] uppercase bg-amber-400/20 text-amber-300 px-2 py-0.5 rounded-full font-black border border-amber-400/30">
              Kiosque
            </span>
          </div>
          <span className="text-[11px] text-slate-400 font-medium hidden sm:inline">
            {region} • Madagascar
          </span>
        </div>
      </div>

      {/* Météo, Heure locale & Bouton de langue avec drapeau officiel */}
      <div className="flex items-center space-x-3 md:space-x-5">
        {/* Météo en temps réel */}
        <div className="hidden sm:flex items-center space-x-2.5 bg-slate-800/80 px-3.5 py-2 rounded-2xl border border-slate-700/60" title={`Météo réelle en direct (${weather.city})`}>
          <CloudSun className="w-5 h-5 text-amber-400 flex-shrink-0" />
          <div className="flex items-baseline space-x-1">
            <span className="font-extrabold text-sm md:text-base text-white">{weather.temp}°C</span>
            <span className="text-[10px] text-slate-400 font-semibold">({weather.city})</span>
          </div>
        </div>

        {/* Heure */}
        <div className="flex items-center space-x-2 bg-slate-800/80 px-3.5 py-2 rounded-2xl border border-slate-700/60">
          <Clock className="w-4 h-4 text-sky-400" />
          <span className="font-mono text-sm md:text-base font-bold tracking-wider text-slate-100">{time}</span>
        </div>

        {/* Sélecteur de langue avec Drapeau Officiel SVG */}
        <button
          onClick={onChangeLang}
          className="flex items-center space-x-2.5 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white font-bold px-3.5 py-2 rounded-2xl shadow-lg border border-amber-400/40 active:scale-95 transition"
          title="Changer de langue"
        >
          <CountryFlag code={currentLang} className="w-6 h-4" rounded="rounded-sm" />
          <span className="text-xs md:text-sm font-black tracking-wide">{langNames[currentLang]}</span>
        </button>
      </div>
    </header>
  );
}

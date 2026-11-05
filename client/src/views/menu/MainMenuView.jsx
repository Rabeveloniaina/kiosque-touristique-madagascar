import React from 'react';
import {
  Map, UtensilsCrossed, SunMedium, Languages, ShieldAlert, Coins,
  ChevronRight, MapPin, Wifi, Star, Calendar, Phone, Euro, ArrowLeftRight
} from 'lucide-react';
import { translations } from '../../data/translations';

export default function MainMenuView({ currentLang, onSelectModule, kioskConfig }) {
  const t = translations[currentLang] || translations.fr;
  const activeCity = kioskConfig?.active_city || 'Madagascar';
  const region = kioskConfig?.active_region || '';

  const welcomeGreeting =
    currentLang === 'mg'
      ? `Tongasoa eto ${activeCity} !`
      : currentLang === 'en'
      ? `Welcome to ${activeCity}!`
      : `Bienvenue à ${activeCity} !`;

  const menuItems = [
    {
      id: 'MAP',
      icon: Map,
      title: t.modules.map.title,
      desc: t.modules.map.desc,
      gradient: 'from-blue-600 to-indigo-700',
      glow: 'group-hover:shadow-blue-500/20',
      iconBg: 'bg-blue-600',
      border: 'border-blue-500/20 hover:border-blue-400/60',
      badge: 'GPS & QR Code',
      badgeColor: 'bg-blue-900/80 text-blue-300 border-blue-500/30',
      stats: [{ icon: MapPin, text: 'Sites touristiques' }, { icon: Star, text: 'Itinéraires' }]
    },
    {
      id: 'PLACES',
      icon: UtensilsCrossed,
      title: t.modules.places.title,
      desc: t.modules.places.desc,
      gradient: 'from-amber-600 to-orange-700',
      glow: 'group-hover:shadow-amber-500/20',
      iconBg: 'bg-amber-600',
      border: 'border-amber-500/20 hover:border-amber-400/60',
      badge: 'Contacts & Tarifs',
      badgeColor: 'bg-amber-900/80 text-amber-300 border-amber-500/30',
      stats: [{ icon: UtensilsCrossed, text: 'Restaurants' }, { icon: Star, text: 'Hôtels' }]
    },
    {
      id: 'WEATHER_EVENTS',
      icon: SunMedium,
      title: t.modules.weatherEvents.title,
      desc: t.modules.weatherEvents.desc,
      gradient: 'from-emerald-600 to-teal-700',
      glow: 'group-hover:shadow-emerald-500/20',
      iconBg: 'bg-emerald-600',
      border: 'border-emerald-500/20 hover:border-emerald-400/60',
      badge: "Temps réel",
      badgeColor: 'bg-emerald-900/80 text-emerald-300 border-emerald-500/30',
      stats: [{ icon: Wifi, text: 'Météo satellite' }, { icon: Calendar, text: 'Événements' }]
    },
    {
      id: 'PHRASES',
      icon: Languages,
      title: t.modules.phrases.title,
      desc: t.modules.phrases.desc,
      gradient: 'from-purple-600 to-fuchsia-700',
      glow: 'group-hover:shadow-purple-500/20',
      iconBg: 'bg-purple-600',
      border: 'border-purple-500/20 hover:border-purple-400/60',
      badge: 'Trilingue',
      badgeColor: 'bg-purple-900/80 text-purple-300 border-purple-500/30',
      stats: [{ icon: Languages, text: 'MG · FR · EN' }, { icon: Star, text: 'Audio prononciation' }]
    },
    {
      id: 'EMERGENCY',
      icon: ShieldAlert,
      title: t.modules.emergency.title,
      desc: t.modules.emergency.desc,
      gradient: 'from-red-600 to-rose-700',
      glow: 'group-hover:shadow-rose-500/20',
      iconBg: 'bg-rose-600',
      border: 'border-rose-500/20 hover:border-rose-400/60',
      badge: '24h/24',
      badgeColor: 'bg-rose-900/80 text-rose-300 border-rose-500/30',
      stats: [{ icon: Phone, text: 'Numéros directs' }, { icon: MapPin, text: 'QR itinéraire' }]
    },
    {
      id: 'CONVERTER',
      icon: Coins,
      title: t.modules.converter.title,
      desc: t.modules.converter.desc,
      gradient: 'from-cyan-600 to-blue-700',
      glow: 'group-hover:shadow-cyan-500/20',
      iconBg: 'bg-cyan-600',
      border: 'border-cyan-500/20 hover:border-cyan-400/60',
      badge: 'Taux du jour',
      badgeColor: 'bg-cyan-900/80 text-cyan-300 border-cyan-500/30',
      stats: [{ icon: Euro, text: 'EUR · USD' }, { icon: ArrowLeftRight, text: 'Conversion instantanée' }]
    },
  ];

  return (
    <div className="flex-1 w-full bg-slate-950 overflow-y-auto">
      {/* Hero welcome banner */}
      <div className="relative overflow-hidden bg-gradient-to-r from-slate-900 via-slate-900/95 to-slate-950 border-b border-slate-800/80 px-6 md:px-10 py-7">
        {/* Decorative background circles */}
        <div className="absolute -top-16 -right-16 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-6xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center space-x-2 mb-1">
                <MapPin className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                  {region ? `${region} • ` : ''}Madagascar
                </span>
              </div>
              <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight">
                {welcomeGreeting}
              </h1>
              <p className="text-slate-400 text-sm md:text-base mt-1">
                {t.subWelcome || 'Explorez la ville, ses sites et ses services'}
              </p>
            </div>

            <div className="hidden lg:flex flex-col items-end space-y-2">
              <div className="flex items-center space-x-2 bg-slate-800/80 border border-slate-700/60 px-4 py-2 rounded-2xl">
                <Wifi className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold text-slate-300">Navigation 100% tactile</span>
              </div>
              <div className="flex items-center space-x-2 bg-slate-800/80 border border-slate-700/60 px-4 py-2 rounded-2xl">
                <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                <span className="text-xs font-bold text-slate-300">Données en temps réel</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modules grid */}
      <div className="px-6 md:px-10 py-6 pb-24">
        <div className="max-w-6xl mx-auto">
          <p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-4">
            — Choisissez un service —
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
            {menuItems.map((item) => {
              const IconComponent = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectModule(item.id)}
                  className={`group relative text-left bg-slate-900/90 border-2 ${item.border} rounded-3xl p-5 md:p-6 shadow-lg hover:shadow-2xl ${item.glow} active:scale-[0.98] transition-all duration-200 flex flex-col overflow-hidden`}
                >
                  {/* Background gradient blob on hover */}
                  <div className={`absolute -top-8 -right-8 w-32 h-32 bg-gradient-to-br ${item.gradient} opacity-0 group-hover:opacity-10 rounded-full blur-2xl transition-opacity duration-300 pointer-events-none`} />

                  {/* Top row: icon + badge */}
                  <div className="flex items-start justify-between mb-4">
                    <div className={`p-3.5 rounded-2xl bg-gradient-to-br ${item.gradient} shadow-lg text-white flex-shrink-0`}>
                      <IconComponent className="w-7 h-7" />
                    </div>
                    <span className={`text-[10px] uppercase font-extrabold tracking-wider px-2.5 py-1 rounded-full border ${item.badgeColor}`}>
                      {item.badge}
                    </span>
                  </div>

                  {/* Title + description */}
                  <div className="flex-1">
                    <h3 className="text-xl font-black text-white group-hover:text-amber-300 transition-colors flex items-center justify-between">
                      <span>{item.title}</span>
                      <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-amber-500 group-hover:translate-x-1 transition-all flex-shrink-0" />
                    </h3>
                    <p className="text-slate-500 text-xs mt-1.5 line-clamp-1 font-medium">
                      {item.desc}
                    </p>
                  </div>

                  {/* Bottom stat pills */}
                  <div className="flex items-center space-x-2 mt-4 pt-3.5 border-t border-slate-800/80">
                    {item.stats.map(({ icon: StatIcon, text }, si) => (
                      <div key={si} className="flex items-center space-x-1 text-slate-500 text-[10px] font-bold">
                        <StatIcon className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                        <span>{text}</span>
                        {si < item.stats.length - 1 && <span className="ml-2 text-slate-400">•</span>}
                      </div>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

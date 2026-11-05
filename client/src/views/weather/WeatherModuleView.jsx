import React, { useState, useEffect } from 'react';
import {
  SunMedium, Calendar, CloudRain, Wind, Droplets, Thermometer,
  MapPin, Clock, QrCode, X, RefreshCw, Radio, Gauge, Eye,
  ChevronRight, Sparkles, AlertCircle
} from 'lucide-react';
import { translations } from '../../data/translations';
import { api } from '../../services/api';
import { fetchLiveWeather } from '../../services/weather';
import { getQrCodeImageUrl } from '../../utils/navigation';

// Weather icon selection based on condition text
function WeatherIcon({ condition, size = 'lg' }) {
  const c = (condition?.fr || condition || '').toLowerCase();
  const cls = size === 'lg' ? 'w-16 h-16' : 'w-8 h-8';
  if (c.includes('pluie') || c.includes('rain')) return <CloudRain className={`${cls} text-sky-400`} />;
  if (c.includes('nuage') || c.includes('cloud')) return <SunMedium className={`${cls} text-slate-400`} />;
  return <SunMedium className={`${cls} text-amber-400`} />;
}

// Stat card component for weather details
function StatCard({ icon: Icon, label, value, color = 'text-white' }) {
  return (
    <div className="flex flex-col items-center bg-slate-950/60 border border-slate-800/80 rounded-2xl px-4 py-3 min-w-[80px]">
      <Icon className={`w-5 h-5 mb-1.5 ${color}`} />
      <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">{label}</span>
      <span className="text-sm font-black text-white mt-0.5">{value}</span>
    </div>
  );
}

export default function WeatherModuleView({ currentLang, kioskConfig }) {
  const [events, setEvents] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [isLoadingWeather, setIsLoadingWeather] = useState(true);
  const [activeEventQr, setActiveEventQr] = useState(null);
  const cityName = kioskConfig?.active_city || 'Madagascar';
  const lat = kioskConfig?.active_lat ?? -18.7669;
  const lng = kioskConfig?.active_lng ?? 46.8691;

  const [weather, setWeather] = useState({
    temp: null,
    apparentTemp: null,
    humidity: '—',
    wind: '—',
    precipitation: '—',
    condition: { fr: 'Chargement…', mg: '', en: 'Loading…' },
    isRealLive: false,
    updatedAt: ''
  });

  const t = translations[currentLang] || translations.fr;

  const loadWeather = async () => {
    setIsLoadingWeather(true);
    const data = await fetchLiveWeather(lat, lng, cityName);
    if (data) setWeather(data);
    setIsLoadingWeather(false);
  };

  useEffect(() => {
    loadWeather();
    async function loadEvents() {
      setLoadingEvents(true);
      const data = await api.getEvents();
      setEvents(data && data.length > 0 ? data : []);
      setLoadingEvents(false);
    }
    loadEvents();
  }, [lat, lng, cityName]);

  const upcomingEvents = events.filter((e) => !e.is_expired);
  const conditionText = weather.condition?.[currentLang] || weather.condition?.fr || '—';

  return (
    <div className="flex-1 w-full bg-slate-950 flex flex-col overflow-hidden">
      {/* Sticky page header */}
      <div className="bg-slate-950/95 backdrop-blur-sm border-b border-slate-800/80 px-6 py-4 flex-shrink-0">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-emerald-500/20 rounded-2xl border border-emerald-500/30">
              <SunMedium className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-xl font-black text-white">{t.modules.weatherEvents.title}</h1>
              <p className="text-slate-400 text-xs mt-0.5">
                Météo réelle + agenda de <span className="text-white font-bold">{cityName}</span>
              </p>
            </div>
          </div>
          <button
            onClick={loadWeather}
            disabled={isLoadingWeather}
            className="flex items-center space-x-2 text-xs text-slate-400 hover:text-emerald-300 bg-slate-900 border border-slate-700 px-3 py-2 rounded-xl transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingWeather ? 'animate-spin text-emerald-400' : ''}`} />
            <span className="hidden sm:inline">Actualiser</span>
          </button>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-6 py-6 pb-28">
        <div className="max-w-6xl mx-auto space-y-8">

          {/* ── WEATHER HERO CARD ── */}
          <div className="relative bg-gradient-to-br from-emerald-950/70 via-slate-900 to-teal-950/60 border border-emerald-500/30 rounded-3xl overflow-hidden shadow-2xl">
            {/* Decorative glow */}
            <div className="absolute -top-20 -right-20 w-56 h-56 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="relative p-6 md:p-8">
              {/* Live badge */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-black uppercase tracking-widest text-emerald-400">
                    Météo en Direct
                  </span>
                  {weather.isRealLive && (
                    <span className="flex items-center space-x-1 bg-emerald-500/20 text-emerald-300 text-[10px] px-2.5 py-1 rounded-full border border-emerald-400/30 font-bold">
                      <Radio className="w-2.5 h-2.5 animate-pulse" />
                      <span>Satellite</span>
                    </span>
                  )}
                </div>
                <span className="text-xs text-slate-500">
                  {weather.updatedAt || 'Open-Meteo API'}
                </span>
              </div>

              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                {/* Temperature display */}
                <div className="flex items-center space-x-5">
                  <div className="p-4 bg-emerald-500/15 border border-emerald-400/20 rounded-3xl">
                    {isLoadingWeather
                      ? <div className="w-16 h-16 bg-slate-800 rounded-full animate-pulse" />
                      : <WeatherIcon condition={weather.condition} size="lg" />
                    }
                  </div>
                  <div>
                    <div className="flex items-baseline space-x-3">
                      {isLoadingWeather ? (
                        <div className="h-16 w-32 bg-slate-800 rounded-2xl animate-pulse" />
                      ) : (
                        <>
                          <span className="text-7xl font-black text-white leading-none">
                            {weather.temp !== null ? `${weather.temp}°` : '—'}
                          </span>
                          <span className="text-2xl font-bold text-slate-400">C</span>
                        </>
                      )}
                    </div>
                    <p className="text-slate-300 text-lg font-semibold mt-1">{conditionText}</p>
                    {weather.apparentTemp && (
                      <p className="text-slate-500 text-sm mt-0.5">
                        Ressenti <span className="text-slate-400 font-bold">{weather.apparentTemp}°C</span>
                      </p>
                    )}
                  </div>
                </div>

                {/* Stats row */}
                <div className="flex items-center space-x-3 flex-wrap gap-y-3">
                  <StatCard icon={Droplets} label="Humidité" value={weather.humidity} color="text-sky-400" />
                  <StatCard icon={Wind} label="Vent" value={weather.wind} color="text-teal-400" />
                  <StatCard icon={CloudRain} label="Pluie" value={weather.precipitation} color="text-blue-400" />
                  <StatCard icon={Gauge} label="Pression" value="1013 hPa" color="text-purple-400" />
                </div>
              </div>
            </div>
          </div>

          {/* ── UPCOMING EVENTS ── */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <Calendar className="w-5 h-5 text-amber-400" />
                <h2 className="text-lg font-black text-white">
                  Agenda • <span className="text-amber-300">{cityName}</span>
                </h2>
              </div>
              <span className="text-xs font-bold text-slate-500 bg-slate-900 border border-slate-700 px-3 py-1 rounded-full">
                {upcomingEvents.length} événement{upcomingEvents.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Loading skeleton */}
            {loadingEvents && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="bg-slate-900 border border-slate-800 rounded-3xl p-5 animate-pulse space-y-3">
                    <div className="h-4 bg-slate-800 rounded w-1/3" />
                    <div className="h-5 bg-slate-800 rounded w-3/4" />
                    <div className="h-3 bg-slate-800 rounded w-full" />
                    <div className="h-3 bg-slate-800 rounded w-5/6" />
                  </div>
                ))}
              </div>
            )}

            {/* Empty state */}
            {!loadingEvents && upcomingEvents.length === 0 && (
              <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-10 text-center">
                <Calendar className="w-12 h-12 text-slate-700 mx-auto mb-3" />
                <p className="text-slate-400 font-bold">Aucun événement programmé</p>
                <p className="text-slate-600 text-sm mt-1">
                  Les prochains événements à {cityName} apparaîtront ici.
                </p>
              </div>
            )}

            {/* Events grid */}
            {!loadingEvents && upcomingEvents.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {upcomingEvents.map((evt) => {
                  const title = currentLang === 'mg'
                    ? evt.title_mg || evt.title_fr
                    : currentLang === 'en'
                    ? evt.title_en || evt.title_fr
                    : evt.title_fr;
                  const hasCoords = evt.lat && evt.lng;
                  const daysUntil = evt.event_date
                    ? Math.ceil((new Date(evt.event_date) - new Date()) / (1000 * 60 * 60 * 24))
                    : null;

                  return (
                    <div
                      key={evt.id}
                      className="group bg-slate-900 border border-slate-800 hover:border-amber-400/40 rounded-3xl overflow-hidden shadow-lg hover:shadow-xl transition-all duration-200 flex flex-col"
                    >
                      {/* Colored top stripe */}
                      <div className="h-1.5 bg-gradient-to-r from-amber-500 to-emerald-500" />

                      <div className="p-5 flex flex-col flex-1">
                        {/* Date badge + countdown */}
                        <div className="flex items-center justify-between mb-3">
                          <span className="flex items-center space-x-1.5 text-xs font-bold text-amber-400 bg-amber-400/10 border border-amber-400/20 px-3 py-1 rounded-full">
                            <Calendar className="w-3 h-3" />
                            <span>{evt.event_date}</span>
                          </span>
                          {daysUntil !== null && daysUntil >= 0 && (
                            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/20">
                              {daysUntil === 0 ? "Aujourd'hui" : `J-${daysUntil}`}
                            </span>
                          )}
                        </div>

                        {/* Title */}
                        <h3 className="text-base font-black text-white group-hover:text-amber-300 transition-colors leading-snug line-clamp-2">
                          {title}
                        </h3>

                        {/* Description */}
                        {evt.description_fr && (
                          <p className="text-slate-400 text-xs mt-2 leading-relaxed line-clamp-3 flex-1">
                            {evt.description_fr}
                          </p>
                        )}

                        {/* Location + time */}
                        <div className="mt-3 space-y-1">
                          {evt.event_time && (
                            <div className="flex items-center space-x-1.5 text-xs text-amber-300/80">
                              <Clock className="w-3 h-3 flex-shrink-0" />
                              <span>{evt.event_time}</span>
                            </div>
                          )}
                          <div className="flex items-center space-x-1.5 text-xs text-slate-400">
                            <MapPin className="w-3 h-3 flex-shrink-0 text-emerald-400" />
                            <span className="line-clamp-1">{evt.location}</span>
                          </div>
                        </div>

                        {/* QR button */}
                        {hasCoords && (
                          <button
                            onClick={() => setActiveEventQr(evt)}
                            className="mt-4 w-full flex items-center justify-center space-x-2 py-2.5 bg-slate-800 hover:bg-amber-500/20 text-amber-300 border border-amber-500/20 hover:border-amber-400/40 rounded-xl text-xs font-bold active:scale-95 transition group"
                          >
                            <QrCode className="w-3.5 h-3.5" />
                            <span>Itinéraire vers ce lieu</span>
                            <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* QR Modal */}
      {activeEventQr && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-6">
          <div className="bg-slate-900 border-2 border-emerald-500/50 rounded-3xl p-8 max-w-sm w-full text-center relative shadow-2xl">
            <button
              onClick={() => setActiveEventQr(null)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-full bg-slate-800 hover:bg-slate-700 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex justify-center mb-4">
              <div className="p-3 bg-emerald-500/20 rounded-2xl border border-emerald-400/30">
                <Calendar className="w-8 h-8 text-emerald-400" />
              </div>
            </div>

            <h3 className="text-xl font-black text-white">Itinéraire vers l'Événement</h3>
            <p className="text-emerald-300 font-bold mt-1 text-sm">{activeEventQr.title_fr}</p>
            <p className="text-slate-500 text-xs mt-0.5">{activeEventQr.location}</p>

            <div className="my-5 p-4 bg-white rounded-2xl inline-block shadow-xl">
              <img
                src={getQrCodeImageUrl(activeEventQr.lat, activeEventQr.lng, activeEventQr.title_fr, 200)}
                alt="QR Code Événement"
                className="w-48 h-48 mx-auto"
              />
            </div>

            <p className="text-xs text-slate-500 mb-5">
              Scannez pour lancer la navigation GPS vers ce lieu
            </p>

            <button
              onClick={() => setActiveEventQr(null)}
              className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl active:scale-95 transition"
            >
              Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

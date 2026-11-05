import React, { useState, useEffect } from 'react';
import {
  UtensilsCrossed, Bed, Compass, Car, Phone, Tag,
  MapPin, Star, QrCode, Clock, RefreshCw, Navigation,
  Wifi, WifiOff, Store, Landmark, Building2
} from 'lucide-react';
import { translations } from '../../data/translations';
import { api } from '../../services/api';
import { analytics } from '../../services/analytics';
import { getQrCodeImageUrl } from '../../utils/navigation';
import ItineraryPreviewModal from '../../components/ItineraryPreviewModal';

const CATEGORY_FILTERS = [
  { id: 'all',        label: 'Tous les établissements', icon: Landmark,        color: 'text-amber-400' },
  { id: 'hotel',      label: 'Hôtels & Auberges',       icon: Bed,             color: 'text-sky-400' },
  { id: 'restaurant', label: 'Restaurants & Tables',    icon: UtensilsCrossed, color: 'text-orange-400' },
  { id: 'guide',      label: 'Guides certifiés',        icon: Compass,         color: 'text-emerald-400' },
  { id: 'transport',  label: 'Transports & 4x4',        icon: Car,             color: 'text-violet-400' },
];

const CATEGORY_COLORS = {
  hotel:      'bg-sky-400/20 text-sky-300 border-sky-400/30',
  restaurant: 'bg-orange-400/20 text-orange-300 border-orange-400/30',
  guide:      'bg-emerald-400/20 text-emerald-300 border-emerald-400/30',
  transport:  'bg-violet-400/20 text-violet-300 border-violet-400/30',
  boutique:   'bg-pink-400/20 text-pink-300 border-pink-400/30',
  patrimoine: 'bg-indigo-400/20 text-indigo-300 border-indigo-400/30',
};

function StarRating({ rating }) {
  const stars = Math.round(rating || 0);
  return (
    <div className="flex items-center space-x-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={`w-3 h-3 ${s <= stars ? 'text-amber-400 fill-amber-400' : 'text-slate-600'}`}
        />
      ))}
      <span className="text-xs text-slate-400 ml-1 font-mono">{(rating || 0).toFixed(1)}</span>
    </div>
  );
}

export default function PlacesModuleView({ currentLang, kioskConfig }) {
  const [activeFilter, setActiveFilter] = useState('all');
  const [places, setPlaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);
  const [expandedQr, setExpandedQr] = useState(null);
  const [selectedItineraryPlace, setSelectedItineraryPlace] = useState(null);
  const t = translations[currentLang] || translations.fr;
  const cityName = kioskConfig?.active_city || 'Madagascar';

  const loadPlaces = async () => {
    setLoading(true);
    try {
      // Load hotels, accommodations, and restaurants specifically
      const data = await api.getPlaces('hospitality');
      if (data && data.length > 0) {
        setPlaces(data);
        setIsOffline(false);
      } else {
        setPlaces([]);
        setIsOffline(false);
      }
    } catch {
      setPlaces([]);
    } finally {
      setLoading(false);
    }
    analytics.logInteraction('places', 'module_opened');
  };

  useEffect(() => {
    loadPlaces();
  }, [cityName]);

  const filteredPlaces = activeFilter === 'all'
    ? places
    : places.filter((p) => p.category === activeFilter);

  const handleQrClick = (placeKey, placeName) => {
    setExpandedQr(expandedQr === placeKey ? null : placeKey);
    analytics.logInteraction('places', `qr_scan:${placeName}`);
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-950">
        <div className="text-center space-y-4">
          <RefreshCw className="w-10 h-10 text-amber-400 mx-auto animate-spin" />
          <p className="text-slate-300 font-bold">Chargement des établissements...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 w-full bg-slate-950 p-6 md:p-8 pb-24 md:pb-28 flex flex-col overflow-y-auto">
      <div className="max-w-6xl mx-auto w-full">

        {/* Header */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-black text-white flex items-center space-x-3">
              <UtensilsCrossed className="w-8 h-8 text-amber-400" />
              <span>{t.modules?.places?.title || 'Hôtels & Bonnes Tables'}</span>
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Sélection des meilleurs hébergements, tables et services à {cityName}
            </p>
          </div>

          <div className="flex items-center space-x-2 flex-shrink-0">
            {isOffline ? (
              <span className="flex items-center space-x-1 text-xs text-amber-400 bg-amber-400/10 border border-amber-400/30 px-3 py-1.5 rounded-full font-bold">
                <WifiOff className="w-3 h-3" />
                <span>Hors-ligne</span>
              </span>
            ) : (
              <span className="flex items-center space-x-1 text-xs text-emerald-400 bg-emerald-400/10 border border-emerald-400/30 px-3 py-1.5 rounded-full font-bold">
                <Wifi className="w-3 h-3" />
                <span>{places.length} résultat{places.length > 1 ? 's' : ''}</span>
              </span>
            )}
            <button
              onClick={loadPlaces}
              className="p-2 text-slate-400 hover:text-white bg-slate-800 rounded-xl hover:bg-slate-700 transition"
              title="Actualiser"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex space-x-2 overflow-x-auto pb-3 mb-6">
          {CATEGORY_FILTERS.map((f) => {
            const Icon = f.icon;
            const isActive = activeFilter === f.id;
            const count = f.id === 'all'
              ? places.length
              : places.filter((p) => p.category === f.id).length;
            if (f.id !== 'all' && count === 0) return null;
            return (
              <button
                key={f.id}
                onClick={() => setActiveFilter(f.id)}
                className={`flex items-center space-x-2 px-4 py-2.5 rounded-2xl font-bold text-sm transition-all active:scale-95 whitespace-nowrap ${
                  isActive
                    ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
                    : 'bg-slate-900 text-slate-300 border border-slate-800 hover:border-slate-600'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-slate-950' : f.color}`} />
                <span>{f.label}</span>
                <span className={`text-xs font-mono px-1.5 py-0.5 rounded-full ${
                  isActive ? 'bg-slate-950/20' : 'bg-slate-800 text-slate-400'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Empty state */}
        {filteredPlaces.length === 0 && (
          <div className="text-center py-20">
            <MapPin className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400 font-bold">Aucun établissement dans cette catégorie.</p>
            <button
              onClick={() => setActiveFilter('all')}
              className="mt-4 text-amber-400 text-sm underline"
            >
              Voir tout
            </button>
          </div>
        )}

        {/* Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredPlaces.map((place) => {
            const catColors = CATEGORY_COLORS[place.category] || 'bg-slate-700/20 text-slate-300 border-slate-600/30';
            const hasCoords = place.lat && place.lng;
            const placeKey = place.id || place.name;
            const qrUrl = hasCoords ? getQrCodeImageUrl(place.lat, place.lng, place.name) : null;
            const isQrExpanded = expandedQr === placeKey;

            return (
              <div
                key={placeKey}
                className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl hover:border-amber-500/40 transition-all flex flex-col"
              >
                {/* Photo */}
                {place.photo_url && (
                  <div className="h-44 overflow-hidden relative">
                    <img
                      src={
                        place.photo_url.startsWith('http')
                          ? place.photo_url
                          : `http://localhost:5000${place.photo_url}`
                      }
                      alt={place.name}
                      className="w-full h-full object-cover"
                      onError={(e) => { e.target.parentElement.style.display = 'none'; }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent" />
                  </div>
                )}

                <div className="p-6 flex flex-col flex-1">
                  {/* Badges row */}
                  <div className="flex items-center justify-between mb-3">
                    <span className={`text-xs font-extrabold px-3 py-1 rounded-full border ${catColors}`}>
                      {place.category?.toUpperCase() || 'LIEU'}
                    </span>
                    {place.rating != null && <StarRating rating={place.rating} />}
                  </div>

                  {/* Name */}
                  <h3 className="text-xl font-bold text-white">{place.name}</h3>

                  {/* Description */}
                  <p className="text-slate-300 text-sm mt-2 leading-relaxed flex-1">
                    {(currentLang === 'mg' && place.desc_mg)
                      || (currentLang === 'en' && place.desc_en)
                      || place.desc_fr
                      || ''}
                  </p>

                  {/* Travel info */}
                  {(place.distance_km || place.travel_time) && (
                    <div className="flex items-center space-x-4 mt-3 text-xs text-slate-400">
                      {place.distance_km && (
                        <span className="flex items-center space-x-1">
                          <MapPin className="w-3 h-3" />
                          <span>{place.distance_km}</span>
                        </span>
                      )}
                      {place.travel_time && (
                        <span className="flex items-center space-x-1">
                          <Clock className="w-3 h-3" />
                          <span>{place.travel_time}</span>
                        </span>
                      )}
                    </div>
                  )}

                  {/* Price & Contact */}
                  <div className="mt-4 pt-4 border-t border-slate-800/80 space-y-2">
                    {place.price_indicative && (
                      <div className="flex items-center space-x-2 text-amber-300 font-bold text-sm">
                        <Tag className="w-4 h-4" />
                        <span>{place.price_indicative}</span>
                      </div>
                    )}
                    {place.contact && (
                      <div className="flex items-center space-x-2 text-slate-300 font-mono text-sm">
                        <Phone className="w-4 h-4 text-emerald-400" />
                        <span>{place.contact}</span>
                      </div>
                    )}
                    {place.address && (
                      <div className="flex items-center space-x-2 text-slate-400 text-xs">
                        <MapPin className="w-3 h-3 text-slate-500" />
                        <span>{place.address}</span>
                      </div>
                    )}
                  </div>

                  {/* Navigation Actions */}
                  {hasCoords && (
                    <div className="mt-4 flex items-center space-x-2">
                      <button
                        onClick={() => {
                          setSelectedItineraryPlace(place);
                          analytics.logInteraction('places', `itinerary_preview:${place.name}`);
                        }}
                        className="flex-1 flex items-center justify-center space-x-2 py-2.5 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 rounded-xl text-xs font-bold transition active:scale-95 cursor-pointer shadow-md"
                      >
                        <Navigation className="w-4 h-4 text-amber-400" />
                        <span>Voir l'itinéraire</span>
                      </button>

                      <button
                        onClick={() => handleQrClick(placeKey, place.name)}
                        className={`flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold border transition active:scale-95 ${
                          isQrExpanded
                            ? 'bg-amber-500 text-slate-950 border-amber-500'
                            : 'bg-amber-400/10 hover:bg-amber-400/20 text-amber-300 border-amber-400/30'
                        }`}
                        title="QR Code itinéraire"
                      >
                        <QrCode className="w-4 h-4" />
                        <span>QR</span>
                      </button>
                    </div>
                  )}

                  {/* QR Code expanded */}
                  {isQrExpanded && hasCoords && (
                    <div className="mt-4 p-4 bg-white rounded-2xl text-center animate-fade-in">
                      <img
                        src={qrUrl}
                        alt={`QR Code itinéraire vers ${place.name}`}
                        className="w-40 h-40 mx-auto"
                      />
                      <p className="text-slate-700 text-xs font-bold mt-2">
                        📱 Scannez pour l'itinéraire vers
                      </p>
                      <p className="text-slate-900 text-sm font-black">{place.name}</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* In-App Interactive Itinerary Preview Modal (ZERO EXTERNAL TABS) */}
      <ItineraryPreviewModal
        isOpen={!!selectedItineraryPlace}
        onClose={() => setSelectedItineraryPlace(null)}
        place={selectedItineraryPlace}
        kioskConfig={kioskConfig}
        currentLang={currentLang}
      />
    </div>
  );
}

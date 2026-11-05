import React, { useState, useEffect } from 'react';
import { 
  MapPin, QrCode, Compass, Star, X, Navigation, 
  Clock, Sparkles, Palette, Mountain
} from 'lucide-react';
import { translations } from '../../data/translations';
import { api } from '../../services/api';
import { getQrCodeImageUrl } from '../../utils/navigation';
import ItineraryPreviewModal from '../../components/ItineraryPreviewModal';

export default function MapModuleView({ currentLang, onLogItemClick, kioskConfig }) {
  const [places, setPlaces] = useState([]);
  const [selectedSite, setSelectedSite] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('all');
  const [showQrModal, setShowQrModal] = useState(false);
  const [showItineraryModal, setShowItineraryModal] = useState(false);
  const t = translations[currentLang] || translations.fr;
  const cityName = kioskConfig?.active_city || 'Madagascar';

  useEffect(() => {
    async function loadPlaces() {
      setLoading(true);
      setSelectedSite(null);
      setActiveCategory('all');
      try {
        // scope=sites : uniquement lieux touristiques (patrimoine, nature, aventure…)
        // Les hôtels & restaurants sont dans "Hôtels & Bonnes Tables"
        const data = await api.getPlaces('sites');
        if (data && data.length > 0) {
          setPlaces(data);
          setSelectedSite(data[0]);
        } else {
          setPlaces([]);
          setSelectedSite(null);
        }
      } catch (err) {
        console.warn('Erreur chargement carte:', err);
        setPlaces([]);
        setSelectedSite(null);
      } finally {
        setLoading(false);
      }
    }
    loadPlaces();
  }, [cityName]);

  const categories = [
    { id: 'all', label: 'Tous les sites', icon: Compass },
    { id: 'patrimoine', label: 'Patrimoine & Histoire', icon: MapPin },
    { id: 'nature', label: 'Nature & Parcs', icon: Mountain },
    { id: 'aventure', label: 'Aventure & Circuits', icon: Navigation },
    { id: 'marche', label: 'Marchés & Terroir', icon: Sparkles },
    { id: 'religieux', label: 'Lieux de culte', icon: Star },
    { id: 'panorama', label: 'Panoramas & Vues', icon: Palette },
  ];

  const filteredPlaces = places.filter((p) => {
    if (activeCategory === 'all') return true;
    const cat = (p.category || '').toLowerCase();
    if (activeCategory === 'patrimoine') return ['patrimoine', 'monument', 'musee', 'histoire', 'historique', 'pont', 'palais', 'rova'].includes(cat);
    if (activeCategory === 'nature') return ['nature', 'parc', 'lac', 'panorama', 'foret', 'cascade', 'plage', 'thermes'].includes(cat);
    if (activeCategory === 'aventure') return ['aventure', 'train', 'gare', 'canal', 'port', 'aeroport', 'agrotourisme', 'transport', 'sport'].includes(cat);
    if (activeCategory === 'marche') return ['marche', 'artisanat', 'boutique', 'bazar'].includes(cat);
    if (activeCategory === 'religieux') return ['religieux', 'eglise', 'cathedrale', 'temple', 'mosquee'].includes(cat);
    if (activeCategory === 'panorama') return ['panorama', 'vue', 'belvedere'].includes(cat);
    return cat === activeCategory.toLowerCase();
  });

  // Keep selected site in sync with filtered places
  useEffect(() => {
    if (filteredPlaces.length > 0) {
      if (!selectedSite || !filteredPlaces.some(p => p.id === selectedSite.id || p.name === selectedSite.name)) {
        setSelectedSite(filteredPlaces[0]);
      }
    } else {
      setSelectedSite(null);
    }
  }, [activeCategory, places]);

  const handleSelectSite = (site) => {
    setSelectedSite(site);
    if (onLogItemClick) onLogItemClick('map_site', site.name || site.id);
  };

  const handleOpenQrModal = () => {
    setShowQrModal(true);
    if (onLogItemClick && selectedSite) {
      onLogItemClick('qr_scan_place', selectedSite.name);
    }
  };

  const getDescription = (site) => {
    if (typeof site.desc === 'object') {
      return site.desc[currentLang] || site.desc.fr;
    }
    if (currentLang === 'mg') return site.desc_mg || site.desc_fr;
    if (currentLang === 'en') return site.desc_en || site.desc_fr;
    return site.desc_fr || site.desc || '';
  };

  return (
    <div className="flex-1 w-full bg-slate-950 p-6 md:p-8 pb-24 md:pb-28 flex flex-col overflow-y-auto">
      <div className="max-w-6xl mx-auto w-full flex-1 flex flex-col">
        {/* Title & Header */}
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black text-white flex items-center space-x-3">
              <Compass className="w-8 h-8 text-blue-400" />
              <span>{t.modules.map.title}</span>
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Explorez les merveilles de {cityName}, calculez vos trajets et transférez l'itinéraire GPS directement sur votre mobile
            </p>
          </div>
        </div>

        {/* Extended Category Filters */}
        <div className="flex space-x-2 overflow-x-auto pb-2 mb-4 scrollbar-none">
          {categories.map((cat) => {
            const Icon = cat.icon;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`flex items-center space-x-2 px-4 py-2.5 rounded-2xl font-bold text-xs uppercase tracking-wider transition active:scale-95 whitespace-nowrap ${
                  activeCategory === cat.id
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20 border-2 border-blue-400'
                    : 'bg-slate-900 text-slate-300 border border-slate-800 hover:border-slate-700'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>

        {/* Content Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1">
          {/* Sites list */}
          <div className="lg:col-span-5 space-y-3 overflow-y-auto max-h-[620px] pr-2">
            {filteredPlaces.length === 0 ? (
              <div className="p-8 text-center bg-slate-900 rounded-2xl border border-slate-800 text-slate-400 text-sm">
                Aucun lieu dans cette catégorie pour le moment.
              </div>
            ) : (
              filteredPlaces.map((site) => {
                const isSelected = selectedSite && (selectedSite.id === site.id || selectedSite.name === site.name);
                return (
                  <button
                    key={site.id || site.name}
                    onClick={() => handleSelectSite(site)}
                    className={`w-full text-left p-4 rounded-3xl border-2 transition-all duration-200 flex space-x-4 ${
                      isSelected
                        ? 'bg-blue-950/70 border-blue-400 shadow-xl scale-[1.01]'
                        : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {site.photo_url ? (
                      <img
                        src={site.photo_url}
                        alt={site.name}
                        className="w-24 h-24 object-cover rounded-2xl bg-slate-950 border border-slate-800 flex-shrink-0"
                        onError={(e) => {
                          e.target.style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-blue-900/40 to-slate-950 border border-blue-500/30 flex flex-col items-center justify-center flex-shrink-0 text-blue-400">
                        <MapPin className="w-8 h-8" />
                        <span className="text-[9px] uppercase font-bold mt-1 text-slate-400">Lieu</span>
                      </div>
                    )}

                    <div className="flex-1 flex flex-col justify-between py-0.5">
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                            {site.category}
                          </span>
                          <div className="flex items-center space-x-1 text-amber-400 text-xs font-bold">
                            <Star className="w-3.5 h-3.5 fill-amber-400" />
                            <span>{site.rating || 4.8}</span>
                          </div>
                        </div>

                        <h3 className="text-base font-bold text-white mt-1 line-clamp-1">
                          {site.name}
                        </h3>
                        <p className="text-slate-400 text-xs line-clamp-1 mt-0.5">
                          {getDescription(site)}
                        </p>
                      </div>

                      <div className="flex items-center space-x-2 text-[11px] text-amber-300/90 font-medium">
                        <Clock className="w-3 h-3 text-emerald-400" />
                        <span>{site.travel_time || '15 min'}</span>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Detailed View */}
          {selectedSite ? (
            <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-3xl p-6 flex flex-col justify-between shadow-xl overflow-y-auto">
              <div>
                <div className="relative rounded-2xl overflow-hidden h-52 bg-slate-950 mb-5 border border-slate-800">
                  {selectedSite.photo_url ? (
                    <img
                      src={selectedSite.photo_url}
                      alt={selectedSite.name}
                      className="w-full h-full object-cover filter brightness-[0.85]"
                      onError={(e) => {
                        e.target.style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-blue-950 via-slate-900 to-indigo-950 flex flex-col items-center justify-center text-blue-400">
                      <MapPin className="w-14 h-14 mb-2 animate-bounce" />
                      <span className="text-sm font-black uppercase tracking-wider text-slate-300">{selectedSite.name}</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-black/30 pointer-events-none" />

                  <div className="absolute top-3 left-3 flex items-center space-x-2">
                    <span className="bg-blue-600/90 text-white font-bold text-xs uppercase px-3 py-1 rounded-full shadow">
                      {selectedSite.category}
                    </span>
                    <span className="bg-black/60 backdrop-blur text-amber-400 font-bold text-xs px-3 py-1 rounded-full flex items-center space-x-1 border border-white/20">
                      <Star className="w-3.5 h-3.5 fill-amber-400" />
                      <span>{selectedSite.rating || 4.8} / 5</span>
                    </span>
                  </div>

                  <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-white">
                    <div className="flex items-center space-x-3 text-xs font-bold bg-black/60 backdrop-blur px-3 py-1.5 rounded-xl border border-white/10">
                      <div className="flex items-center space-x-1">
                        <MapPin className="w-3.5 h-3.5 text-red-400" />
                        <span>{selectedSite.distance_km || 'Centre-ville'}</span>
                      </div>
                      <span>•</span>
                      <div className="flex items-center space-x-1">
                        <Clock className="w-3.5 h-3.5 text-emerald-400" />
                        <span>{selectedSite.travel_time || '15 min'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h2 className="text-2xl font-black text-white">
                    {selectedSite.name}
                  </h2>
                  <p className="text-slate-300 text-sm mt-2 leading-relaxed">
                    {getDescription(selectedSite)}
                  </p>
                </div>

                {/* Itinerary Guide Box */}
                <div className="mt-4 bg-slate-950/80 p-4 rounded-2xl border border-slate-800">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs uppercase font-extrabold tracking-wider text-blue-400 flex items-center space-x-1.5">
                      <Navigation className="w-4 h-4" />
                      <span>Itinéraire & Conseils de trajet :</span>
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono">
                      GPS : {selectedSite.lat}, {selectedSite.lng}
                    </span>
                  </div>

                  <p className="text-slate-200 text-xs leading-relaxed">
                    {selectedSite.itinerary_steps || 
                      `Depuis le centre-ville de ${cityName}, suivre les indications routières GPS. Accessible à pied ou en transport local.`}
                  </p>
                </div>
              </div>

              {/* Action Buttons: Phone QR code (DIRECT NAVIGATION) & Direct Link */}
              <div className="mt-5 pt-4 border-t border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-3">
                <button
                  onClick={handleOpenQrModal}
                  className="py-4 px-4 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-sm uppercase tracking-wider shadow-xl flex items-center justify-center space-x-2 active:scale-95 transition-transform"
                >
                  <QrCode className="w-6 h-6 text-white" />
                  <span>Envoyer itinéraire sur mobile (QR Code)</span>
                </button>

                <button
                  onClick={() => setShowItineraryModal(true)}
                  className="py-4 px-4 rounded-2xl bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold text-sm uppercase tracking-wider border border-amber-500/30 flex items-center justify-center space-x-2 active:scale-95 transition-transform shadow-lg cursor-pointer"
                >
                  <Navigation className="w-5 h-5 text-amber-400" />
                  <span>Aperçu de l'itinéraire sur l'écran</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="lg:col-span-7 bg-slate-900/50 border border-slate-800 rounded-3xl p-8 flex flex-col items-center justify-center text-center shadow-xl min-h-[400px]">
              <Compass className="w-16 h-16 text-slate-600 mb-4" />
              <h3 className="text-xl font-bold text-white mb-2">Sélectionnez un lieu</h3>
              <p className="text-slate-400 text-sm max-w-sm">
                Choisissez un site, hôtel ou circuit à {cityName} dans la liste pour afficher ses détails d'itinéraire et scanner son QR Code.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* QR Code Modal for Phone Handoff (DIRECT NAVIGATION URL) */}
      {showQrModal && selectedSite && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-6">
          <div className="bg-slate-900 border-2 border-blue-500 rounded-3xl p-8 max-w-md w-full text-center relative shadow-2xl">
            <button
              onClick={() => setShowQrModal(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-full bg-slate-800"
            >
              <X className="w-6 h-6" />
            </button>

            <h3 className="text-2xl font-black text-white">Itinéraire Direct vers votre Téléphone</h3>
            <p className="text-slate-300 text-sm mt-1">
              Scannez pour démarrer immédiatement la navigation GPS vers <b>{selectedSite.name}</b>
            </p>

            {/* QR Code Container */}
            <div className="my-6 p-4 bg-white rounded-2xl inline-block shadow-inner">
              <img
                src={getQrCodeImageUrl(selectedSite.lat, selectedSite.lng, selectedSite.name, 220)}
                alt="QR Code Itinéraire Direct"
                className="w-52 h-52 mx-auto"
              />
            </div>

            <div className="text-xs text-slate-300 bg-slate-950 p-3 rounded-xl border border-slate-800">
              <b>Guidage direct activé :</b> Calcule automatiquement la route depuis votre position actuelle.
            </div>

            <button
              onClick={() => setShowQrModal(false)}
              className="mt-6 w-full py-3.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl active:scale-95 transition"
            >
              Fermer
            </button>
          </div>
        </div>
      )}

      {/* In-App Interactive Itinerary Preview Modal (ZERO EXTERNAL TABS) */}
      <ItineraryPreviewModal
        isOpen={showItineraryModal}
        onClose={() => setShowItineraryModal(false)}
        place={selectedSite}
        kioskConfig={kioskConfig}
        currentLang={currentLang}
      />
    </div>
  );
}

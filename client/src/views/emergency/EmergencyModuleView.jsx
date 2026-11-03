import React, { useState, useEffect } from 'react';
import {
  ShieldAlert, Ambulance, Flame, MapPin, QrCode, X,
  Phone, Heart, Building2, Search, ChevronRight, AlertTriangle,
  Navigation, Info, Sparkles
} from 'lucide-react';
import { mockEmergency } from '../../data/mockData';
import { translations } from '../../data/translations';
import { api } from '../../services/api';
import { getQrCodeImageUrl } from '../../utils/navigation';
import ItineraryPreviewModal from '../../components/ItineraryPreviewModal';

// Icon map for emergency types
const ICON_MAP = {
  Ambulance: Ambulance,
  Flame: Flame,
  ShieldAlert: ShieldAlert,
  HeartPulse: Heart,
  Building2: Building2,
  default: ShieldAlert,
};

// Color/badge config by icon type
const TYPE_CONFIG = {
  Ambulance: {
    label: 'Médical',
    bg: 'bg-rose-500/15',
    border: 'border-rose-500/40',
    hoverBorder: 'hover:border-rose-400',
    iconBg: 'bg-rose-500/20 border-rose-400/30',
    iconColor: 'text-rose-400',
    badgeBg: 'bg-rose-900/60 text-rose-300 border border-rose-500/30',
    numColor: 'text-rose-400',
  },
  ShieldAlert: {
    label: 'Sécurité',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/40',
    hoverBorder: 'hover:border-blue-400',
    iconBg: 'bg-blue-500/20 border-blue-400/30',
    iconColor: 'text-blue-400',
    badgeBg: 'bg-blue-900/60 text-blue-300 border border-blue-500/30',
    numColor: 'text-blue-400',
  },
  Flame: {
    label: 'Pompiers',
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/40',
    hoverBorder: 'hover:border-orange-400',
    iconBg: 'bg-orange-500/20 border-orange-400/30',
    iconColor: 'text-orange-400',
    badgeBg: 'bg-orange-900/60 text-orange-300 border border-orange-500/30',
    numColor: 'text-orange-400',
  },
  HeartPulse: {
    label: 'Pharmacie',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/40',
    hoverBorder: 'hover:border-emerald-400',
    iconBg: 'bg-emerald-500/20 border-emerald-400/30',
    iconColor: 'text-emerald-400',
    badgeBg: 'bg-emerald-900/60 text-emerald-300 border border-emerald-500/30',
    numColor: 'text-emerald-400',
  },
};

function getTypeConfig(iconName) {
  return TYPE_CONFIG[iconName] || TYPE_CONFIG['ShieldAlert'];
}

export default function EmergencyModuleView({ currentLang, kioskConfig }) {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeEmergencyQr, setActiveEmergencyQr] = useState(null);
  const [selectedItineraryContact, setSelectedItineraryContact] = useState(null);
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const t = translations[currentLang] || translations.fr;
  const cityName = kioskConfig?.active_city || 'la ville';

  useEffect(() => {
    async function loadEmergency() {
      setLoading(true);
      setContacts([]);
      try {
        const data = await api.getEmergency();
        if (data && data.length > 0) {
          setContacts(data);
        } else if (cityName === 'Fianarantsoa') {
          setContacts(mockEmergency);
        } else {
          setContacts([]);
        }
      } catch {
        setContacts(cityName === 'Fianarantsoa' ? mockEmergency : []);
      } finally {
        setLoading(false);
      }
    }
    loadEmergency();
  }, [cityName]);

  const filterTabs = [
    { id: 'all', label: 'Tous', icon: Sparkles },
    { id: 'Ambulance', label: 'Médical', icon: Ambulance },
    { id: 'ShieldAlert', label: 'Sécurité', icon: ShieldAlert },
    { id: 'Flame', label: 'Pompiers', icon: Flame },
    { id: 'HeartPulse', label: 'Pharmacie', icon: Heart },
  ];

  const filteredContacts = contacts.filter((c) => {
    const matchesFilter = activeFilter === 'all' || c.icon === activeFilter;
    const matchesSearch = !searchQuery ||
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.address || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="flex-1 w-full bg-slate-950 flex flex-col overflow-hidden">
      {/* Sticky Header */}
      <div className="bg-slate-950/95 backdrop-blur-sm border-b border-slate-800/80 px-6 py-5 flex-shrink-0">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 bg-rose-500/20 rounded-2xl border border-rose-500/30">
                <ShieldAlert className="w-7 h-7 text-rose-400" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-white">{t.modules.emergency.title}</h1>
                <p className="text-slate-400 text-xs mt-0.5">
                  Services d'urgence disponibles à <span className="text-white font-bold">{cityName}</span>
                </p>
              </div>
            </div>

            {/* Contacts count badge */}
            <div className="hidden md:flex items-center space-x-2 bg-slate-900 border border-slate-700 px-4 py-2 rounded-2xl">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span className="text-slate-300 text-sm font-bold">{contacts.length} contact{contacts.length !== 1 ? 's' : ''}</span>
            </div>
          </div>

          {/* Search bar */}
          <div className="relative mb-3">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Rechercher un service d'urgence à ${cityName}...`}
              className="w-full bg-slate-900 border border-slate-700 text-white placeholder-slate-500 rounded-2xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-rose-500/60 transition"
            />
          </div>

          {/* Filter tabs */}
          <div className="flex space-x-2 overflow-x-auto pb-1 scrollbar-none">
            {filterTabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveFilter(id)}
                className={`flex items-center space-x-1.5 px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-wider transition whitespace-nowrap active:scale-95 ${
                  activeFilter === id
                    ? 'bg-rose-600 text-white shadow-lg border-2 border-rose-400'
                    : 'bg-slate-900 text-slate-400 border border-slate-700 hover:border-slate-600'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{label}</span>
                {id !== 'all' && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${
                    activeFilter === id ? 'bg-rose-400/30 text-rose-200' : 'bg-slate-800 text-slate-500'
                  }`}>
                    {contacts.filter(c => c.icon === id).length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto px-6 py-6 pb-28">
        <div className="max-w-6xl mx-auto">

          {/* Loading state */}
          {loading && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="bg-slate-900 border border-slate-800 rounded-3xl p-5 animate-pulse">
                  <div className="flex space-x-4">
                    <div className="w-14 h-14 bg-slate-800 rounded-2xl flex-shrink-0" />
                    <div className="flex-1 space-y-3">
                      <div className="h-4 bg-slate-800 rounded-full w-3/4" />
                      <div className="h-3 bg-slate-800 rounded-full w-1/2" />
                      <div className="h-6 bg-slate-800 rounded-full w-1/3" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Empty state */}
          {!loading && filteredContacts.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="p-5 bg-slate-900 rounded-3xl border border-slate-800 mb-4">
                <ShieldAlert className="w-14 h-14 text-slate-600" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Aucun service trouvé</h3>
              <p className="text-slate-500 text-sm max-w-sm">
                {searchQuery
                  ? `Aucun résultat pour "${searchQuery}". Essayez un autre terme.`
                  : `Les services d'urgence de ${cityName} seront importés automatiquement lors du prochain changement de ville.`
                }
              </p>
            </div>
          )}

          {/* Emergency contacts grid */}
          {!loading && filteredContacts.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredContacts.map((item, idx) => {
                const Icon = ICON_MAP[item.icon] || ICON_MAP.default;
                const cfg = getTypeConfig(item.icon);
                const hasLocation = item.lat && item.lng && item.lat !== 0;

                return (
                  <div
                    key={item.id || idx}
                    className={`group relative ${cfg.bg} border-2 ${cfg.border} ${cfg.hoverBorder} rounded-3xl p-5 shadow-lg hover:shadow-xl transition-all duration-200`}
                  >
                    {/* Top: Icon + Name + Badge */}
                    <div className="flex items-start space-x-4">
                      <div className={`p-3.5 ${cfg.iconBg} border rounded-2xl flex-shrink-0`}>
                        <Icon className={`w-7 h-7 ${cfg.iconColor}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="text-base font-black text-white leading-tight line-clamp-2">
                            {item.name}
                          </h3>
                          <span className={`text-[10px] uppercase font-black px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0 ${cfg.badgeBg}`}>
                            {cfg.label}
                          </span>
                        </div>

                        {item.address && (
                          <div className="flex items-center space-x-1.5 mt-1.5">
                            <MapPin className="w-3 h-3 text-slate-500 flex-shrink-0" />
                            <span className="text-slate-400 text-xs line-clamp-1">{item.address}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Divider */}
                    <div className="my-3.5 border-t border-slate-800/80" />

                    {/* Number + Actions row */}
                    <div className="flex items-center justify-between gap-3">
                      {/* Emergency number */}
                      <div>
                        <span className="text-[10px] uppercase text-slate-500 font-bold block mb-0.5">
                          {item.number ? 'N° d\'urgence' : 'Localisation GPS'}
                        </span>
                        {item.number ? (
                          <span className={`text-2xl font-black font-mono tracking-wider ${cfg.numColor}`}>
                            {item.number}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400 font-mono">
                            {hasLocation ? `${Number(item.lat).toFixed(4)}, ${Number(item.lng).toFixed(4)}` : 'Position inconnue'}
                          </span>
                        )}
                      </div>

                      {/* Itinerary Actions */}
                      {hasLocation && (
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => setSelectedItineraryContact(item)}
                            className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold active:scale-95 transition shadow-sm whitespace-nowrap cursor-pointer"
                            title="Voir l'itinéraire sur la borne"
                          >
                            <Navigation className="w-3.5 h-3.5 text-amber-400" />
                            <span>Itinéraire</span>
                          </button>

                          <button
                            onClick={() => setActiveEmergencyQr(item)}
                            className={`flex items-center space-x-1 px-2.5 py-2 rounded-xl ${cfg.iconBg} border text-xs font-bold active:scale-95 transition-transform ${cfg.iconColor} whitespace-nowrap cursor-pointer`}
                            title="Scanner le QR Code"
                          >
                            <QrCode className="w-3.5 h-3.5" />
                            <span>QR</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Practical Tips Banner */}
          <div className="mt-8 bg-gradient-to-r from-amber-950/60 to-slate-900/80 border border-amber-500/20 rounded-3xl p-6">
            <div className="flex items-start space-x-3 mb-3">
              <div className="p-2 bg-amber-500/20 rounded-xl border border-amber-400/30">
                <Info className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h4 className="text-base font-black text-amber-300">Conseils pratiques à {cityName}</h4>
                <p className="text-xs text-slate-400 mt-0.5">À garder en mémoire pendant votre séjour</p>
              </div>
            </div>
            <ul className="space-y-2 text-sm text-slate-300">
              <li className="flex items-start space-x-2">
                <span className="text-amber-400 mt-0.5 flex-shrink-0">•</span>
                <span>Conservez toujours une <strong>photocopie de votre passeport et visa</strong> sur vous.</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="text-amber-400 mt-0.5 flex-shrink-0">•</span>
                <span>La monnaie courante est l'<strong>Ariary (MGA)</strong>. Prévoyez de l'argent liquide pour les petits commerces.</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="text-amber-400 mt-0.5 flex-shrink-0">•</span>
                <span>En cas d'urgence médicale, les numéros <strong>020</strong> (hôpital) et <strong>17</strong> (police) sont les plus importants.</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="text-amber-400 mt-0.5 flex-shrink-0">•</span>
                <span>L'<strong>Office Régional du Tourisme</strong> peut vous orienter et vous fournir une assistance locale.</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* QR Code Navigation Modal */}
      {activeEmergencyQr && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-6">
          <div className="bg-slate-900 border-2 border-rose-500/60 rounded-3xl p-8 max-w-sm w-full text-center relative shadow-2xl">
            <button
              onClick={() => setActiveEmergencyQr(null)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-full bg-slate-800 hover:bg-slate-700 transition"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Service icon */}
            <div className="flex justify-center mb-4">
              <div className="p-4 bg-rose-500/20 rounded-3xl border border-rose-500/30">
                {React.createElement(ICON_MAP[activeEmergencyQr.icon] || ShieldAlert, { className: 'w-10 h-10 text-rose-400' })}
              </div>
            </div>

            <h3 className="text-xl font-black text-white mb-1">Itinéraire d'Urgence</h3>
            <p className="text-slate-400 text-sm mb-1">
              Navigation directe vers
            </p>
            <p className="text-rose-300 font-bold text-base mb-5">{activeEmergencyQr.name}</p>

            {/* QR Code */}
            <div className="p-4 bg-white rounded-2xl inline-block shadow-xl mb-4">
              <img
                src={getQrCodeImageUrl(activeEmergencyQr.lat, activeEmergencyQr.lng, activeEmergencyQr.name, 200)}
                alt="QR Code Urgence"
                className="w-48 h-48 mx-auto"
              />
            </div>

            <div className="text-xs text-slate-400 bg-slate-950/60 rounded-xl p-3 mb-5 border border-slate-800">
              <Navigation className="w-3.5 h-3.5 inline mr-1 text-rose-400" />
              Scannez pour lancer le guidage GPS depuis votre position actuelle
            </div>

            <button
              onClick={() => setActiveEmergencyQr(null)}
              className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl active:scale-95 transition"
            >
              Fermer
            </button>
          </div>
        </div>
      )}
      {/* Interactive Itinerary Preview Modal on Touch Screen */}
      <ItineraryPreviewModal
        isOpen={!!selectedItineraryContact}
        onClose={() => setSelectedItineraryContact(null)}
        place={selectedItineraryContact}
        kioskConfig={kioskConfig}
        currentLang={currentLang}
      />
    </div>
  );
}

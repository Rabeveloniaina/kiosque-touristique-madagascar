import React, { useState, useEffect } from 'react';
import {
  Handshake, Phone, MapPin, QrCode, X, Sparkles, Search,
  Building2, Leaf, UtensilsCrossed, Palette, ChevronRight,
  Globe, Navigation
} from 'lucide-react';
import { mockPartners } from '../../data/mockData';
import { translations } from '../../data/translations';
import { api } from '../../services/api';
import { getQrCodeImageUrl } from '../../utils/navigation';

// Partner type → config mapping
const TYPE_CONFIG = {
  'Thé & Tisane':     { color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-400/20', icon: Leaf },
  'Artisanat':        { color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-400/20', icon: Palette },
  'Vignoble & Vin':   { color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-400/20', icon: Sparkles },
  'Restauration':     { color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-400/20', icon: UtensilsCrossed },
  'Hébergement':      { color: 'text-sky-400', bg: 'bg-sky-500/10', border: 'border-sky-400/20', icon: Building2 },
  'default':          { color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-400/20', icon: Handshake },
};

function getTypeConfig(type) {
  return TYPE_CONFIG[type] || TYPE_CONFIG['default'];
}

export default function PartnersModuleView({ currentLang, onLogItemClick, kioskConfig }) {
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activePartnerQr, setActivePartnerQr] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeType, setActiveType] = useState('all');
  const t = translations[currentLang] || translations.fr;
  const cityName = kioskConfig?.active_city || 'Madagascar';
  const region = kioskConfig?.active_region || '';

  useEffect(() => {
    async function loadPartners() {
      setLoading(true);
      setPartners([]);
      try {
        const data = await api.getPartners();
        if (data && data.length > 0) {
          setPartners(data);
        } else if (cityName === 'Fianarantsoa') {
          setPartners(mockPartners);
        } else {
          setPartners([]);
        }
      } catch {
        setPartners(cityName === 'Fianarantsoa' ? mockPartners : []);
      } finally {
        setLoading(false);
      }
    }
    loadPartners();
  }, [cityName]);

  // Unique partner types for filter tabs
  const types = ['all', ...new Set(partners.map(p => p.type).filter(Boolean))];

  const filteredPartners = partners.filter(p => {
    const matchType = activeType === 'all' || p.type === activeType;
    const matchSearch = !searchQuery ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.description || p.desc || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchType && matchSearch;
  });

  return (
    <div className="flex-1 w-full bg-slate-950 flex flex-col overflow-hidden">
      {/* Sticky header */}
      <div className="bg-slate-950/95 backdrop-blur-sm border-b border-slate-800/80 px-6 py-5 flex-shrink-0">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 bg-amber-500/20 rounded-2xl border border-amber-400/30">
                <Handshake className="w-6 h-6 text-amber-400" />
              </div>
              <div>
                <h1 className="text-xl font-black text-white">{t.modules.partners.title}</h1>
                <p className="text-slate-400 text-xs mt-0.5">
                  Artisans & entreprises partenaires à{' '}
                  <span className="text-white font-bold">{cityName}</span>
                  {region ? ` • ${region}` : ''}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2 bg-slate-900 border border-slate-700 px-3 py-1.5 rounded-full">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-xs font-bold text-slate-300">{partners.length} partenaire{partners.length !== 1 ? 's' : ''}</span>
            </div>
          </div>

          {/* Search */}
          <div className="relative mb-3">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={`Rechercher un partenaire à ${cityName}…`}
              className="w-full bg-slate-900 border border-slate-700 text-white placeholder-slate-500 rounded-2xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-amber-500/60 transition"
            />
          </div>

          {/* Type filter tabs */}
          {types.length > 1 && (
            <div className="flex space-x-2 overflow-x-auto pb-1 scrollbar-none">
              {types.map(type => {
                const cfg = getTypeConfig(type);
                const Icon = cfg.icon;
                const count = type === 'all' ? partners.length : partners.filter(p => p.type === type).length;
                return (
                  <button
                    key={type}
                    onClick={() => setActiveType(type)}
                    className={`flex items-center space-x-1.5 px-4 py-2 rounded-xl font-bold text-xs whitespace-nowrap transition active:scale-95 ${
                      activeType === type
                        ? 'bg-amber-500 text-slate-950 border-2 border-amber-400 shadow-lg'
                        : 'bg-slate-900 text-slate-400 border border-slate-700 hover:border-slate-600'
                    }`}
                  >
                    {type !== 'all' && <Icon className="w-3.5 h-3.5" />}
                    <span>{type === 'all' ? 'Tous' : type}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${
                      activeType === type ? 'bg-slate-950/20' : 'bg-slate-800 text-slate-500'
                    }`}>{count}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-6 pb-28">
        <div className="max-w-6xl mx-auto">

          {/* Loading skeleton */}
          {loading && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden animate-pulse">
                  <div className="h-36 bg-slate-800" />
                  <div className="p-5 space-y-3">
                    <div className="h-3 bg-slate-800 rounded w-1/3" />
                    <div className="h-5 bg-slate-800 rounded w-2/3" />
                    <div className="h-3 bg-slate-800 rounded w-full" />
                    <div className="h-3 bg-slate-800 rounded w-4/5" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Empty state */}
          {!loading && filteredPartners.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="p-5 bg-slate-900 rounded-3xl border border-slate-800 mb-4">
                <Handshake className="w-14 h-14 text-slate-600" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Aucun partenaire trouvé</h3>
              <p className="text-slate-500 text-sm max-w-sm">
                {searchQuery
                  ? `Aucun résultat pour "${searchQuery}".`
                  : `Les partenaires de ${cityName} seront listés ici après leur enregistrement.`
                }
              </p>
            </div>
          )}

          {/* Partners grid */}
          {!loading && filteredPartners.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredPartners.map((partner, idx) => {
                const cfg = getTypeConfig(partner.type);
                const TypeIcon = cfg.icon;
                const hasLocation = partner.lat && partner.lng;

                return (
                  <div
                    key={partner.id || idx}
                    className="group bg-slate-900 border-2 border-slate-800 hover:border-amber-400/50 rounded-3xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-200 flex flex-col"
                  >
                    {/* Photo */}
                    {partner.image_url ? (
                      <div className="h-40 overflow-hidden relative flex-shrink-0">
                        <img
                          src={partner.image_url}
                          alt={partner.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          onError={e => { e.target.parentElement.style.display = 'none'; }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-transparent to-transparent" />
                        {/* Type badge overlaid on image */}
                        <div className={`absolute bottom-3 left-3 flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${cfg.bg} ${cfg.color} border ${cfg.border} backdrop-blur-sm`}>
                          <TypeIcon className="w-3 h-3" />
                          <span>{partner.type}</span>
                        </div>
                      </div>
                    ) : (
                      <div className={`h-24 ${cfg.bg} flex items-center justify-center flex-shrink-0 border-b border-slate-800`}>
                        <TypeIcon className={`w-12 h-12 ${cfg.color} opacity-40`} />
                      </div>
                    )}

                    <div className="p-5 flex flex-col flex-1">
                      {/* Type badge (when no image) */}
                      {!partner.image_url && (
                        <div className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${cfg.bg} ${cfg.color} border ${cfg.border} mb-3 self-start`}>
                          <TypeIcon className="w-3 h-3" />
                          <span>{partner.type || 'Partenaire'}</span>
                        </div>
                      )}

                      <h3 className="text-base font-black text-white group-hover:text-amber-300 transition-colors">
                        {partner.name}
                      </h3>

                      <p className="text-slate-400 text-xs mt-2 leading-relaxed line-clamp-3 flex-1">
                        {partner.description || partner.desc || ''}
                      </p>

                      {/* Contact info */}
                      <div className="mt-4 space-y-1.5 border-t border-slate-800/80 pt-3">
                        {partner.contact && (
                          <div className="flex items-center space-x-2 text-emerald-400 text-xs font-mono font-bold">
                            <Phone className="w-3 h-3 flex-shrink-0" />
                            <span>{partner.contact}</span>
                          </div>
                        )}
                        {partner.address && (
                          <div className="flex items-center space-x-2 text-slate-500 text-xs">
                            <MapPin className="w-3 h-3 flex-shrink-0 text-slate-600" />
                            <span className="line-clamp-1">{partner.address}</span>
                          </div>
                        )}
                      </div>

                      {/* QR button */}
                      {hasLocation && (
                        <button
                          onClick={() => setActivePartnerQr(partner)}
                          className="mt-3 w-full flex items-center justify-center space-x-2 py-2.5 bg-slate-800 hover:bg-amber-500/15 text-amber-300 border border-amber-400/20 hover:border-amber-400/40 rounded-xl text-xs font-bold active:scale-95 transition"
                        >
                          <QrCode className="w-3.5 h-3.5" />
                          <span>Itinéraire QR Code</span>
                          <ChevronRight className="w-3.5 h-3.5" />
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

      {/* QR Modal */}
      {activePartnerQr && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-6">
          <div className="bg-slate-900 border-2 border-amber-500/50 rounded-3xl p-8 max-w-sm w-full text-center relative shadow-2xl">
            <button
              onClick={() => setActivePartnerQr(null)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-full bg-slate-800 hover:bg-slate-700 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex justify-center mb-4">
              <div className="p-4 bg-amber-500/20 rounded-3xl border border-amber-400/30">
                <Handshake className="w-10 h-10 text-amber-400" />
              </div>
            </div>

            <h3 className="text-xl font-black text-white">Itinéraire Partenaire</h3>
            <p className="text-amber-300 font-bold mt-1">{activePartnerQr.name}</p>
            {activePartnerQr.address && (
              <p className="text-slate-500 text-xs mt-0.5">{activePartnerQr.address}</p>
            )}

            <div className="my-5 p-4 bg-white rounded-2xl inline-block shadow-xl">
              <img
                src={getQrCodeImageUrl(activePartnerQr.lat, activePartnerQr.lng, activePartnerQr.name, 200)}
                alt="QR Code Partenaire"
                className="w-48 h-48 mx-auto"
              />
            </div>

            <div className="flex items-center justify-center space-x-1.5 text-xs text-slate-400 mb-5">
              <Navigation className="w-3.5 h-3.5 text-amber-400" />
              <span>Scannez pour ouvrir la navigation GPS</span>
            </div>

            <button
              onClick={() => setActivePartnerQr(null)}
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

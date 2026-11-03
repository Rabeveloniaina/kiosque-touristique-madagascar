import React, { useState } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { 
  X, Navigation, MapPin, Compass, Clock, Route, 
  Sparkles, QrCode, Phone, Check, ChevronRight
} from 'lucide-react';
import { getQrCodeImageUrl } from '../utils/navigation';

// Kiosk Pin (Start Point)
const kioskPinIcon = L.divIcon({
  className: 'custom-kiosk-pin',
  html: `
    <div style="
      background: linear-gradient(135deg, #2563eb, #1d4ed8);
      width: 34px;
      height: 34px;
      border-radius: 50%;
      border: 3px solid #ffffff;
      box-shadow: 0 4px 12px rgba(0,0,0,0.6);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: 900;
      font-size: 14px;
    ">
      K
    </div>
  `,
  iconSize: [34, 34],
  iconAnchor: [17, 17]
});

// Destination Pin (End Point)
const destinationPinIcon = L.divIcon({
  className: 'custom-destination-pin',
  html: `
    <div style="
      background: linear-gradient(135deg, #f59e0b, #d97706);
      width: 36px;
      height: 36px;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      border: 3px solid #ffffff;
      box-shadow: 0 4px 14px rgba(0,0,0,0.7);
      display: flex;
      align-items: center;
      justify-content: center;
    ">
      <div style="width: 12px; height: 12px; background: white; border-radius: 50%; transform: rotate(45deg);"></div>
    </div>
  `,
  iconSize: [36, 36],
  iconAnchor: [18, 36]
});

export default function ItineraryPreviewModal({ 
  isOpen, 
  onClose, 
  place, 
  kioskConfig, 
  currentLang = 'fr' 
}) {
  const [showQr, setShowQr] = useState(false);

  if (!isOpen || !place) return null;

  const cityName = kioskConfig?.active_city || place.city || 'Madagascar';
  const kioskLat = kioskConfig?.active_lat ?? -21.4536;
  const kioskLng = kioskConfig?.active_lng ?? 47.0858;

  const destLat = parseFloat(place.lat) || kioskLat;
  const destLng = parseFloat(place.lng) || kioskLng;

  const hasCoords = !isNaN(destLat) && !isNaN(destLng) && (destLat !== 0 || destLng !== 0);
  const centerLat = hasCoords ? (kioskLat + destLat) / 2 : kioskLat;
  const centerLng = hasCoords ? (kioskLng + destLng) / 2 : kioskLng;

  const qrImageUrl = hasCoords ? getQrCodeImageUrl(destLat, destLng, place.name) : null;

  const placeName = place.name || 'Lieu';
  const distance = place.distance_km || 'Proche';
  const travelTime = place.travel_time || '10 - 20 min';
  const itinerarySteps = place.itinerary_steps || 
    `Depuis le kiosque de ${cityName}, suivre l'axe principal en direction de ${placeName}. Trajet accessible à pied, en pousse-pousse ou taxi-ville.`;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 md:p-6 animate-fade-in select-none">
      <div className="bg-slate-900 border-2 border-amber-500/80 rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Top Header with Prominent Exit / Close Button */}
        <div className="p-4 md:p-5 bg-slate-950/90 border-b border-slate-800 flex items-center justify-between z-10">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-400">
              <Navigation className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Aperçu de l'Itinéraire
                </span>
                <span className="text-xs text-slate-400 hidden sm:inline">• {cityName}</span>
              </div>
              <h2 className="text-lg md:text-xl font-black text-white truncate max-w-md md:max-w-xl mt-0.5">
                {placeName}
              </h2>
            </div>
          </div>

          {/* Prominent Exit Button (Touch-Friendly, Red accent) */}
          <button
            onClick={onClose}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-2xl bg-slate-800 hover:bg-rose-950/80 text-slate-200 hover:text-rose-300 border border-slate-700 hover:border-rose-500/50 font-black text-xs uppercase tracking-wider shadow-lg active:scale-95 transition cursor-pointer"
            title="Quitter et revenir"
          >
            <X className="w-4 h-4 text-rose-400" />
            <span>Quitter</span>
          </button>
        </div>

        {/* Modal Body: Split Map & Itinerary Steps */}
        <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 gap-0">
          
          {/* Left Column: Interactive Map Preview (Leaflet, NO OUTBOUND LINKS) */}
          <div className="lg:col-span-7 h-64 sm:h-80 lg:h-auto min-h-[260px] relative bg-slate-950 border-b lg:border-b-0 lg:border-r border-slate-800">
            {hasCoords ? (
              <MapContainer
                center={[centerLat, centerLng]}
                zoom={14}
                scrollWheelZoom={false}
                touchZoom={true}
                dragging={true}
                style={{ height: '100%', width: '100%', background: '#0f172a' }}
              >
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; OpenStreetMap'
                />

                {/* Kiosk Marker (Start Point) */}
                <Marker position={[kioskLat, kioskLng]} icon={kioskPinIcon}>
                  <Popup>
                    <div className="text-slate-900 font-bold text-xs p-1">
                      📍 <b>Kiosque Touristique</b><br />
                      Point de départ actuel ({cityName})
                    </div>
                  </Popup>
                </Marker>

                {/* Destination Marker */}
                <Marker position={[destLat, destLng]} icon={destinationPinIcon}>
                  <Popup>
                    <div className="text-slate-900 font-bold text-xs p-1">
                      🏁 <b>{placeName}</b><br />
                      Destination
                    </div>
                  </Popup>
                </Marker>

                {/* Dotted Flight/Route Line */}
                <Polyline
                  positions={[
                    [kioskLat, kioskLng],
                    [destLat, destLng]
                  ]}
                  color="#f59e0b"
                  dashArray="8, 8"
                  weight={4}
                  opacity={0.85}
                />
              </MapContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center p-6 text-center text-slate-500">
                <Compass className="w-12 h-12 mb-2 text-slate-600" />
                <p className="text-sm">Coordonnées cartographiques non renseignées.</p>
              </div>
            )}

            {/* Map Legend Overlay */}
            <div className="absolute bottom-3 left-3 z-[400] flex items-center space-x-2 bg-slate-950/85 backdrop-blur-md px-3 py-1.5 rounded-full border border-slate-800 text-[10px] text-slate-300 shadow-xl">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" />
              <span>Kiosque</span>
              <span className="text-slate-600">•</span>
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
              <span>Destination</span>
            </div>
          </div>

          {/* Right Column: Step-by-Step Route & Practical Details */}
          <div className="lg:col-span-5 p-5 md:p-6 flex flex-col justify-between space-y-4 bg-slate-900/60 overflow-y-auto">
            
            {/* Quick Metrics */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-2xl">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Distance</span>
                <span className="text-sm md:text-base font-black text-amber-400 mt-0.5 block truncate">
                  {distance}
                </span>
              </div>
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-2xl">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Temps estimé</span>
                <span className="text-sm md:text-base font-black text-white mt-0.5 block truncate">
                  {travelTime}
                </span>
              </div>
            </div>

            {/* Step-by-Step Journey Timeline */}
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
                <Route className="w-4 h-4 text-amber-400" />
                <span>Étapes du parcours</span>
              </h4>

              <div className="space-y-3 text-xs">
                {/* Step 1: Start */}
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 rounded-full bg-blue-600/30 border border-blue-400/50 text-blue-300 font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                    1
                  </div>
                  <div>
                    <span className="font-bold text-white block">Départ : Kiosque ({cityName})</span>
                    <span className="text-slate-400 text-[11px]">Position actuelle sur la borne tactile.</span>
                  </div>
                </div>

                {/* Step 2: Directions */}
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 rounded-full bg-amber-600/30 border border-amber-400/50 text-amber-300 font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                    2
                  </div>
                  <div>
                    <span className="font-bold text-white block">Trajet & Orientation</span>
                    <span className="text-slate-300 text-[11px] leading-relaxed block mt-0.5">
                      {itinerarySteps}
                    </span>
                  </div>
                </div>

                {/* Step 3: Arrival */}
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 rounded-full bg-emerald-600/30 border border-emerald-400/50 text-emerald-300 font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                    3
                  </div>
                  <div>
                    <span className="font-bold text-white block">Arrivée : {placeName}</span>
                    {place.contact && (
                      <span className="text-emerald-400 font-mono text-[11px] block mt-0.5 flex items-center space-x-1">
                        <Phone className="w-3 h-3 inline" />
                        <span>{place.contact}</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Optional QR Code Card (In-modal, without opening external tabs) */}
            <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-2xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <QrCode className="w-4 h-4 text-blue-400" />
                  <span className="text-xs font-bold text-slate-300">Emporter l'itinéraire sur mobile</span>
                </div>
                <button
                  onClick={() => setShowQr(!showQr)}
                  className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 transition"
                >
                  {showQr ? 'Masquer QR' : 'Afficher QR'}
                </button>
              </div>

              {showQr && qrImageUrl && (
                <div className="mt-3 pt-3 border-t border-slate-800/80 flex flex-col items-center text-center animate-fade-in">
                  <div className="p-2 bg-white rounded-xl shadow-lg mb-2">
                    <img 
                      src={qrImageUrl} 
                      alt={`QR Code Itinéraire ${placeName}`} 
                      className="w-28 h-28 object-contain"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Scannez avec l'appareil photo de votre smartphone pour naviguer via GPS.
                  </p>
                </div>
              )}
            </div>

            {/* Bottom Dismiss Button */}
            <button
              onClick={onClose}
              className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-2xl text-xs uppercase tracking-wider transition active:scale-95"
            >
              Fermer l'aperçu
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}


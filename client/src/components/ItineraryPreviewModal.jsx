import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { 
  X, Navigation, MapPin, Compass, Clock, Route, 
  Sparkles, QrCode, Phone, Check, ChevronRight, AlertCircle, Loader2
} from 'lucide-react';
import { getQrCodeImageUrl } from '../utils/navigation';

// ────────────────────────────────────────────────────────────────────────────────
// Custom Map Pins
// ────────────────────────────────────────────────────────────────────────────────

const kioskPinIcon = L.divIcon({
  className: 'custom-kiosk-pin',
  html: `
    <div style="
      background: linear-gradient(135deg, #2563eb, #1d4ed8);
      width: 34px; height: 34px;
      border-radius: 50%;
      border: 3px solid #ffffff;
      box-shadow: 0 4px 12px rgba(0,0,0,0.6);
      display: flex; align-items: center; justify-content: center;
      color: white; font-weight: 900; font-size: 14px;
    ">K</div>
  `,
  iconSize: [34, 34],
  iconAnchor: [17, 17]
});

const destinationPinIcon = L.divIcon({
  className: 'custom-destination-pin',
  html: `
    <div style="
      background: linear-gradient(135deg, #f59e0b, #d97706);
      width: 36px; height: 36px;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      border: 3px solid #ffffff;
      box-shadow: 0 4px 14px rgba(0,0,0,0.7);
      display: flex; align-items: center; justify-content: center;
    ">
      <div style="width:12px;height:12px;background:white;border-radius:50%;transform:rotate(45deg);"></div>
    </div>
  `,
  iconSize: [36, 36],
  iconAnchor: [18, 36]
});

// ────────────────────────────────────────────────────────────────────────────────
// Helper: fit map bounds to route
// ────────────────────────────────────────────────────────────────────────────────

function FitBounds({ coords }) {
  const map = useMap();
  useEffect(() => {
    if (coords && coords.length >= 2) {
      const bounds = L.latLngBounds(coords);
      map.fitBounds(bounds, { padding: [40, 40] });
    }
  }, [coords, map]);
  return null;
}

// ────────────────────────────────────────────────────────────────────────────────
// Utility: format metres → "X,X km" or "XXX m"
// ────────────────────────────────────────────────────────────────────────────────
function formatDistance(metres) {
  if (!metres) return null;
  if (metres >= 1000) return `${(metres / 1000).toFixed(1).replace('.', ',')} km`;
  return `${Math.round(metres)} m`;
}

// Utility: format seconds → "Xh Xmin" or "X min"
function formatDuration(seconds) {
  if (!seconds) return null;
  const mins = Math.round(seconds / 60);
  if (mins >= 60) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h ${m} min` : `${h}h`;
  }
  return `${mins} min`;
}

// ────────────────────────────────────────────────────────────────────────────────
// Main Component
// ────────────────────────────────────────────────────────────────────────────────

export default function ItineraryPreviewModal({ 
  isOpen, 
  onClose, 
  place, 
  kioskConfig, 
  currentLang = 'fr' 
}) {
  const [showQr, setShowQr] = useState(false);
  const [routeCoords, setRouteCoords] = useState([]);
  const [routeDistance, setRouteDistance] = useState(null);   // metres (number)
  const [routeDuration, setRouteDuration] = useState(null);   // seconds (number)
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState(false);
  const abortRef = useRef(null);

  if (!isOpen || !place) return null;

  const cityName = kioskConfig?.active_city || place.city || 'Madagascar';
  const kioskLat = parseFloat(kioskConfig?.active_lat) || -21.4536;
  const kioskLng = parseFloat(kioskConfig?.active_lng) || 47.0858;

  const destLat = parseFloat(place.lat) || kioskLat;
  const destLng = parseFloat(place.lng) || kioskLng;

  const hasCoords = !isNaN(destLat) && !isNaN(destLng) && (destLat !== kioskLat || destLng !== kioskLng);

  const qrImageUrl = hasCoords ? getQrCodeImageUrl(destLat, destLng, place.name) : null;

  const placeName = place.name || 'Lieu';
  // Fallback values from DB (overridden by OSRM when loaded)
  const fallbackDistance = place.distance_km || null;
  const fallbackDuration = place.travel_time || null;
  const itinerarySteps = place.itinerary_steps || 
    `Depuis le kiosque de ${cityName}, suivre l'axe principal en direction de ${placeName}. Trajet accessible à pied, en pousse-pousse ou taxi-ville.`;

  // ── Fetch OSRM route whenever place/kiosk changes ──────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    if (!hasCoords) return;

    // Cancel any pending request
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setRouteLoading(true);
    setRouteError(false);
    setRouteCoords([]);
    setRouteDistance(null);
    setRouteDuration(null);

    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/` +
      `${kioskLng},${kioskLat};${destLng},${destLat}` +
      `?overview=full&geometries=geojson`;

    fetch(osrmUrl, { signal: controller.signal })
      .then(r => r.json())
      .then(data => {
        if (data.routes && data.routes[0]) {
          const route = data.routes[0];
          // GeoJSON coords are [lng, lat] → convert to [lat, lng] for Leaflet
          const coords = route.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
          setRouteCoords(coords);
          setRouteDistance(route.distance);   // metres
          setRouteDuration(route.duration);   // seconds
        } else {
          // No route found — fallback to straight line
          setRouteCoords([[kioskLat, kioskLng], [destLat, destLng]]);
          setRouteError(true);
        }
        setRouteLoading(false);
      })
      .catch(err => {
        if (err.name === 'AbortError') return;
        // Network error — fallback to straight line
        setRouteCoords([[kioskLat, kioskLng], [destLat, destLng]]);
        setRouteError(true);
        setRouteLoading(false);
      });

    return () => controller.abort();
  }, [isOpen, kioskLat, kioskLng, destLat, destLng, hasCoords]);

  // Display values: prefer OSRM, fallback to DB, then generic
  const displayDistance = routeDistance
    ? formatDistance(routeDistance)
    : (fallbackDistance || 'Proche');
  const displayDuration = routeDuration
    ? formatDuration(routeDuration)
    : (fallbackDuration || '10 – 20 min');

  // Polyline positions
  const polylinePositions = routeCoords.length >= 2
    ? routeCoords
    : [[kioskLat, kioskLng], [destLat, destLng]];

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 md:p-6 select-none">
      <div className="bg-slate-900 border-2 border-amber-500/80 rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div className="p-4 md:p-5 bg-slate-950/90 border-b border-slate-800 flex items-center justify-between z-10 flex-shrink-0">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-400 flex-shrink-0">
              <Navigation className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 whitespace-nowrap">
                  Aperçu de l'Itinéraire
                </span>
                <span className="text-xs text-slate-400 hidden sm:inline">• {cityName}</span>
              </div>
              <h2 className="text-lg md:text-xl font-black text-white truncate mt-0.5">
                {placeName}
              </h2>
            </div>
          </div>

          {/* Prominent Exit Button */}
          <button
            onClick={onClose}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-2xl bg-slate-800 hover:bg-rose-950/80 text-slate-200 hover:text-rose-300 border border-slate-700 hover:border-rose-500/50 font-black text-xs uppercase tracking-wider shadow-lg active:scale-95 transition cursor-pointer flex-shrink-0 ml-3"
            title="Quitter et revenir"
          >
            <X className="w-4 h-4 text-rose-400" />
            <span>Quitter</span>
          </button>
        </div>

        {/* ── Body ───────────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 gap-0">
          
          {/* Left: Map */}
          <div className="lg:col-span-7 h-64 sm:h-80 lg:h-auto min-h-[260px] relative bg-slate-950 border-b lg:border-b-0 lg:border-r border-slate-800">
            {hasCoords ? (
              <MapContainer
                center={[(kioskLat + destLat) / 2, (kioskLng + destLng) / 2]}
                zoom={13}
                scrollWheelZoom={false}
                touchZoom={true}
                dragging={true}
                style={{ height: '100%', width: '100%', background: '#0f172a' }}
              >
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution="&copy; OpenStreetMap"
                />

                {/* Auto-fit bounds once route is loaded */}
                {routeCoords.length >= 2 && <FitBounds coords={routeCoords} />}

                {/* Kiosk Marker */}
                <Marker position={[kioskLat, kioskLng]} icon={kioskPinIcon}>
                  <Popup>
                    <div className="text-slate-900 font-bold text-xs p-1">
                      📍 <b>Kiosque Touristique</b><br />
                      Point de départ ({cityName})
                    </div>
                  </Popup>
                </Marker>

                {/* Destination Marker */}
                <Marker position={[destLat, destLng]} icon={destinationPinIcon}>
                  <Popup>
                    <div className="text-slate-900 font-bold text-xs p-1">
                      🏁 <b>{placeName}</b><br />Destination
                    </div>
                  </Popup>
                </Marker>

                {/* Route line */}
                <Polyline
                  positions={polylinePositions}
                  color={routeError ? '#94a3b8' : '#f59e0b'}
                  dashArray={routeError ? '8,8' : undefined}
                  weight={routeError ? 3 : 5}
                  opacity={0.9}
                />
              </MapContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center p-6 text-center text-slate-500">
                <Compass className="w-12 h-12 mb-2 text-slate-600" />
                <p className="text-sm">Coordonnées cartographiques non renseignées.</p>
              </div>
            )}

            {/* Loading overlay */}
            {routeLoading && (
              <div className="absolute inset-0 z-[500] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center">
                <div className="flex items-center space-x-2 bg-slate-900 border border-slate-700 px-4 py-2.5 rounded-full shadow-xl">
                  <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
                  <span className="text-xs text-slate-300 font-bold">Calcul de l'itinéraire…</span>
                </div>
              </div>
            )}

            {/* Error badge */}
            {routeError && !routeLoading && (
              <div className="absolute top-3 right-3 z-[400] flex items-center space-x-1.5 bg-slate-900/90 border border-amber-500/40 px-3 py-1.5 rounded-full text-[10px] text-amber-300 font-bold shadow">
                <AlertCircle className="w-3 h-3" />
                <span>Tracé approximatif</span>
              </div>
            )}

            {/* Map legend */}
            <div className="absolute bottom-3 left-3 z-[400] flex items-center space-x-2 bg-slate-950/85 backdrop-blur-md px-3 py-1.5 rounded-full border border-slate-800 text-[10px] text-slate-300 shadow-xl">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" />
              <span>Kiosque</span>
              <span className="text-slate-600">•</span>
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
              <span>Destination</span>
            </div>
          </div>

          {/* Right: Details */}
          <div className="lg:col-span-5 p-5 md:p-6 flex flex-col space-y-4 bg-slate-900/60 overflow-y-auto">
            
            {/* Metrics */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-2xl">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Distance</span>
                <span className="text-sm md:text-base font-black text-amber-400 mt-0.5 block truncate">
                  {routeLoading ? '…' : displayDistance}
                </span>
                {!routeLoading && !routeError && routeDistance && (
                  <span className="text-[10px] text-emerald-500 font-bold">Via route</span>
                )}
              </div>
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-2xl">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Temps estimé</span>
                <span className="text-sm md:text-base font-black text-white mt-0.5 block truncate">
                  {routeLoading ? '…' : displayDuration}
                </span>
                {!routeLoading && !routeError && routeDuration && (
                  <span className="text-[10px] text-emerald-500 font-bold">En voiture</span>
                )}
              </div>
            </div>

            {/* Step-by-step */}
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3 flex-1">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
                <Route className="w-4 h-4 text-amber-400" />
                <span>Étapes du parcours</span>
              </h4>

              <div className="space-y-3 text-xs">
                {/* Step 1 */}
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 rounded-full bg-blue-600/30 border border-blue-400/50 text-blue-300 font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                    1
                  </div>
                  <div>
                    <span className="font-bold text-white block">Départ : Kiosque ({cityName})</span>
                    <span className="text-slate-400 text-[11px]">Position actuelle sur la borne tactile.</span>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 rounded-full bg-amber-600/30 border border-amber-400/50 text-amber-300 font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                    2
                  </div>
                  <div>
                    <span className="font-bold text-white block">Trajet &amp; Orientation</span>
                    <span className="text-slate-300 text-[11px] leading-relaxed block mt-0.5">
                      {itinerarySteps}
                    </span>
                    {!routeLoading && !routeError && routeDistance && (
                      <span className="inline-flex items-center space-x-1 mt-1 text-emerald-400 text-[10px] font-bold">
                        <Check className="w-3 h-3" />
                        <span>Itinéraire calculé via OpenStreetMap</span>
                      </span>
                    )}
                    {routeError && (
                      <span className="inline-flex items-center space-x-1 mt-1 text-amber-400 text-[10px] font-bold">
                        <AlertCircle className="w-3 h-3" />
                        <span>Tracé approximatif (hors ligne)</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Step 3 */}
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

            {/* QR Code section */}
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
                <div className="mt-3 pt-3 border-t border-slate-800/80 flex flex-col items-center text-center">
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

            {/* Close button */}
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

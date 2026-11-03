import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, Check, X, Compass } from 'lucide-react';

// Custom Map Marker Icon using HTML/CSS (clean, high contrast, no broken PNG paths)
const customPinIcon = L.divIcon({
  className: 'custom-leaflet-pin',
  html: `
    <div style="
      background-color: #ef4444; 
      width: 32px; 
      height: 32px; 
      border-radius: 50% 50% 50% 0; 
      transform: rotate(-45deg); 
      border: 3px solid white; 
      box-shadow: 0 4px 10px rgba(0,0,0,0.5); 
      display: flex; 
      align-items: center; 
      justify-content: center;
    ">
      <div style="width: 10px; height: 10px; background: white; border-radius: 50%; transform: rotate(45deg);"></div>
    </div>
  `,
  iconSize: [32, 32],
  iconAnchor: [16, 32]
});

// Component to handle map clicks
function MapClickHandler({ onLocationSelected }) {
  useMapEvents({
    click(e) {
      onLocationSelected(e.latlng.lat, e.latlng.lng);
    }
  });
  return null;
}

export default function LocationPickerModal({ isOpen, onClose, initialLat, initialLng, onConfirm }) {
  const [position, setPosition] = useState([
    initialLat || -21.4536,
    initialLng || 47.0858
  ]);

  useEffect(() => {
    if (initialLat && initialLng) {
      setPosition([initialLat, initialLng]);
    }
  }, [initialLat, initialLng]);

  if (!isOpen) return null;

  const presets = [
    { name: 'Centre-Ville (Gare FCE)', lat: -21.4589, lng: 47.0833 },
    { name: 'Haute-Ville (Ambozontany)', lat: -21.4536, lng: 47.0858 },
    { name: 'CHU Tambohobe', lat: -21.4480, lng: 47.0910 },
    { name: 'Thé Sahambavy', lat: -21.4833, lng: 47.2167 },
    { name: 'Parc Ranomafana', lat: -21.2583, lng: 47.4208 },
    { name: 'Vignobles Maromby', lat: -21.4620, lng: 47.0780 }
  ];

  const handleSelectCoords = (lat, lng) => {
    setPosition([Number(lat.toFixed(6)), Number(lng.toFixed(6))]);
  };

  const handleValidate = () => {
    onConfirm(position[0], position[1]);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border-2 border-amber-500 rounded-3xl w-full max-w-4xl h-[85vh] flex flex-col text-white shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-950 border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-400/30">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-black">Sélectionner un emplacement sur la carte</h3>
              <p className="text-xs text-slate-400">Cliquez n'importe où sur le plan de la ville pour placer le repère</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-full bg-slate-800 text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Presets Bar */}
        <div className="px-6 py-2.5 bg-slate-950/70 border-b border-slate-800 flex space-x-2 overflow-x-auto scrollbar-none text-xs">
          <span className="text-slate-400 font-bold self-center whitespace-nowrap">Repères rapides :</span>
          {presets.map((preset) => (
            <button
              key={preset.name}
              type="button"
              onClick={() => handleSelectCoords(preset.lat, preset.lng)}
              className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg whitespace-nowrap active:scale-95 transition"
            >
              {preset.name}
            </button>
          ))}
        </div>

        {/* Interactive Leaflet Map */}
        <div className="flex-1 relative bg-slate-950">
          <MapContainer
            center={position}
            zoom={13}
            style={{ width: '100%', height: '100%' }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <Marker position={position} icon={customPinIcon} />
            <MapClickHandler onLocationSelected={handleSelectCoords} />
          </MapContainer>

          {/* Current selected coordinates badge */}
          <div className="absolute bottom-4 left-4 z-[1000] bg-slate-900/90 backdrop-blur border border-slate-700 px-4 py-2 rounded-xl text-xs font-mono shadow-xl flex items-center space-x-2">
            <Compass className="w-4 h-4 text-amber-400" />
            <span>Latitude : <b>{position[0]}</b> | Longitude : <b>{position[1]}</b></span>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
          <span className="text-xs text-slate-400">Position choisie : ({position[0]}, {position[1]})</span>
          <div className="flex space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleValidate}
              className="flex items-center space-x-2 px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs uppercase tracking-wider"
            >
              <Check className="w-4 h-4" />
              <span>Valider cette position</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


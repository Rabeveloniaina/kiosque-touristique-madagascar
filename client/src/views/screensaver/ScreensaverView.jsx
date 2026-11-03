import React, { useState, useEffect } from 'react';
import { Sparkles, Eye, HandMetal, MapPin } from 'lucide-react';
import { mockAds } from '../../data/mockData';

export default function ScreensaverView({ onWakeUp, isPersonDetected, adsList, kioskConfig }) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const activeCity = kioskConfig?.active_city || 'Fianarantsoa';

  // Use dynamic ads from backend if available, fallback to mockAds
  const activeAds = adsList && adsList.length > 0 ? adsList : mockAds;

  // Auto-rotation every X seconds based on ad duration
  useEffect(() => {
    if (activeAds.length === 0) return;
    const currentAd = activeAds[currentSlide] || activeAds[0];
    const duration = (currentAd.duration_seconds || 7) * 1000;

    const timer = setTimeout(() => {
      setCurrentSlide((prev) => (prev + 1) % activeAds.length);
    }, duration);

    return () => clearTimeout(timer);
  }, [currentSlide, activeAds]);

  const ad = activeAds[currentSlide] || activeAds[0];
  if (!ad) return null;

  // Adapt between SQLite format (title_fr, title_mg) and mock format (title.fr, title.mg)
  const titleFr = ad.title_fr || ad.title?.fr || activeCity;
  const titleMg = ad.title_mg || ad.title?.mg || '';
  const subtitleFr = ad.subtitle_fr || ad.subtitle?.fr || '';
  const mediaUrl = ad.media_url || ad.imageUrl;
  const isVideo = ad.media_type === 'video' || (mediaUrl && mediaUrl.endsWith('.mp4'));

  return (
    <div
      onClick={onWakeUp}
      className="relative w-full h-full bg-black cursor-pointer overflow-hidden select-none flex flex-col justify-between"
    >
      {/* Background Media Carousel with Smooth Fade */}
      {activeAds.map((slide, index) => {
        const slideUrl = slide.media_url || slide.imageUrl;
        const slideIsVideo = slide.media_type === 'video' || (slideUrl && slideUrl.endsWith('.mp4'));
        const isCurrent = index === currentSlide;

        return (
          <div
            key={slide.id || index}
            className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
              isCurrent ? 'opacity-100 scale-100' : 'opacity-0 scale-105 pointer-events-none'
            }`}
          >
            {slideIsVideo ? (
              <video
                src={slideUrl}
                autoPlay
                loop
                muted
                playsInline
                className="w-full h-full object-cover filter brightness-[0.65]"
              />
            ) : (
              <img
                src={slideUrl}
                alt={slide.title_fr || 'Publicité'}
                className="w-full h-full object-cover filter brightness-[0.65]"
              />
            )}
            {/* Gradient Overlay for high text legibility */}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-slate-950/60" />
          </div>
        );
      })}

      {/* Top Bar: Kiosk Identity & Camera Detection Status */}
      <div className="relative z-10 p-8 flex items-center justify-between">
        <div className="flex items-center space-x-3 bg-black/60 backdrop-blur-md px-6 py-3 rounded-full border border-white/20 shadow-xl">
          <MapPin className="w-6 h-6 text-amber-400" />
          <span className="text-xl font-black tracking-wide text-white uppercase">{activeCity} • MADAGASCAR</span>
        </div>

        {/* Camera Sensor Visual Feedback */}
        <div className="flex items-center space-x-2 bg-black/60 backdrop-blur-md px-5 py-3 rounded-full border border-white/20 text-sm">
          <span className={`w-3.5 h-3.5 rounded-full ${isPersonDetected ? 'bg-emerald-400 animate-ping' : 'bg-amber-400 animate-pulse'}`} />
          <Eye className="w-5 h-5 text-slate-300" />
          <span className="text-slate-200 font-medium">
            {isPersonDetected ? "Visiteur détecté (< 2m)" : "Détection de présence active"}
          </span>
        </div>
      </div>

      {/* Center Slide Information */}
      <div className="relative z-10 px-12 max-w-4xl">
        <div className="inline-flex items-center space-x-2 bg-amber-500/90 text-slate-950 font-black text-sm uppercase px-4 py-1.5 rounded-full mb-4 shadow-lg">
          <Sparkles className="w-4 h-4" />
          <span>{ad.badge || 'À découvrir'}</span>
        </div>

        <h1 className="text-5xl md:text-7xl font-black text-white leading-tight drop-shadow-2xl">
          {titleFr}
        </h1>
        {titleMg && (
          <p className="text-2xl md:text-3xl text-amber-200 font-semibold mt-3 drop-shadow-md">
            {titleMg}
          </p>
        )}
        {subtitleFr && (
          <p className="text-lg md:text-xl text-slate-300 mt-2 font-normal drop-shadow">
            {subtitleFr}
          </p>
        )}

        {/* Carousel indicator dots */}
        <div className="flex space-x-3 mt-8">
          {activeAds.map((_, idx) => (
            <button
              key={idx}
              onClick={(e) => {
                e.stopPropagation();
                setCurrentSlide(idx);
              }}
              className={`h-3 rounded-full transition-all duration-500 ${
                idx === currentSlide ? 'w-12 bg-amber-400' : 'w-3 bg-white/40'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Bottom Floating Touch Bar (High Contrast Call to Action) */}
      <div className="relative z-10 p-8 flex justify-center pb-12">
        <div className="flex items-center space-x-4 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 text-slate-950 px-10 py-5 rounded-3xl shadow-2xl border-4 border-amber-200 animate-bounce">
          <HandMetal className="w-9 h-9" />
          <div className="text-left">
            <div className="text-2xl font-black uppercase tracking-wider">
              Touchez l'écran pour commencer
            </div>
            <div className="text-sm font-bold text-slate-900">
              Kitio ny efijery • Touch screen to start
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

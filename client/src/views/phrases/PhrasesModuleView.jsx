import React, { useState, useEffect } from 'react';
import { Languages, Volume2, Sparkles, Check, Music } from 'lucide-react';
import { mockPhrases } from '../../data/mockData';
import { translations } from '../../data/translations';

export default function PhrasesModuleView({ currentLang, kioskConfig }) {
  const [playingIndex, setPlayingIndex] = useState(null);
  const t = translations[currentLang] || translations.fr;
  const activeCity = kioskConfig?.active_city || 'Madagascar';

  // Web Audio Chime generator (guaranteed to play crisp sound on any browser)
  const playChime = () => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sine';
      osc2.type = 'triangle';

      osc1.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      osc1.frequency.exponentialRampToValueAtTime(659.25, ctx.currentTime + 0.15); // E5

      osc2.frequency.setValueAtTime(329.63, ctx.currentTime);
      osc2.frequency.exponentialRampToValueAtTime(392.00, ctx.currentTime + 0.15);

      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start();
      osc2.start();
      osc1.stop(ctx.currentTime + 0.4);
      osc2.stop(ctx.currentTime + 0.4);
    } catch (err) {
      console.warn('Web Audio chime not available:', err);
    }
  };

  const playPhrase = (phrase, idx) => {
    setPlayingIndex(idx);
    playChime();

    if ('speechSynthesis' in window) {
      try {
        window.speechSynthesis.resume();
        window.speechSynthesis.cancel();

        // Speak the phrase using available speech voice (fr-FR handles Malagasy vowels cleanly)
        const utterance = new SpeechSynthesisUtterance(phrase.mg);
        utterance.lang = 'fr-FR';
        utterance.rate = 0.85; // Slightly slower for clear pedagogical listening
        utterance.pitch = 1.05;

        // Try to pick a natural voice
        const voices = window.speechSynthesis.getVoices();
        const preferredVoice = voices.find(v => v.lang.startsWith('fr') || v.lang.startsWith('en'));
        if (preferredVoice) {
          utterance.voice = preferredVoice;
        }

        utterance.onend = () => setPlayingIndex(null);
        utterance.onerror = () => setPlayingIndex(null);

        window.speechSynthesis.speak(utterance);

        // Fallback safety timeout if speech gets blocked by OS
        setTimeout(() => setPlayingIndex(null), 2500);
      } catch (err) {
        console.warn('Speech synthesis error:', err);
        setTimeout(() => setPlayingIndex(null), 1000);
      }
    } else {
      setTimeout(() => setPlayingIndex(null), 1000);
    }
  };

  return (
    <div className="flex-1 w-full bg-slate-950 p-6 md:p-8 pb-24 md:pb-28 flex flex-col overflow-y-auto">
      <div className="max-w-6xl mx-auto w-full">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black text-white flex items-center space-x-3">
              <Languages className="w-8 h-8 text-purple-400" />
              <span>{t.modules.phrases.title}</span>
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Expressions et formules de politesse indispensables pour échanger avec le sourire avec les habitants de {activeCity}
            </p>
          </div>

          <div className="hidden md:flex items-center space-x-2 bg-purple-950/60 border border-purple-500/30 px-4 py-2 rounded-2xl text-purple-300 text-xs">
            <Volume2 className="w-4 h-4 text-purple-400" />
            <span>Appuyez sur le haut-parleur pour écouter la prononciation</span>
          </div>
        </div>

        {/* Trilingual Phrase Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {mockPhrases.map((phrase, idx) => (
            <div
              key={idx}
              className="bg-slate-900 border-2 border-slate-800 hover:border-purple-500/50 rounded-3xl p-6 shadow-xl flex flex-col justify-between transition-colors"
            >
              <div>
                {/* Malagasy Native Text */}
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-wider text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-3 py-1 rounded-full">
                    🇲🇬 Malagasy
                  </span>
                  
                  {/* Big Touch-Friendly Audio Button */}
                  <button
                    onClick={() => playPhrase(phrase, idx)}
                    className={`flex items-center space-x-2 px-4 py-2.5 rounded-2xl font-bold text-xs uppercase tracking-wider transition-all active:scale-95 shadow ${
                      playingIndex === idx
                        ? 'bg-amber-400 text-slate-950 animate-pulse'
                        : 'bg-purple-600 hover:bg-purple-500 text-white'
                    }`}
                    title="Écouter la prononciation"
                  >
                    <Volume2 className={`w-5 h-5 ${playingIndex === idx ? 'animate-bounce' : ''}`} />
                    <span>{playingIndex === idx ? 'En lecture...' : 'Écouter'}</span>
                  </button>
                </div>

                <div className="text-2xl font-black text-white mt-3">
                  {phrase.mg}
                </div>

                <div className="text-xs font-medium text-amber-300/90 mt-1 italic">
                  Prononciation : <span className="font-mono font-semibold">{phrase.pronunciation}</span>
                </div>
              </div>

              {/* French & English translations */}
              <div className="mt-5 pt-4 border-t border-slate-800 grid grid-cols-2 gap-3 text-sm">
                <div className="bg-slate-950/50 p-3 rounded-xl border border-slate-800/80">
                  <div className="text-xs font-bold text-slate-400 mb-0.5">🇫🇷 Français</div>
                  <div className="font-semibold text-slate-200">{phrase.fr}</div>
                </div>

                <div className="bg-slate-950/50 p-3 rounded-xl border border-slate-800/80">
                  <div className="text-xs font-bold text-slate-400 mb-0.5">🇬🇧 English</div>
                  <div className="font-semibold text-slate-200">{phrase.en}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

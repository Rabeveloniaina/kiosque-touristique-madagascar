import React, { useState, useEffect, useRef } from 'react';
import { Languages, Volume2 } from 'lucide-react';
import { mockPhrases } from '../../data/mockData';
import { translations } from '../../data/translations';
import { api, resolveMediaUrl } from '../../services/api';

const CATEGORY_META = {
  salutations: { emoji: '👋', fr: 'Salutations', mg: 'Fiarahaba', en: 'Greetings' },
  restauration: { emoji: '🍽️', fr: 'Restauration', mg: 'Sakafo', en: 'Dining' },
  transport: { emoji: '🚕', fr: 'Transport', mg: 'Fitaterana', en: 'Transport' },
  urgences: { emoji: '🆘', fr: 'Urgences', mg: 'Vonjy taitra', en: 'Emergency' },
  commerce: { emoji: '🛍️', fr: 'Commerce', mg: 'Varotra', en: 'Shopping' }
};

const FALLBACK_CATEGORIES = [
  'salutations', 'salutations', 'salutations', 'commerce', 'restauration', 'transport'
];

const fallbackPhrases = mockPhrases.map((phrase, index) => ({
  id: `mock-${index}`,
  category: FALLBACK_CATEGORIES[index] || 'salutations',
  text_mg: phrase.mg,
  text_fr: phrase.fr,
  text_en: phrase.en,
  pronunciation: phrase.pronunciation,
  audio_url: null,
  audio_key: null,
  sort_order: (index + 1) * 10,
  is_active: 1
}));

function getCategoryLabel(category, lang) {
  const meta = CATEGORY_META[category] || CATEGORY_META.salutations;
  return meta[lang] || meta.fr;
}

export default function PhrasesModuleView({ currentLang, kioskConfig }) {
  const [phrases, setPhrases] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('all');
  const [playingId, setPlayingId] = useState(null);
  const audioRef = useRef(null);

  const t = translations[currentLang] || translations.fr;
  const activeCity = kioskConfig?.active_city || 'Madagascar';

  const subtitle =
    currentLang === 'mg'
      ? `Fomba fiteny ilaina amin'ny fifandraisana eto ${activeCity}`
      : currentLang === 'en'
      ? `Essential expressions and polite phrases to connect with the people of ${activeCity}`
      : `Expressions et formules de politesse indispensables pour échanger avec les habitants de ${activeCity}`;

  useEffect(() => {
    let cancelled = false;

    api.getPhrases().then((data) => {
      if (cancelled) return;
      setPhrases(Array.isArray(data) ? data : fallbackPhrases);
      setIsLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

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
      setTimeout(() => {
        try {
          ctx.close();
        } catch {}
      }, 600);
    } catch (err) {
      console.warn('Web Audio chime not available:', err);
    }
  };

  const stopPlayback = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setPlayingId(null);
  };

  // Repli si aucun fichier audio MMS n'est disponible pour la phrase.
  // On privilégie une voix malgache si le navigateur en propose une.
  const speakFallback = (phrase) => {
    if (!('speechSynthesis' in window)) {
      setTimeout(() => setPlayingId(null), 1200);
      return;
    }

    try {
      window.speechSynthesis.cancel();
      const text = phrase.text_mg || phrase.mg || '';
      const utterance = new SpeechSynthesisUtterance(text);
      const voices = window.speechSynthesis.getVoices();
      const malagasyVoice = voices.find((voice) => voice.lang?.toLowerCase().startsWith('mg'));
      const frenchVoice = voices.find((voice) => voice.lang?.toLowerCase().startsWith('fr'));

      if (malagasyVoice) {
        utterance.voice = malagasyVoice;
        utterance.lang = malagasyVoice.lang;
      } else {
        utterance.lang = 'fr-FR';
        if (frenchVoice) utterance.voice = frenchVoice;
      }

      utterance.rate = 0.82;
      utterance.pitch = 1.02;
      utterance.onend = () => setPlayingId(null);
      utterance.onerror = () => setPlayingId(null);
      window.speechSynthesis.speak(utterance);

      // Sécurité si le moteur vocal du navigateur ne déclenche pas "onend".
      setTimeout(() => {
        setPlayingId((current) => (current === phrase.id ? null : current));
      }, Math.max(4000, text.length * 140));
    } catch (err) {
      console.warn('Speech synthesis error:', err);
      setTimeout(() => setPlayingId(null), 1200);
    }
  };

  const playPhrase = (phrase) => {
    stopPlayback();
    playChime();
    setPlayingId(phrase.id);

    const storedAudio = phrase.audio_url || phrase.audio_key;
    if (storedAudio) {
      const audio = new Audio(resolveMediaUrl(storedAudio));
      audioRef.current = audio;
      let fallbackStarted = false;
      const useFallback = () => {
        if (fallbackStarted) return;
        fallbackStarted = true;
        audioRef.current = null;
        speakFallback(phrase);
      };
      audio.onended = () => setPlayingId(null);
      audio.onerror = useFallback;
      audio.play().catch(useFallback);
      return;
    }

    speakFallback(phrase);
  };

  const availableCategories = Object.keys(CATEGORY_META).filter((category) =>
    phrases.some((phrase) => phrase.category === category)
  );

  const visiblePhrases =
    activeCategory === 'all'
      ? phrases
      : phrases.filter((phrase) => phrase.category === activeCategory);

  return (
    <div className="flex-1 w-full bg-slate-950 p-6 md:p-8 pb-24 md:pb-28 flex flex-col overflow-y-auto">
      <div className="max-w-6xl mx-auto w-full">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black text-white flex items-center space-x-3">
              <Languages className="w-8 h-8 text-purple-400" />
              <span>{t.modules.phrases.title}</span>
            </h1>
            <p className="text-slate-400 text-sm mt-1">{subtitle}</p>
          </div>

          <div className="hidden md:flex items-center space-x-2 bg-purple-950/60 border border-purple-500/30 px-4 py-2 rounded-2xl text-purple-300 text-xs">
            <Volume2 className="w-4 h-4 text-purple-400" />
            <span>Appuyez sur le haut-parleur pour écouter la prononciation</span>
          </div>
        </div>

        {/* Filtres par catégorie */}
        <div className="flex flex-wrap items-center gap-2 mb-5">
          <button
            onClick={() => setActiveCategory('all')}
            className={`px-4 py-2 rounded-xl text-xs font-bold border transition ${
              activeCategory === 'all'
                ? 'bg-purple-600 border-purple-400 text-white'
                : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-purple-500/50'
            }`}
          >
            {t.all} ({phrases.length})
          </button>
          {availableCategories.map((category) => {
            const meta = CATEGORY_META[category];
            const count = phrases.filter((phrase) => phrase.category === category).length;
            return (
              <button
                key={category}
                onClick={() => setActiveCategory(category)}
                className={`px-4 py-2 rounded-xl text-xs font-bold border transition flex items-center space-x-1.5 ${
                  activeCategory === category
                    ? 'bg-purple-600 border-purple-400 text-white'
                    : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-purple-500/50'
                }`}
              >
                <span>{meta.emoji}</span>
                <span>{getCategoryLabel(category, currentLang)}</span>
                <span className="text-[10px] opacity-70">({count})</span>
              </button>
            );
          })}
        </div>

        {isLoading && (
          <div className="text-center text-slate-400 text-sm py-10">Chargement des phrases...</div>
        )}

        {!isLoading && visiblePhrases.length === 0 && (
          <div className="bg-slate-900 border-2 border-slate-800 rounded-3xl p-10 text-center text-slate-400 text-sm">
            {t.noResults}
          </div>
        )}

        {/* Cartes de phrases trilingues */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {visiblePhrases.map((phrase) => {
            const isPlaying = playingId === phrase.id;
            const hasAudio = Boolean(phrase.audio_url || phrase.audio_key);
            const meta = CATEGORY_META[phrase.category] || CATEGORY_META.salutations;

            return (
              <div
                key={phrase.id}
                className="bg-slate-900 border-2 border-slate-800 hover:border-purple-500/50 rounded-3xl p-6 shadow-xl flex flex-col justify-between transition-colors"
              >
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-black uppercase tracking-wider text-purple-300 bg-purple-950/60 border border-purple-500/30 px-3 py-1 rounded-full">
                        {meta.emoji} {getCategoryLabel(phrase.category, currentLang)}
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2.5 py-1 rounded-full">
                        🇲🇬 Malagasy
                      </span>
                    </div>

                    {/* Big Touch-Friendly Audio Button */}
                    <button
                      onClick={() => (isPlaying ? stopPlayback() : playPhrase(phrase))}
                      className={`flex items-center space-x-2 px-4 py-2.5 rounded-2xl font-bold text-xs uppercase tracking-wider transition-all active:scale-95 shadow flex-shrink-0 ${
                        isPlaying
                          ? 'bg-amber-400 text-slate-950 animate-pulse'
                          : 'bg-purple-600 hover:bg-purple-500 text-white'
                      }`}
                      title="Écouter la prononciation"
                    >
                      <Volume2 className={`w-5 h-5 ${isPlaying ? 'animate-bounce' : ''}`} />
                      <span>{isPlaying ? 'En lecture...' : 'Écouter'}</span>
                    </button>
                  </div>

                  <div className="text-2xl font-black text-white mt-3">
                    {phrase.text_mg || phrase.mg}
                  </div>

                  {phrase.pronunciation && (
                    <div className="text-xs font-medium text-amber-300/90 mt-1 italic">
                      Prononciation : <span className="font-mono font-semibold">{phrase.pronunciation}</span>
                    </div>
                  )}

                  <div className="text-[10px] text-slate-500 mt-1.5 font-semibold uppercase tracking-wide">
                    {hasAudio ? '🔊 Audio MMS malgache disponible' : '🔈 Synthèse vocale du navigateur'}
                  </div>
                </div>

                {/* French & English translations */}
                {(phrase.text_fr || phrase.text_en) && (
                  <div className="mt-5 pt-4 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    {phrase.text_fr && (
                      <div className="bg-slate-950/50 p-3 rounded-xl border border-slate-800/80">
                        <div className="text-xs font-bold text-slate-400 mb-0.5">🇫🇷 Français</div>
                        <div className="font-semibold text-slate-200">{phrase.text_fr}</div>
                      </div>
                    )}

                    {phrase.text_en && (
                      <div className="bg-slate-950/50 p-3 rounded-xl border border-slate-800/80">
                        <div className="text-xs font-bold text-slate-400 mb-0.5">🇬🇧 English</div>
                        <div className="font-semibold text-slate-200">{phrase.text_en}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

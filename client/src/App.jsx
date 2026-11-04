import React, { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import InactivityWarningModal from './components/InactivityWarningModal';
import CameraDebugHud from './components/CameraDebugHud';
import ScreensaverView from './views/screensaver/ScreensaverView';
import LanguageSelectView from './views/language/LanguageSelectView';
import MainMenuView from './views/menu/MainMenuView';
import MapModuleView from './views/map/MapModuleView';
import PlacesModuleView from './views/places/PlacesModuleView';
import WeatherModuleView from './views/weather/WeatherModuleView';
import PhrasesModuleView from './views/phrases/PhrasesModuleView';
import EmergencyModuleView from './views/emergency/EmergencyModuleView';
import ConverterModuleView from './views/converter/ConverterModuleView';
import BackOfficeModal from './views/admin/BackOfficeModal';

import { usePresenceCamera } from './hooks/usePresenceCamera';
import { useInactivityTimer } from './hooks/useInactivityTimer';
import { analytics } from './services/analytics';
import { api } from './services/api';
import { Video, Megaphone, Camera, Sun, Moon } from 'lucide-react';

export default function App() {
  // Screens: 'SCREENSAVER' | 'LANG_SELECT' | 'MAIN_MENU' | 'MAP' | 'PLACES' | 'WEATHER_EVENTS' | 'PHRASES' | 'EMERGENCY' | 'CONVERTER'
  const [currentScreen, setCurrentScreen] = useState('SCREENSAVER');
  const [currentLang, setCurrentLang] = useState('fr');
  const [isBackOfficeOpen, setIsBackOfficeOpen] = useState(false);
  const [isCameraHudOpen, setIsCameraHudOpen] = useState(false);
  const [adsList, setAdsList] = useState([]);
  const [kioskConfig, setKioskConfig] = useState({
    active_city: 'Fianarantsoa',
    active_region: 'Haute Matsiatra',
    active_lat: -21.4536,
    active_lng: 47.0858,
    active_country: 'Madagascar'
  });
  
  // Manual simulation state fallback
  const [isSimulatedPresence, setIsSimulatedPresence] = useState(false);

  // Light / Dark theme state (persisted)
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem('kiosk_theme') !== 'light';
  });

  const toggleTheme = () => {
    const nextMode = !isDarkMode;
    setIsDarkMode(nextMode);
    localStorage.setItem('kiosk_theme', nextMode ? 'dark' : 'light');
  };

  // Load active advertisements from SQLite backend
  const loadActiveAds = useCallback(async () => {
    try {
      const data = await api.getActiveAds();
      if (data && data.length > 0) {
        setAdsList(data);
      }
    } catch (e) {
      console.warn('Backend ads offline', e);
    }
  }, []);

  // Load current active kiosk city configuration
  const loadKioskConfig = useCallback(async () => {
    try {
      const data = await api.getKioskConfig();
      if (data && data.config) {
        setKioskConfig(data.config);
      }
    } catch (e) {
      console.warn('Backend config offline', e);
    }
  }, []);

  useEffect(() => {
    loadActiveAds();
    loadKioskConfig();
  }, [loadActiveAds, loadKioskConfig]);

  // Return to screensaver and finalize analytics
  const handleReturnToScreensaver = useCallback(() => {
    analytics.endSession();
    setCurrentScreen('SCREENSAVER');
  }, []);

  // Action: Wake up screen from screensaver
  const handleWakeUp = useCallback(() => {
    setCurrentScreen((prev) => (prev === 'SCREENSAVER' ? 'LANG_SELECT' : prev));
  }, []);

  // 1. Computer Vision: MediaPipe Presence Detection Hook
  const { cameraStatus, errorMessage, detectionInfo, videoElement } = usePresenceCamera({
    distanceThresholdMeters: 2.0, // Face proximity threshold ~2m
    confirmationDelayMs: 1000,     // 1.0s confirmation delay anti-passersby
    absenceDelayMs: 5000,          // 5s absence trigger
    onPersonConfirmed: () => {
      // Automatic wake-up when visitor is detected at <= 2m for >= 1s
      handleWakeUp();
    },
    onPersonLeft: () => {
      // Visitor left the kiosk
    },
    isActive: true
  });

  // 2. Inactivity Timer (30s with warning modal at 5s remaining)
  const isSessionActive = currentScreen !== 'SCREENSAVER' && currentScreen !== 'LANG_SELECT';
  const { secondsRemaining, isWarningVisible, resetTimer } = useInactivityTimer({
    active: isSessionActive,
    totalTimeoutSeconds: 30,
    warningSeconds: 5,
    onTimeout: handleReturnToScreensaver
  });

  // Action: Select language
  const handleSelectLanguage = (lang) => {
    setCurrentLang(lang);
    analytics.startSession(lang);
    setCurrentScreen('MAIN_MENU');
  };

  // Action: Select module from menu
  const handleSelectModule = (moduleId) => {
    analytics.logInteraction(moduleId);
    setCurrentScreen(moduleId);
  };

  // Action: Click inside a module
  const handleLogItemClick = (type, itemId) => {
    analytics.logInteraction(type, itemId);
  };

  // Switch language directly from header
  const handleHeaderChangeLang = () => {
    const nextLang = currentLang === 'fr' ? 'en' : currentLang === 'en' ? 'mg' : 'fr';
    setCurrentLang(nextLang);
  };

  // Combined presence status (Live camera OR manual simulation)
  const isPersonPresent = detectionInfo.isWithinRange || isSimulatedPresence;

  return (
    <div className={`relative w-screen h-screen bg-slate-950 text-white flex flex-col overflow-hidden select-none font-sans ${isDarkMode ? '' : 'light-mode'}`}>
      {/* 1. SCREENSAVER (Mode Veille Publicitaire) */}
      {currentScreen === 'SCREENSAVER' && (
        <ScreensaverView
          onWakeUp={handleWakeUp}
          isPersonDetected={isPersonPresent}
          adsList={adsList}
          kioskConfig={kioskConfig}
        />
      )}

      {/* 2. CHOIX DE LANGUE (3 Grands Drapeaux HD) */}
      {currentScreen === 'LANG_SELECT' && (
        <LanguageSelectView
          onSelectLanguage={handleSelectLanguage}
          onBackToScreensaver={handleReturnToScreensaver}
          kioskConfig={kioskConfig}
        />
      )}

      {/* 3. VUES DE SESSION ACTIVE (Header + Contenu avec padding bas anti-chevauchement) */}
      {isSessionActive && (
        <>
          <Header
            currentScreen={currentScreen}
            currentLang={currentLang}
            onBack={() => setCurrentScreen('MAIN_MENU')}
            onHome={() => setCurrentScreen('MAIN_MENU')}
            onChangeLang={handleHeaderChangeLang}
            kioskConfig={kioskConfig}
          />

          <main className="flex-1 flex flex-col overflow-hidden relative">
            {currentScreen === 'MAIN_MENU' && (
              <MainMenuView
                currentLang={currentLang}
                onSelectModule={handleSelectModule}
                kioskConfig={kioskConfig}
              />
            )}
            {currentScreen === 'MAP' && (
              <MapModuleView
                currentLang={currentLang}
                onLogItemClick={handleLogItemClick}
                kioskConfig={kioskConfig}
              />
            )}
            {currentScreen === 'PLACES' && (
              <PlacesModuleView
                currentLang={currentLang}
                kioskConfig={kioskConfig}
              />
            )}
            {currentScreen === 'WEATHER_EVENTS' && (
              <WeatherModuleView
                currentLang={currentLang}
                kioskConfig={kioskConfig}
              />
            )}
            {currentScreen === 'PHRASES' && (
              <PhrasesModuleView
                currentLang={currentLang}
                kioskConfig={kioskConfig}
              />
            )}
            {currentScreen === 'EMERGENCY' && (
              <EmergencyModuleView
                currentLang={currentLang}
                kioskConfig={kioskConfig}
              />
            )}
            {currentScreen === 'CONVERTER' && (
              <ConverterModuleView
                currentLang={currentLang}
                onLogItemClick={handleLogItemClick}
                kioskConfig={kioskConfig}
              />
            )}
          </main>
        </>
      )}

      {/* MODAL ALERTE INACTIVITÉ (5 secondes avant mise en veille) */}
      {isWarningVisible && (
        <InactivityWarningModal
          secondsRemaining={secondsRemaining}
          onStillHere={resetTimer}
          currentLang={currentLang}
        />
      )}

      {/* MONITEUR DE VISION IA CAMÉRAPE (Affiché juste au-dessus de la barre d'outils) */}
      <CameraDebugHud
        isOpen={isCameraHudOpen}
        onClose={() => setIsCameraHudOpen(false)}
        detectionInfo={detectionInfo}
        cameraStatus={cameraStatus}
        errorMessage={errorMessage}
        videoElement={videoElement}
      />

      {/* BARRE D'OUTILS TEST & ADMINISTRATION EN BAS À DROITE (Ergonomique & Débarrassée du haut) */}
      <div className="fixed bottom-3 right-3 z-40 flex items-center space-x-2 bg-slate-900/90 backdrop-blur-md border border-slate-700/80 rounded-full px-3 py-1.5 shadow-2xl text-xs">
        {/* Bouton pour afficher ce que voit la caméra (Moniteur IA) */}
        <button
          onClick={() => setIsCameraHudOpen(!isCameraHudOpen)}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-full font-bold transition shadow-sm ${
            isCameraHudOpen
              ? 'bg-blue-600 text-white border border-blue-400'
              : 'bg-slate-800 text-slate-300 hover:text-white border border-slate-700 hover:border-slate-500'
          }`}
          title="Afficher le flux caméra en direct et les métriques MediaPipe"
        >
          <span
            className={`w-2 h-2 rounded-full flex-shrink-0 ${
              cameraStatus === 'READY'
                ? detectionInfo.isWithinRange
                  ? 'bg-emerald-400 animate-ping'
                  : detectionInfo.faceDetected
                  ? 'bg-amber-400'
                  : 'bg-slate-500'
                : 'bg-rose-400'
            }`}
          />
          <Camera className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Caméra / Vision IA</span>
          <span className="sm:hidden">Caméra</span>
        </button>

        {/* Simulateur de présence caméra */}
        <button
          onClick={() => {
            const next = !isSimulatedPresence;
            setIsSimulatedPresence(next);
            if (next && currentScreen === 'SCREENSAVER') {
              handleWakeUp();
            }
          }}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-full font-bold transition shadow-sm ${
            isSimulatedPresence
              ? 'bg-emerald-500 text-slate-950 font-black'
              : 'bg-slate-800 text-slate-300 hover:text-white border border-slate-700 hover:border-slate-500'
          }`}
          title="Simuler l'approche d'une personne à moins de 2 mètres sans webcam"
        >
          <Video className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{isSimulatedPresence ? 'Simulation : Présent' : 'Simuler présence'}</span>
          <span className="sm:hidden">{isSimulatedPresence ? 'Simulé' : 'Simuler'}</span>
        </button>

        {/* Bouton bascule mode sombre / clair */}
        <button
          onClick={toggleTheme}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-full font-bold transition shadow-sm bg-slate-800 text-slate-300 hover:text-white border border-slate-700 hover:border-slate-500 active:scale-95"
          title={isDarkMode ? 'Passer en mode clair' : 'Passer en mode sombre'}
        >
          {isDarkMode ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-sky-400" />}
          <span className="hidden sm:inline">{isDarkMode ? 'Mode clair' : 'Mode sombre'}</span>
        </button>

        {/* Bouton Back-office / Mode Admin (Ajout pubs & stats) */}
        <button
          onClick={() => setIsBackOfficeOpen(true)}
          className="flex items-center space-x-1.5 px-3.5 py-1.5 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white font-extrabold rounded-full shadow-lg border border-amber-400/40 active:scale-95 transition"
          title="Ouvrir le Back-office (Gestion des publicités, lieux, événements, statistiques)"
        >
          <Megaphone className="w-3.5 h-3.5" />
          <span>Admin / Pubs</span>
        </button>
      </div>

      {/* MODAL BACK-OFFICE WEB (Gestion complète) */}
      <BackOfficeModal
        isOpen={isBackOfficeOpen}
        onClose={() => setIsBackOfficeOpen(false)}
        onAdsUpdated={loadActiveAds}
        onCityChanged={(newConfig) => setKioskConfig(newConfig)}
      />
    </div>
  );
}

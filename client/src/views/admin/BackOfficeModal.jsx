import React, { useState, useEffect } from 'react';
import { 
  X, Lock, Megaphone, BarChart3, Settings, Plus, Trash2, Power, 
  Clock, Globe2, Users, Check, AlertCircle, Upload, Link as LinkIcon, 
  MapPin, Calendar, Handshake, ShieldAlert, Edit, Save, UserPlus, KeyRound,
  Download, Sparkles, Navigation, Compass, Layers, RefreshCw
} from 'lucide-react';
import { api } from '../../services/api';
import { analytics } from '../../services/analytics';
import LocationPickerModal from '../../components/LocationPickerModal';

export default function BackOfficeModal({ isOpen, onClose, onAdsUpdated, onCityChanged }) {
  // Navigation tabs: 'ads' | 'places' | 'events' | 'partners' | 'emergency' | 'config' | 'stats' | 'users'
  const [activeTab, setActiveTab] = useState('ads');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState('');

  // Map Picker State
  const [isMapPickerOpen, setIsMapPickerOpen] = useState(false);
  const [mapPickerTarget, setMapPickerTarget] = useState(null); // 'places' | 'events' | 'partners' | 'emergency'

  // 1. Ads state
  const [ads, setAds] = useState([]);
  const [editingAd, setEditingAd] = useState(null);
  const [isAddingAd, setIsAddingAd] = useState(false);
  const initialAdForm = {
    title_fr: '', title_mg: '', title_en: '',
    subtitle_fr: '', badge: 'À découvrir',
    duration_seconds: 7, mediaMode: 'url',
    media_url: '', mediaFile: null
  };
  const [adForm, setAdForm] = useState(initialAdForm);

  // 2. Places state
  const [places, setPlaces] = useState([]);
  const [isAddingPlace, setIsAddingPlace] = useState(false);
  const [editingPlace, setEditingPlace] = useState(null);
  const initialPlaceForm = {
    name: '', category: 'patrimoine',
    desc_fr: '', desc_mg: '', desc_en: '',
    distance_km: '', travel_time: '', itinerary_steps: '',
    lat: -21.4536, lng: 47.0858, rating: 4.8,
    photo_url: '', photoFile: null, photoMode: 'url'
  };
  const [placeForm, setPlaceForm] = useState(initialPlaceForm);

  // 3. Events state
  const [events, setEvents] = useState([]);
  const [isAddingEvent, setIsAddingEvent] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const todayStr = new Date().toISOString().split('T')[0];
  const initialEventForm = {
    title_fr: '', title_mg: '', title_en: '',
    description_fr: '', location: 'Fianarantsoa',
    event_date: todayStr, event_time: '10h00',
    lat: -21.4536, lng: 47.0858
  };
  const [eventForm, setEventForm] = useState(initialEventForm);

  // 4. Partners state
  const [partners, setPartners] = useState([]);
  const [isAddingPartner, setIsAddingPartner] = useState(false);
  const [editingPartner, setEditingPartner] = useState(null);
  const initialPartnerForm = {
    name: '', type: 'Artisanat', description: '',
    contact: '', address: 'Fianarantsoa', image_url: '',
    lat: -21.4536, lng: 47.0858
  };
  const [partnerForm, setPartnerForm] = useState(initialPartnerForm);

  // 5. Emergency state
  const [emergencyList, setEmergencyList] = useState([]);
  const [isAddingEmergency, setIsAddingEmergency] = useState(false);
  const [editingEmergency, setEditingEmergency] = useState(null);
  const initialEmergencyForm = {
    name: '', number: '', address: 'Fianarantsoa', icon: 'ShieldAlert',
    lat: -21.4536, lng: 47.0858
  };
  const [emergencyForm, setEmergencyForm] = useState(initialEmergencyForm);

  // 6. Users & Profile state
  const [usersList, setUsersList] = useState([]);
  const [profileForm, setProfileForm] = useState({ new_username: '', new_password: '', full_name: '' });
  const [newUserForm, setNewUserForm] = useState({ username: '', password: '', full_name: '' });
  const [profileMsg, setProfileMsg] = useState('');

  // 7. Stats
  const [stats, setStats] = useState(null);

  // 8. OpenStreetMap / Google Automatic Extractor
  const [importCity, setImportCity] = useState('Fianarantsoa');
  const [isImportingOsm, setIsImportingOsm] = useState(false);
  const [importMsg, setImportMsg] = useState('');

  // 9. Kiosk City & Location Switcher
  const [kioskConfigData, setKioskConfigData] = useState(null);
  const [availableCities, setAvailableCities] = useState([]);
  const [citySearchQuery, setCitySearchQuery] = useState('');
  const [citySearchResults, setCitySearchResults] = useState([]);
  const [isSearchingCity, setIsSearchingCity] = useState(false);
  const [isSwitchingCity, setIsSwitchingCity] = useState(false);
  const [switchSuccessMsg, setSwitchSuccessMsg] = useState('');
  const [switchErrorMsg, setSwitchErrorMsg] = useState('');
  const [confirmSwitchTarget, setConfirmSwitchTarget] = useState(null);
  const [cityToDelete, setCityToDelete] = useState(null);
  const [isDeletingCity, setIsDeletingCity] = useState(false);
  const [deleteCityMsg, setDeleteCityMsg] = useState('');
  const [deleteCityError, setDeleteCityError] = useState('');

  const handleDeleteCity = async (target) => {
    if (!target) return;
    const cityName = target.city || target;
    setIsDeletingCity(true);
    setDeleteCityMsg('');
    setDeleteCityError('');
    try {
      const res = await api.deleteCity(cityName);
      setDeleteCityMsg(res.message || `La ville "${cityName}" a été supprimée.`);
      setAvailableCities(res.availableCities || []);
      setCityToDelete(null);
      await loadAllData();
    } catch (err) {
      setDeleteCityError(err.message || 'Erreur lors de la suppression de la ville.');
    } finally {
      setIsDeletingCity(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      if (api.isAuthenticated()) {
        setIsAuthenticated(true);
        loadAllData();
      } else {
        setUsernameInput('');
        setPasswordInput('');
        setAuthError('');
      }
    }
  }, [isOpen]);

  const loadAllData = async () => {
    try {
      const [allAds, allPlaces, allEvents, allPartners, allEmergency, currentStats, users, configRes] = await Promise.all([
        api.getAllAds().catch(() => []),
        api.getPlaces().catch(() => []),
        api.getEvents().catch(() => []),
        api.getPartners().catch(() => []),
        api.getEmergency().catch(() => []),
        api.getSummaryStats().catch(() => null),
        api.getUsers().catch(() => []),
        api.getKioskConfig().catch(() => null)
      ]);
      setAds(allAds || []);
      setPlaces(allPlaces || []);
      setEvents(allEvents || []);
      setPartners(allPartners || []);
      setEmergencyList(allEmergency || []);
      setStats(currentStats);
      setUsersList(users || []);
      if (configRes && configRes.config) {
        setKioskConfigData(configRes.config);
        setAvailableCities(configRes.availableCities || []);
      }
    } catch (err) {
      console.warn('Erreur chargement données admin', err);
    }
  };

  const handleSearchCity = async (e) => {
    if (e) e.preventDefault();
    if (!citySearchQuery.trim()) return;
    setIsSearchingCity(true);
    setSwitchErrorMsg('');
    setSwitchSuccessMsg('');
    setCitySearchResults([]);
    try {
      const res = await api.searchCity(citySearchQuery.trim());
      setCitySearchResults(res.results || []);
      if (!res.results || res.results.length === 0) {
        setSwitchErrorMsg(`Aucun résultat trouvé à Madagascar pour "${citySearchQuery}". Essayez avec un autre nom de ville.`);
      }
    } catch (err) {
      setSwitchErrorMsg(err.message || 'Erreur lors de la recherche.');
    } finally {
      setIsSearchingCity(false);
    }
  };

  const handleExecuteSwitch = async (targetCity) => {
    setIsSwitchingCity(true);
    setSwitchErrorMsg('');
    setSwitchSuccessMsg('');
    try {
      const res = await api.switchKioskCity({
        city: targetCity.city,
        region: targetCity.region || '',
        lat: targetCity.lat,
        lng: targetCity.lng,
        country: 'Madagascar'
      });
      setKioskConfigData(res.config);
      setAvailableCities(res.availableCities || []);
      setSwitchSuccessMsg(res.message || `Le kiosque est désormais configuré pour ${targetCity.city} !`);
      setConfirmSwitchTarget(null);
      await loadAllData();
      if (onCityChanged) {
        onCityChanged(res.config);
      }
    } catch (err) {
      setSwitchErrorMsg(err.message || 'Erreur lors du déplacement du kiosque.');
    } finally {
      setIsSwitchingCity(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      setAuthError('');
      const data = await api.login(usernameInput, passwordInput);
      setIsAuthenticated(true);
      setCurrentUser(data);
      setProfileForm({ new_username: data.username, new_password: '', full_name: data.full_name || '' });
      await loadAllData();
    } catch (err) {
      setAuthError(err.message || 'Identifiants invalides');
    }
  };

  const handleLogout = () => {
    api.logout();
    setIsAuthenticated(false);
    setUsernameInput('');
    setPasswordInput('');
    setAuthError('');
  };

  // --- MAP PICKER HANDLERS ---
  const handleOpenMapPicker = (target) => {
    setMapPickerTarget(target);
    setIsMapPickerOpen(true);
  };

  const handleCoordsPicked = (lat, lng) => {
    if (mapPickerTarget === 'places') {
      setPlaceForm((prev) => ({ ...prev, lat, lng }));
    } else if (mapPickerTarget === 'events') {
      setEventForm((prev) => ({ ...prev, lat, lng }));
    } else if (mapPickerTarget === 'partners') {
      setPartnerForm((prev) => ({ ...prev, lat, lng }));
    } else if (mapPickerTarget === 'emergency') {
      setEmergencyForm((prev) => ({ ...prev, lat, lng }));
    }
  };

  // --- ADS ACTIONS ---
  const handleOpenAddAd = () => {
    setEditingAd(null);
    setAdForm({ ...initialAdForm });
    setIsAddingAd(true);
  };

  const handleSaveAd = async (e) => {
    e.preventDefault();
    try {
      const formData = new FormData();
      formData.append('title_fr', adForm.title_fr);
      formData.append('title_mg', adForm.title_mg || adForm.title_fr);
      formData.append('title_en', adForm.title_en || adForm.title_fr);
      formData.append('subtitle_fr', adForm.subtitle_fr || '');
      formData.append('badge', adForm.badge || 'Partenaire');
      formData.append('duration_seconds', adForm.duration_seconds || 7);

      if (adForm.mediaMode === 'file' && adForm.mediaFile) {
        formData.append('mediaFile', adForm.mediaFile);
      } else {
        formData.append('media_url', adForm.media_url);
      }

      if (editingAd) {
        await api.updateAd(editingAd.id, formData);
      } else {
        await api.addAd(formData);
      }

      setIsAddingAd(false);
      setEditingAd(null);
      setAdForm({ ...initialAdForm });
      const updatedAds = await api.getAllAds();
      setAds(updatedAds);
      if (onAdsUpdated) onAdsUpdated();
    } catch (err) {
      alert('Erreur enregistrement publicité : ' + err.message);
    }
  };

  const handleToggleAd = async (id) => {
    await api.toggleAd(id);
    const updated = await api.getAllAds();
    setAds(updated);
    if (onAdsUpdated) onAdsUpdated();
  };

  const handleDeleteAd = async (id) => {
    if (confirm('Supprimer cette publicité ?')) {
      await api.deleteAd(id);
      const updated = await api.getAllAds();
      setAds(updated);
      if (onAdsUpdated) onAdsUpdated();
    }
  };

  // --- PLACES ACTIONS ---
  const handleOpenAddPlace = () => {
    setEditingPlace(null);
    // Deep copy pour éviter toute référence partagée avec le dernier état édité
    setPlaceForm({
      name: '', category: 'patrimoine',
      desc_fr: '', desc_mg: '', desc_en: '',
      distance_km: '', travel_time: '', itinerary_steps: '',
      lat: -21.4536, lng: 47.0858, rating: 4.8,
      photo_url: '', photoFile: null, photoMode: 'url'
    });
    setIsAddingPlace(true);
  };

  const handleEditPlace = (place) => {
    setEditingPlace(place);
    setPlaceForm({
      name: place.name,
      category: place.category || 'patrimoine',
      desc_fr: place.desc_fr || '',
      desc_mg: place.desc_mg || '',
      desc_en: place.desc_en || '',
      distance_km: place.distance_km || '',
      travel_time: place.travel_time || '',
      itinerary_steps: place.itinerary_steps || '',
      lat: place.lat || -21.4536,
      lng: place.lng || 47.0858,
      rating: place.rating || 4.8,
      photo_url: place.photo_url || '',
      photoFile: null,
      photoMode: 'url'
    });
    setIsAddingPlace(true);
  };

  const handleSavePlace = async (e) => {
    e.preventDefault();
    try {
      const formData = new FormData();
      formData.append('name', placeForm.name);
      formData.append('category', placeForm.category);
      formData.append('desc_fr', placeForm.desc_fr);
      formData.append('desc_mg', placeForm.desc_mg || placeForm.desc_fr);
      formData.append('desc_en', placeForm.desc_en || placeForm.desc_fr);
      formData.append('distance_km', placeForm.distance_km);
      formData.append('travel_time', placeForm.travel_time);
      formData.append('itinerary_steps', placeForm.itinerary_steps);
      formData.append('lat', placeForm.lat);
      formData.append('lng', placeForm.lng);
      formData.append('rating', placeForm.rating);
      formData.append('city', kioskConfigData?.active_city || 'Fianarantsoa');

      if (placeForm.photoMode === 'file' && placeForm.photoFile) {
        formData.append('photoFile', placeForm.photoFile);
      } else {
        formData.append('photo_url', placeForm.photo_url);
      }

      if (editingPlace) {
        await api.updatePlace(editingPlace.id, formData);
      } else {
        await api.addPlace(formData);
      }

      setIsAddingPlace(false);
      setEditingPlace(null);
      setPlaceForm({ ...initialPlaceForm });
      const updated = await api.getPlaces();
      setPlaces(updated);
    } catch (err) {
      alert('Erreur lieu : ' + err.message);
    }
  };

  const handleDeletePlace = async (id) => {
    if (confirm('Supprimer ce lieu touristique ?')) {
      await api.deletePlace(id);
      const updated = await api.getPlaces();
      setPlaces(updated);
    }
  };

  const handleImportOsm = async () => {
    if (!importCity.trim()) return;
    setIsImportingOsm(true);
    setImportMsg('');
    try {
      const res = await api.importOsmPlaces(importCity.trim());
      setImportMsg(res.message || `${res.importedCount} établissements importés avec succès !`);
      const updated = await api.getPlaces();
      setPlaces(updated || []);
    } catch (err) {
      setImportMsg('Erreur lors de l’importation : ' + err.message);
    } finally {
      setIsImportingOsm(false);
    }
  };

  // --- EVENTS ACTIONS ---
  const handleOpenAddEvent = () => {
    setEditingEvent(null);
    setEventForm({
      title_fr: '', title_mg: '', title_en: '',
      description_fr: '', location: 'Fianarantsoa',
      event_date: todayStr, event_time: '10h00',
      lat: -21.4536, lng: 47.0858
    });
    setIsAddingEvent(true);
  };

  const handleEditEvent = (evt) => {
    setEditingEvent(evt);
    setEventForm({
      title_fr: evt.title_fr,
      title_mg: evt.title_mg || '',
      title_en: evt.title_en || '',
      description_fr: evt.description_fr || '',
      location: evt.location,
      event_date: evt.event_date,
      event_time: evt.event_time || '10h00',
      lat: evt.lat || -21.4536,
      lng: evt.lng || 47.0858
    });
    setIsAddingEvent(true);
  };

  const handleSaveEvent = async (e) => {
    e.preventDefault();
    if (eventForm.event_date < todayStr) {
      alert("Impossible de planifier un événement à une date déjà passée.");
      return;
    }
    try {
      const payload = { ...eventForm, city: kioskConfigData?.active_city || 'Fianarantsoa' };
      if (editingEvent) {
        await api.updateEvent(editingEvent.id, payload);
      } else {
        await api.addEvent(payload);
      }
      setIsAddingEvent(false);
      setEditingEvent(null);
      setEventForm({ ...initialEventForm });
      const updated = await api.getEvents();
      setEvents(updated);
    } catch (err) {
      alert('Erreur événement : ' + err.message);
    }
  };

  const handleDeleteEvent = async (id) => {
    if (confirm('Supprimer cet événement ?')) {
      await api.deleteEvent(id);
      const updated = await api.getEvents();
      setEvents(updated);
    }
  };

  // --- PARTNERS ACTIONS ---
  const handleOpenAddPartner = () => {
    setEditingPartner(null);
    setPartnerForm({
      name: '', type: 'Artisanat', description: '',
      contact: '', address: 'Fianarantsoa', image_url: '',
      lat: -21.4536, lng: 47.0858
    });
    setIsAddingPartner(true);
  };

  const handleEditPartner = (p) => {
    setEditingPartner(p);
    setPartnerForm({
      name: p.name,
      type: p.type,
      description: p.description || '',
      contact: p.contact || '',
      address: p.address || 'Fianarantsoa',
      image_url: p.image_url || '',
      lat: p.lat || -21.4536,
      lng: p.lng || 47.0858
    });
    setIsAddingPartner(true);
  };

  const handleSavePartner = async (e) => {
    e.preventDefault();
    try {
      const formData = new FormData();
      formData.append('name', partnerForm.name);
      formData.append('type', partnerForm.type);
      formData.append('description', partnerForm.description);
      formData.append('contact', partnerForm.contact);
      formData.append('address', partnerForm.address);
      formData.append('image_url', partnerForm.image_url);
      formData.append('lat', partnerForm.lat);
      formData.append('lng', partnerForm.lng);
      formData.append('city', kioskConfigData?.active_city || 'Fianarantsoa');

      if (editingPartner) {
        await api.updatePartner(editingPartner.id, formData);
      } else {
        await api.addPartner(formData);
      }
      setIsAddingPartner(false);
      setEditingPartner(null);
      setPartnerForm({ ...initialPartnerForm });
      const updated = await api.getPartners();
      setPartners(updated);
    } catch (err) {
      alert('Erreur partenaire : ' + err.message);
    }
  };

  const handleDeletePartner = async (id) => {
    if (confirm('Supprimer ce partenaire ?')) {
      await api.deletePartner(id);
      const updated = await api.getPartners();
      setPartners(updated);
    }
  };

  // --- EMERGENCY ACTIONS ---
  const handleOpenAddEmergency = () => {
    setEditingEmergency(null);
    setEmergencyForm({
      name: '', number: '', address: 'Fianarantsoa', icon: 'ShieldAlert',
      lat: -21.4536, lng: 47.0858
    });
    setIsAddingEmergency(true);
  };

  const handleEditEmergency = (item) => {
    setEditingEmergency(item);
    setEmergencyForm({
      name: item.name,
      number: item.number,
      address: item.address || '',
      icon: item.icon || 'ShieldAlert',
      lat: item.lat || -21.4536,
      lng: item.lng || 47.0858
    });
    setIsAddingEmergency(true);
  };

  const handleSaveEmergency = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...emergencyForm, city: kioskConfigData?.active_city || 'Fianarantsoa' };
      if (editingEmergency) {
        await api.updateEmergency(editingEmergency.id, payload);
      } else {
        await api.addEmergency(payload);
      }
      setIsAddingEmergency(false);
      setEditingEmergency(null);
      setEmergencyForm({ ...initialEmergencyForm });
      const updated = await api.getEmergency();
      setEmergencyList(updated);
    } catch (err) {
      alert('Erreur contact urgence : ' + err.message);
    }
  };

  const handleDeleteEmergency = async (id) => {
    if (confirm('Supprimer ce numéro d\'urgence ?')) {
      await api.deleteEmergency(id);
      const updated = await api.getEmergency();
      setEmergencyList(updated);
    }
  };

  // --- USERS ACTIONS ---
  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    try {
      setProfileMsg('');
      const res = await api.updateProfile(profileForm);
      setProfileMsg('Profil mis à jour avec succès !');
      setCurrentUser(res);
      const users = await api.getUsers();
      setUsersList(users);
    } catch (err) {
      alert('Erreur : ' + err.message);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      await api.createUser(newUserForm);
      alert(`Compte administrateur "${newUserForm.username}" créé avec succès.`);
      setNewUserForm({ username: '', password: '', full_name: '' });
      const users = await api.getUsers();
      setUsersList(users);
    } catch (err) {
      alert('Erreur : ' + err.message);
    }
  };

  const handleDeleteUser = async (u) => {
    if (confirm(`Supprimer le compte administrateur "${u}" ?`)) {
      try {
        await api.deleteUser(u);
        const users = await api.getUsers();
        setUsersList(users);
      } catch (err) {
        alert(err.message);
      }
    }
  };

  // Export Stats as JSON
  const handleExportStats = () => {
    if (!stats) return;
    const blob = new Blob([JSON.stringify(stats, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kiosk_stats_${kioskConfigData?.active_city?.toLowerCase() || 'ville'}_${todayStr}.json`;
    a.click();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 md:p-6 select-none">
      <div className="bg-slate-900 border-2 border-slate-700 rounded-3xl w-full max-w-6xl h-[92vh] flex flex-col text-white shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-950 border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-amber-500/20 text-amber-400 rounded-2xl border border-amber-400/30">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-black">Back-Office Kiosque • {kioskConfigData?.active_city || 'Madagascar'}</h2>
              <p className="text-xs text-slate-400">Gestion intégrale des contenus, itinéraires, événements et comptes</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-full bg-slate-800 hover:bg-slate-700 transition"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Not Authenticated */}
        {!isAuthenticated ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
            <div className="w-16 h-16 rounded-3xl bg-amber-500/20 text-amber-400 flex items-center justify-center mb-4 border border-amber-400/30">
              <Lock className="w-8 h-8" />
            </div>
            <h3 className="text-2xl font-black">Connexion Administrateur</h3>
            <p className="text-slate-400 text-sm max-w-sm mt-1">
              Connectez-vous pour ajouter des publicités, modifier les itinéraires, les événements et gérer les comptes.
            </p>

            <form onSubmit={handleLogin} className="mt-6 w-full max-w-xs space-y-3" autoComplete="off">
              <input
                type="text"
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                placeholder="Nom d'utilisateur"
                autoComplete="off"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-amber-400"
              />
              <input
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="Mot de passe"
                autoComplete="new-password"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-amber-400"
              />
              {authError && <div className="text-rose-400 text-xs font-semibold">{authError}</div>}
              <button
                type="submit"
                className="w-full py-3.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-sm uppercase tracking-wider active:scale-95 transition"
              >
                Se connecter
              </button>
            </form>
          </div>
        ) : (
          /* Logged In Dashboard with Full Navigation Tabs */
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Nav Tabs */}
            <div className="flex items-center space-x-1 px-6 pt-2 bg-slate-950/80 border-b border-slate-800 overflow-x-auto scrollbar-none">
              {[
                { id: 'ads', label: 'Publicités Veille', icon: Megaphone, count: ads.length },
                { id: 'places', label: 'Carte & Établissements', icon: MapPin, count: places.length },
                { id: 'events', label: 'Événements & Météo', icon: Calendar, count: events.length },
                { id: 'partners', label: 'Partenaires Terroir', icon: Handshake, count: partners.length },
                { id: 'emergency', label: 'Urgences & Infos', icon: ShieldAlert, count: emergencyList.length },
                { id: 'config', label: 'Emplacement & Ville', icon: Compass, count: availableCities.length },
                { id: 'stats', label: 'Statistiques Avancées', icon: BarChart3 },
                { id: 'users', label: 'Comptes Admin', icon: Users, count: usersList.length }
              ].map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center space-x-2 px-4 py-3 font-bold text-xs rounded-t-2xl border-t-2 whitespace-nowrap transition ${
                      activeTab === tab.id
                        ? 'bg-slate-900 text-amber-400 border-amber-400'
                        : 'text-slate-400 hover:text-white border-transparent'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{tab.label}</span>
                    {tab.count !== undefined && (
                      <span className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded-full text-slate-300">
                        {tab.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* TAB CONTENT CONTAINER */}
            <div className="flex-1 p-6 overflow-y-auto">
              {/* 1. PUBLICITÉS TAB */}
              {activeTab === 'ads' && (
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-xl font-black">Gestion des Publicités du Mode Veille</h3>
                      <p className="text-xs text-slate-400">
                        Ajoutez, modifiez ou téléversez des images et vidéos qui défilent en plein écran pendant la veille.
                      </p>
                    </div>
                    {isAddingAd ? (
                      <button
                        onClick={() => setIsAddingAd(false)}
                        className="flex items-center space-x-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs uppercase"
                      >
                        <X className="w-4 h-4 text-rose-400" />
                        <span>Fermer le formulaire</span>
                      </button>
                    ) : (
                      <button
                        onClick={handleOpenAddAd}
                        className="flex items-center space-x-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs uppercase"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Ajouter une publicité</span>
                      </button>
                    )}
                  </div>

                  {isAddingAd && (
                    <form onSubmit={handleSaveAd} className="bg-slate-950 border-2 border-amber-500/50 rounded-2xl p-6 mb-6 shadow-xl">
                      <h4 className="font-bold text-amber-400 mb-4">{editingAd ? 'Modifier la publicité' : 'Nouvelle Publicité'}</h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div>
                          <label className="text-xs text-slate-400 font-bold block mb-1">Titre Français *</label>
                          <input
                            type="text"
                            required
                            value={adForm.title_fr}
                            onChange={(e) => setAdForm({ ...adForm, title_fr: e.target.value })}
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-slate-400 font-bold block mb-1">Titre Malagasy</label>
                          <input
                            type="text"
                            value={adForm.title_mg}
                            onChange={(e) => setAdForm({ ...adForm, title_mg: e.target.value })}
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-slate-400 font-bold block mb-1">Titre Anglais</label>
                          <input
                            type="text"
                            value={adForm.title_en}
                            onChange={(e) => setAdForm({ ...adForm, title_en: e.target.value })}
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div>
                          <label className="text-xs text-slate-400 font-bold block mb-1">Sous-titre / Slogan</label>
                          <input
                            type="text"
                            value={adForm.subtitle_fr}
                            onChange={(e) => setAdForm({ ...adForm, subtitle_fr: e.target.value })}
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-slate-400 font-bold block mb-1">Badge</label>
                          <input
                            type="text"
                            value={adForm.badge}
                            onChange={(e) => setAdForm({ ...adForm, badge: e.target.value })}
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-slate-400 font-bold block mb-1">Durée (secondes)</label>
                          <input
                            type="number"
                            min="3"
                            max="30"
                            value={adForm.duration_seconds}
                            onChange={(e) => setAdForm({ ...adForm, duration_seconds: e.target.value })}
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
                          />
                        </div>
                      </div>

                      <div className="bg-slate-900 p-4 rounded-xl mb-4 border border-slate-800">
                        <div className="flex space-x-4 mb-3">
                          <label className="flex items-center space-x-1 text-xs cursor-pointer">
                            <input
                              type="radio"
                              name="mediaMode"
                              checked={adForm.mediaMode === 'url'}
                              onChange={() => setAdForm({ ...adForm, mediaMode: 'url' })}
                            />
                            <span>URL d'image ou vidéo</span>
                          </label>
                          <label className="flex items-center space-x-1 text-xs cursor-pointer">
                            <input
                              type="radio"
                              name="mediaMode"
                              checked={adForm.mediaMode === 'file'}
                              onChange={() => setAdForm({ ...adForm, mediaMode: 'file' })}
                            />
                            <span>Téléverser depuis le PC</span>
                          </label>
                        </div>
                        {adForm.mediaMode === 'url' ? (
                          <input
                            type="url"
                            value={adForm.media_url}
                            onChange={(e) => setAdForm({ ...adForm, media_url: e.target.value })}
                            placeholder="https://..."
                            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
                          />
                        ) : (
                          <input
                            type="file"
                            accept="image/*,video/mp4"
                            onChange={(e) => setAdForm({ ...adForm, mediaFile: e.target.files[0] })}
                            className="text-xs text-slate-300"
                          />
                        )}
                      </div>

                      <button
                        type="submit"
                        className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl text-xs uppercase"
                      >
                        {editingAd ? 'Mettre à jour la publicité' : 'Enregistrer la publicité'}
                      </button>
                    </form>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {ads.map((ad) => (
                      <div
                        key={ad.id}
                        className={`bg-slate-950 border-2 rounded-2xl p-4 flex flex-col justify-between ${
                          ad.is_active === 1 ? 'border-slate-800' : 'border-slate-800/40 opacity-60'
                        }`}
                      >
                        <div className="flex space-x-4">
                          <img
                            src={ad.media_url}
                            alt={ad.title_fr}
                            className="w-28 h-24 object-cover rounded-xl bg-slate-900 border border-slate-800 flex-shrink-0"
                            onError={(e) => {
                              e.target.src = 'https://images.unsplash.com/photo-1547471080-7cc2caa01a7e?w=300';
                            }}
                          />
                          <div className="flex-1">
                            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-amber-400/20 text-amber-300">
                              {ad.badge}
                            </span>
                            <h4 className="text-base font-bold text-white mt-1">{ad.title_fr}</h4>
                            <p className="text-xs text-slate-400">{ad.subtitle_fr}</p>
                            <span className="text-[11px] text-amber-300/80 font-mono mt-1 block">
                              Durée : {ad.duration_seconds}s
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-800 text-xs">
                          <button
                            onClick={() => handleToggleAd(ad.id)}
                            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-bold ${
                              ad.is_active === 1 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            <Power className="w-3.5 h-3.5" />
                            <span>{ad.is_active === 1 ? 'Actif' : 'Masqué'}</span>
                          </button>

                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => {
                                setEditingAd(ad);
                                setAdForm({
                                  title_fr: ad.title_fr,
                                  title_mg: ad.title_mg,
                                  title_en: ad.title_en,
                                  subtitle_fr: ad.subtitle_fr || '',
                                  badge: ad.badge || '',
                                  duration_seconds: ad.duration_seconds || 7,
                                  mediaMode: 'url',
                                  media_url: ad.media_url,
                                  mediaFile: null
                                });
                                setIsAddingAd(true);
                              }}
                              className="text-amber-400 hover:text-amber-300 p-1.5"
                              title="Modifier"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteAd(ad.id)}
                              className="text-rose-400 hover:text-rose-300 p-1.5"
                              title="Supprimer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 2. CARTE & ITINÉRAIRES TAB (With Map Picker & Reset) */}
              {activeTab === 'places' && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-xl font-black">Gestion des Lieux, Hôtels & Restaurants</h3>
                      <p className="text-xs text-slate-400">
                        Ajoutez ou modifiez des sites avec photos, étapes d'itinéraires et sélection GPS sur carte.
                      </p>
                    </div>
                    {isAddingPlace ? (
                      <button
                        onClick={() => {
                          setIsAddingPlace(false);
                          setEditingPlace(null);
                        }}
                        className="flex items-center space-x-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs uppercase"
                      >
                        <X className="w-4 h-4 text-rose-400" />
                        <span>Fermer le formulaire</span>
                      </button>
                    ) : (
                      <button
                        onClick={handleOpenAddPlace}
                        className="flex items-center space-x-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs uppercase"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Ajouter un nouveau lieu</span>
                      </button>
                    )}
                  </div>

                  {/* Extracteur Automatique OpenStreetMap / Google Places */}
                  <div className="bg-gradient-to-r from-blue-950/60 to-slate-900 border border-blue-500/40 rounded-2xl p-4 mb-6 flex flex-col md:flex-row items-center justify-between gap-4 shadow-lg">
                    <div className="flex items-center space-x-3">
                      <div className="p-2.5 bg-blue-500/20 text-blue-400 rounded-xl border border-blue-400/30">
                        <Globe2 className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-white flex items-center space-x-2">
                          <span>Extraction Automatique OpenStreetMap / Google</span>
                          <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-mono border border-emerald-500/30">100% Gratuit</span>
                        </h4>
                        <p className="text-xs text-slate-400">
                          Récupère instantanément tous les hôtels et restaurants répertoriés pour la ville sélectionnée.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 w-full md:w-auto">
                      <input
                        type="text"
                        value={importCity}
                        onChange={(e) => setImportCity(e.target.value)}
                        placeholder="Ex: Fianarantsoa"
                        className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white w-36 focus:outline-none focus:border-blue-400 font-bold"
                      />
                      <button
                        onClick={handleImportOsm}
                        disabled={isImportingOsm}
                        className="flex items-center space-x-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black uppercase whitespace-nowrap active:scale-95 transition disabled:opacity-50"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isImportingOsm ? 'animate-spin' : ''}`} />
                        <span>{isImportingOsm ? 'Extraction...' : 'Importer la ville'}</span>
                      </button>
                    </div>
                  </div>

                  {importMsg && (
                    <div className="mb-4 p-3 bg-blue-500/20 border border-blue-400/40 rounded-xl text-xs text-blue-200 flex items-center justify-between">
                      <span>{importMsg}</span>
                      <button onClick={() => setImportMsg('')} className="text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
                    </div>
                  )}

                  {isAddingPlace && (
                    <form onSubmit={handleSavePlace} className="bg-slate-950 border-2 border-blue-500/50 rounded-2xl p-6 mb-6">
                      <h4 className="font-bold text-blue-400 mb-4">{editingPlace ? `✏️ Modifier : ${editingPlace.name}` : '➕ Nouveau Lieu Touristique'}</h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div>
                          <label className="text-xs text-slate-400 font-bold block mb-1">Nom du lieu *</label>
                          <input
                            type="text"
                            required
                            value={placeForm.name}
                            onChange={(e) => setPlaceForm({ ...placeForm, name: e.target.value })}
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-slate-400 font-bold block mb-1">Catégorie</label>
                          <select
                            value={placeForm.category}
                            onChange={(e) => setPlaceForm({ ...placeForm, category: e.target.value })}
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
                          >
                            <option value="patrimoine">🏛️ Patrimoine & Histoire</option>
                            <option value="nature">🌿 Nature & Parcs nationaux</option>
                            <option value="agrotourisme">🍃 Agrotourisme & Terroir</option>
                            <option value="aventure">🚂 Aventure & Train FCE</option>
                            <option value="hotel">🏨 Hébergement / Hôtel</option>
                            <option value="restaurant">🍽️ Bonne Table / Restaurant</option>
                            <option value="guide">🧭 Guides & Circuits</option>
                            <option value="transport">🚗 Transport & Location</option>
                            <option value="artisanat">🎨 Artisanat & Ateliers</option>
                            <option value="boutique">🛍️ Boutiques & Commerces</option>
                            <option value="marche">🏪 Marchés & Zoma</option>
                            <option value="musee">🖼️ Musées & Galeries</option>
                            <option value="panorama">🔭 Panoramas & Belvédères</option>
                            <option value="therme">💧 Thermes & Bien-être</option>
                            <option value="religieux">⛪ Sites Religieux</option>
                            <option value="sport">⛺ Sports & Loisirs</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-xs text-slate-400 font-bold block mb-1">Distance & Temps de trajet</label>
                          <input
                            type="text"
                            placeholder="Ex: 23 km (35 min)"
                            value={placeForm.distance_km}
                            onChange={(e) => setPlaceForm({ ...placeForm, distance_km: e.target.value })}
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
                          />
                        </div>
                      </div>

                      {/* Descriptions multilingues */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div>
                          <label className="text-xs text-slate-400 font-bold block mb-1">🇫🇷 Description (Français)</label>
                          <textarea rows="3"
                            value={placeForm.desc_fr}
                            onChange={(e) => setPlaceForm({ ...placeForm, desc_fr: e.target.value })}
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
                            placeholder="Description en français..."
                          />
                        </div>
                        <div>
                          <label className="text-xs text-slate-400 font-bold block mb-1">🇲🇬 Fampahalalana (Malagasy)</label>
                          <textarea rows="3"
                            value={placeForm.desc_mg}
                            onChange={(e) => setPlaceForm({ ...placeForm, desc_mg: e.target.value })}
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
                            placeholder="Fampahalalana malagasy..."
                          />
                        </div>
                        <div>
                          <label className="text-xs text-slate-400 font-bold block mb-1">🇬🇧 Description (English)</label>
                          <textarea rows="3"
                            value={placeForm.desc_en}
                            onChange={(e) => setPlaceForm({ ...placeForm, desc_en: e.target.value })}
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
                            placeholder="English description..."
                          />
                        </div>
                      </div>

                      <div className="mb-4">
                        <label className="text-xs text-slate-400 font-bold block mb-1">🗺️ Étapes de l'itinéraire (conseils de trajet)</label>
                        <textarea
                          rows="2"
                          placeholder="Ex: Depuis la Gare FCE, remonter l'Avenue Royale vers Ampitakely..."
                          value={placeForm.itinerary_steps}
                          onChange={(e) => setPlaceForm({ ...placeForm, itinerary_steps: e.target.value })}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                          <label className="text-xs text-slate-400 font-bold block mb-1">📸 Photo du lieu (URL ou téléverser)</label>
                          <div className="space-y-2">
                            <div className="flex space-x-3 text-xs text-slate-300">
                              <label className="flex items-center space-x-1 cursor-pointer">
                                <input type="radio" name="placePhotoMode" checked={placeForm.photoMode === 'url'} onChange={() => setPlaceForm({ ...placeForm, photoMode: 'url' })} />
                                <span>URL d'image</span>
                              </label>
                              <label className="flex items-center space-x-1 cursor-pointer">
                                <input type="radio" name="placePhotoMode" checked={placeForm.photoMode === 'file'} onChange={() => setPlaceForm({ ...placeForm, photoMode: 'file' })} />
                                <span>Téléverser</span>
                              </label>
                            </div>
                            {placeForm.photoMode === 'url' ? (
                              <input type="url" value={placeForm.photo_url}
                                onChange={(e) => setPlaceForm({ ...placeForm, photo_url: e.target.value })}
                                placeholder="https://images.unsplash.com/..."
                                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
                              />
                            ) : (
                              <input type="file" accept="image/*"
                                onChange={(e) => setPlaceForm({ ...placeForm, photoFile: e.target.files[0] })}
                                className="text-xs text-slate-300"
                              />
                            )}
                          </div>
                        </div>
                        <div>
                          <label className="text-xs text-slate-400 font-bold block mb-1">📍 Coordonnées GPS (pour QR Code itinéraire)</label>
                          <div className="flex space-x-2">
                            <input
                              type="number" step="0.0001" placeholder="Latitude"
                              value={placeForm.lat}
                              onChange={(e) => setPlaceForm({ ...placeForm, lat: parseFloat(e.target.value) || placeForm.lat })}
                              className="w-5/12 bg-slate-900 border border-slate-700 rounded-xl px-2 py-2 text-xs text-white"
                            />
                            <input
                              type="number" step="0.0001" placeholder="Longitude"
                              value={placeForm.lng}
                              onChange={(e) => setPlaceForm({ ...placeForm, lng: parseFloat(e.target.value) || placeForm.lng })}
                              className="w-5/12 bg-slate-900 border border-slate-700 rounded-xl px-2 py-2 text-xs text-white"
                            />
                            <button
                              type="button"
                              onClick={() => handleOpenMapPicker('places')}
                              className="w-2/12 flex items-center justify-center space-x-1 px-2 py-2 bg-amber-500/20 text-amber-300 border border-amber-400/30 rounded-xl font-bold text-xs hover:bg-amber-500 hover:text-slate-950 transition"
                              title="Sélectionner sur la carte"
                            >
                              <MapPin className="w-4 h-4" />
                            </button>
                          </div>
                          <p className="text-[10px] text-slate-500 mt-1">
                            📍 {placeForm.lat?.toFixed(4)}, {placeForm.lng?.toFixed(4)} — <span className="text-amber-400/70">cliquez la carte pour préciser</span>
                          </p>
                        </div>
                      </div>

                      <button
                        type="submit"
                        className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-xl text-xs uppercase"
                      >
                        {editingPlace ? `✏️ Mettre à jour : ${editingPlace.name}` : '✅ Enregistrer le nouveau lieu'}
                      </button>
                    </form>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {places.map((place) => (
                      <div key={place.id} className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex space-x-4">
                        <img
                          src={place.photo_url}
                          alt={place.name}
                          className="w-24 h-24 object-cover rounded-xl bg-slate-900 border border-slate-800 flex-shrink-0"
                          onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1547471080-7cc2caa01a7e?w=200'; }}
                        />
                        <div className="flex-1 flex flex-col justify-between">
                          <div>
                            <span className="text-[10px] uppercase font-bold text-blue-400">{place.category}</span>
                            <h4 className="text-base font-bold text-white">{place.name}</h4>
                            <p className="text-xs text-slate-400 line-clamp-1">{place.distance_km || 'Centre-ville'}</p>
                          </div>
                          <div className="flex justify-end space-x-2 pt-2">
                            <button
                              onClick={() => handleEditPlace(place)}
                              className="text-amber-400 hover:text-amber-300 p-1"
                              title="Modifier"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeletePlace(place.id)}
                              className="text-rose-400 hover:text-rose-300 p-1"
                              title="Supprimer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 3. ÉVÉNEMENTS TAB (No past dates + Map Picker + Edit) */}
              {activeTab === 'events' && (
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-xl font-black">Gestion des Événements & Activités</h3>
                      <p className="text-xs text-slate-400">
                        Date d'événement limitée au présent et futur. Sélection de lieu GPS sur carte pour le guidage mobile.
                      </p>
                    </div>
                    {isAddingEvent ? (
                      <button
                        onClick={() => {
                          setIsAddingEvent(false);
                          setEditingEvent(null);
                        }}
                        className="flex items-center space-x-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs uppercase"
                      >
                        <X className="w-4 h-4 text-rose-400" />
                        <span>Fermer le formulaire</span>
                      </button>
                    ) : (
                      <button
                        onClick={handleOpenAddEvent}
                        className="flex items-center space-x-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs uppercase"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Ajouter un événement</span>
                      </button>
                    )}
                  </div>

                  {isAddingEvent && (
                    <form onSubmit={handleSaveEvent} className="bg-slate-950 border-2 border-emerald-500/50 rounded-2xl p-6 mb-6">
                      <h4 className="font-bold text-emerald-400 mb-4">{editingEvent ? 'Modifier l’événement' : 'Nouvel Événement'}</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                          <label className="text-xs text-slate-400 font-bold block mb-1">Titre de l'événement *</label>
                          <input
                            type="text"
                            required
                            value={eventForm.title_fr}
                            onChange={(e) => setEventForm({ ...eventForm, title_fr: e.target.value })}
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-slate-400 font-bold block mb-1">Lieu *</label>
                          <input
                            type="text"
                            required
                            value={eventForm.location}
                            onChange={(e) => setEventForm({ ...eventForm, location: e.target.value })}
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div>
                          <label className="text-xs text-slate-400 font-bold block mb-1">Date (Impossible dans le passé) *</label>
                          <input
                            type="date"
                            required
                            min={todayStr}
                            value={eventForm.event_date}
                            onChange={(e) => setEventForm({ ...eventForm, event_date: e.target.value })}
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-slate-400 font-bold block mb-1">Horaire</label>
                          <input
                            type="text"
                            value={eventForm.event_time}
                            onChange={(e) => setEventForm({ ...eventForm, event_time: e.target.value })}
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-slate-400 font-bold block mb-1">Position GPS</label>
                          <button
                            type="button"
                            onClick={() => handleOpenMapPicker('events')}
                            className="w-full py-2.5 px-3 bg-amber-500/20 text-amber-300 border border-amber-400/30 rounded-xl font-bold text-xs flex items-center justify-center space-x-1 hover:bg-amber-500 hover:text-slate-950 transition"
                          >
                            <MapPin className="w-4 h-4" />
                            <span>Sélectionner sur la carte</span>
                          </button>
                        </div>
                      </div>

                      <div className="mb-4">
                        <label className="text-xs text-slate-400 font-bold block mb-1">Description</label>
                        <textarea
                          rows="2"
                          value={eventForm.description_fr}
                          onChange={(e) => setEventForm({ ...eventForm, description_fr: e.target.value })}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
                        />
                      </div>

                      <button
                        type="submit"
                        className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl text-xs uppercase"
                      >
                        {editingEvent ? 'Mettre à jour l\'événement' : 'Enregistrer l\'événement'}
                      </button>
                    </form>
                  )}

                  <div className="space-y-3">
                    {events.map((evt) => (
                      <div
                        key={evt.id}
                        className={`bg-slate-950 border p-4 rounded-2xl flex items-center justify-between ${
                          evt.is_expired ? 'border-slate-800/40 opacity-50' : 'border-slate-800'
                        }`}
                      >
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="text-xs font-mono font-bold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded">
                              {evt.event_date}
                            </span>
                            {evt.is_expired ? (
                              <span className="text-[10px] uppercase font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded">
                                Expiré
                              </span>
                            ) : (
                              <span className="text-[10px] uppercase font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                                Actif
                              </span>
                            )}
                          </div>
                          <h4 className="text-base font-bold text-white mt-1">{evt.title_fr}</h4>
                          <p className="text-xs text-slate-400">{evt.location} • {evt.event_time}</p>
                        </div>

                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleEditEvent(evt)}
                            className="text-amber-400 hover:text-amber-300 p-2"
                            title="Modifier"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteEvent(evt.id)}
                            className="text-rose-400 hover:text-rose-300 p-2"
                            title="Supprimer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 4. PARTENAIRES TAB (With Map Picker & Edit) */}
              {activeTab === 'partners' && (
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-xl font-black">Gestion des Partenaires & Terroir</h3>
                      <p className="text-xs text-slate-400">Entreprises locales avec géolocalisation pour guidage mobile.</p>
                    </div>
                    {isAddingPartner ? (
                      <button
                        onClick={() => {
                          setIsAddingPartner(false);
                          setEditingPartner(null);
                        }}
                        className="flex items-center space-x-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs uppercase"
                      >
                        <X className="w-4 h-4 text-rose-400" />
                        <span>Fermer le formulaire</span>
                      </button>
                    ) : (
                      <button
                        onClick={handleOpenAddPartner}
                        className="flex items-center space-x-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl text-xs uppercase"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Ajouter un partenaire</span>
                      </button>
                    )}
                  </div>

                  {isAddingPartner && (
                    <form onSubmit={handleSavePartner} className="bg-slate-950 border-2 border-amber-500/50 rounded-2xl p-6 mb-6">
                      <h4 className="font-bold text-amber-400 mb-4">{editingPartner ? 'Modifier le partenaire' : 'Nouveau Partenaire'}</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                          <label className="text-xs text-slate-400 font-bold block mb-1">Nom de l'entreprise *</label>
                          <input
                            type="text"
                            required
                            value={partnerForm.name}
                            onChange={(e) => setPartnerForm({ ...partnerForm, name: e.target.value })}
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-slate-400 font-bold block mb-1">Type d'activité *</label>
                          <input
                            type="text"
                            required
                            value={partnerForm.type}
                            onChange={(e) => setPartnerForm({ ...partnerForm, type: e.target.value })}
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div>
                          <label className="text-xs text-slate-400 font-bold block mb-1">Contact téléphonique</label>
                          <input
                            type="text"
                            value={partnerForm.contact}
                            onChange={(e) => setPartnerForm({ ...partnerForm, contact: e.target.value })}
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-slate-400 font-bold block mb-1">URL photo/logo</label>
                          <input
                            type="url"
                            value={partnerForm.image_url}
                            onChange={(e) => setPartnerForm({ ...partnerForm, image_url: e.target.value })}
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-slate-400 font-bold block mb-1">Position sur la carte</label>
                          <button
                            type="button"
                            onClick={() => handleOpenMapPicker('partners')}
                            className="w-full py-2 px-3 bg-amber-500/20 text-amber-300 border border-amber-400/30 rounded-xl font-bold text-xs flex items-center justify-center space-x-1 hover:bg-amber-500 hover:text-slate-950 transition"
                          >
                            <MapPin className="w-4 h-4" />
                            <span>Pointer sur la carte</span>
                          </button>
                        </div>
                      </div>

                      <button
                        type="submit"
                        className="w-full py-3 bg-amber-600 hover:bg-amber-500 text-white font-black rounded-xl text-xs uppercase"
                      >
                        {editingPartner ? 'Mettre à jour le partenaire' : 'Enregistrer le partenaire'}
                      </button>
                    </form>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {partners.map((p) => (
                      <div key={p.id} className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex justify-between items-center">
                        <div>
                          <span className="text-[10px] uppercase font-bold text-amber-400">{p.type}</span>
                          <h4 className="text-base font-bold text-white">{p.name}</h4>
                          <p className="text-xs text-emerald-400 font-mono">{p.contact}</p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <button onClick={() => handleEditPartner(p)} className="text-amber-400 hover:text-amber-300 p-1">
                            <Edit className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDeletePartner(p.id)} className="text-rose-400 hover:text-rose-300 p-1">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 5. URGENCES TAB (With Map Picker & Edit) */}
              {activeTab === 'emergency' && (
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-xl font-black">Gestion des Numéros d'Urgence</h3>
                      <p className="text-xs text-slate-400">Services d'urgence avec coordonnées GPS pour calcul d'itinéraire immédiat.</p>
                    </div>
                    {isAddingEmergency ? (
                      <button
                        onClick={() => {
                          setIsAddingEmergency(false);
                          setEditingEmergency(null);
                        }}
                        className="flex items-center space-x-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs uppercase"
                      >
                        <X className="w-4 h-4 text-rose-400" />
                        <span>Fermer le formulaire</span>
                      </button>
                    ) : (
                      <button
                        onClick={handleOpenAddEmergency}
                        className="flex items-center space-x-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs uppercase"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Ajouter un contact d'urgence</span>
                      </button>
                    )}
                  </div>

                  {isAddingEmergency && (
                    <form onSubmit={handleSaveEmergency} className="bg-slate-950 border-2 border-rose-500/50 rounded-2xl p-6 mb-6">
                      <h4 className="font-bold text-rose-400 mb-4">{editingEmergency ? 'Modifier le contact d\'urgence' : 'Nouveau Contact'}</h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div>
                          <label className="text-xs text-slate-400 font-bold block mb-1">Nom du service *</label>
                          <input
                            type="text"
                            required
                            value={emergencyForm.name}
                            onChange={(e) => setEmergencyForm({ ...emergencyForm, name: e.target.value })}
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-slate-400 font-bold block mb-1">Numéro d'urgence *</label>
                          <input
                            type="text"
                            required
                            value={emergencyForm.number}
                            onChange={(e) => setEmergencyForm({ ...emergencyForm, number: e.target.value })}
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-slate-400 font-bold block mb-1">Position GPS de l'hôpital/police</label>
                          <button
                            type="button"
                            onClick={() => handleOpenMapPicker('emergency')}
                            className="w-full py-2.5 px-3 bg-rose-500/20 text-rose-300 border border-rose-400/30 rounded-xl font-bold text-xs flex items-center justify-center space-x-1 hover:bg-rose-500 hover:text-white transition"
                          >
                            <MapPin className="w-4 h-4" />
                            <span>Pointer sur la carte</span>
                          </button>
                        </div>
                      </div>
                      <button
                        type="submit"
                        className="w-full py-3 bg-rose-600 hover:bg-rose-500 text-white font-black rounded-xl text-xs uppercase"
                      >
                        {editingEmergency ? 'Mettre à jour le contact' : 'Enregistrer le contact d\'urgence'}
                      </button>
                    </form>
                  )}

                  <div className="space-y-3">
                    {emergencyList.map((item) => (
                      <div key={item.id} className="bg-slate-950 border border-slate-800 p-4 rounded-2xl flex items-center justify-between">
                        <div>
                          <h4 className="text-base font-bold text-white">{item.name}</h4>
                          <span className="text-lg font-mono font-black text-rose-400">{item.number}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <button onClick={() => handleEditEmergency(item)} className="text-amber-400 hover:text-amber-300 p-2">
                            <Edit className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDeleteEmergency(item.id)} className="text-rose-400 hover:text-rose-300 p-2">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 6. STATISTIQUES AVANCÉES TAB */}
              {activeTab === 'stats' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xl font-black">Tableau de Bord Télémétrique Avancé</h3>
                      <p className="text-xs text-slate-400">Analyse détaillée des comportements touristiques et fréquentation du kiosque.</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={loadAllData}
                        className="flex items-center space-x-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-xl text-xs font-bold transition"
                      >
                        <Check className="w-4 h-4" />
                        <span>Actualiser</span>
                      </button>
                      <button
                        onClick={handleExportStats}
                        className="flex items-center space-x-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-amber-400 border border-amber-400/30 rounded-xl text-xs font-bold transition"
                      >
                        <Download className="w-4 h-4" />
                        <span>Exporter JSON</span>
                      </button>
                    </div>
                  </div>

                  {/* Primary KPIs */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-slate-950 p-5 rounded-2xl border border-blue-900/50 text-center">
                      <Users className="w-6 h-6 text-blue-400 mx-auto" />
                      <div className="text-4xl font-black mt-2 text-white">{stats?.totalSessions || 0}</div>
                      <div className="text-xs text-slate-400 uppercase font-bold mt-1">Visiteurs totaux</div>
                    </div>
                    <div className="bg-slate-950 p-5 rounded-2xl border border-emerald-900/50 text-center">
                      <Clock className="w-6 h-6 text-emerald-400 mx-auto" />
                      <div className="text-4xl font-black mt-2 text-white">{stats?.avgDurationSeconds || 0}s</div>
                      <div className="text-xs text-slate-400 uppercase font-bold mt-1">Durée moy. session</div>
                    </div>
                    <div className="bg-slate-950 p-5 rounded-2xl border border-amber-900/50 text-center">
                      <Sparkles className="w-6 h-6 text-amber-400 mx-auto" />
                      <div className="text-4xl font-black mt-2 text-white">
                        {stats?.featureCounts ? Object.values(stats.featureCounts).reduce((a, b) => a + b, 0) : 0}
                      </div>
                      <div className="text-xs text-slate-400 uppercase font-bold mt-1">Interactions totales</div>
                    </div>
                    <div className="bg-slate-950 p-5 rounded-2xl border border-violet-900/50 text-center">
                      <Globe2 className="w-6 h-6 text-violet-400 mx-auto" />
                      <div className="flex justify-around mt-2 text-sm font-mono font-bold">
                        <div className="text-center"><div className="text-white">{stats?.languages?.mg || 0}</div><div className="text-[10px] text-slate-500">🇲🇬 MG</div></div>
                        <div className="text-center"><div className="text-white">{stats?.languages?.fr || 0}</div><div className="text-[10px] text-slate-500">🇫🇷 FR</div></div>
                        <div className="text-center"><div className="text-white">{stats?.languages?.en || 0}</div><div className="text-[10px] text-slate-500">🇬🇧 EN</div></div>
                      </div>
                      <div className="text-xs text-slate-400 uppercase font-bold mt-1">Langues</div>
                    </div>
                  </div>

                  {/* Daily Trend Chart (7 derniers jours) */}
                  {stats?.dailyTrend && stats.dailyTrend.length > 0 && (() => {
                    const trend = [...stats.dailyTrend].reverse(); // chronological order
                    const maxCount = Math.max(...trend.map((d) => d.count), 1);
                    return (
                      <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800">
                        <h4 className="text-sm uppercase font-bold text-slate-400 tracking-wider mb-5 flex items-center space-x-2">
                          <BarChart3 className="w-4 h-4 text-blue-400" />
                          <span>Fréquentation des 7 derniers jours</span>
                        </h4>
                        <div className="flex items-end space-x-3 h-32">
                          {trend.map((day, idx) => {
                            const pct = Math.round((day.count / maxCount) * 100);
                            const dateLabel = new Date(day.date + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
                            return (
                              <div key={idx} className="flex-1 flex flex-col items-center space-y-1 group">
                                {/* Tooltip */}
                                <div className="opacity-0 group-hover:opacity-100 transition text-xs text-white font-bold bg-slate-700 px-2 py-1 rounded-lg whitespace-nowrap">
                                  {day.count} visite{day.count > 1 ? 's' : ''}
                                </div>
                                {/* Bar */}
                                <div className="w-full relative" style={{ height: '80px' }}>
                                  <div
                                    className="absolute bottom-0 left-0 right-0 bg-blue-500/80 hover:bg-blue-400 rounded-t-lg transition-all"
                                    style={{ height: `${Math.max(pct, 4)}%` }}
                                  />
                                </div>
                                {/* Count label */}
                                <span className="text-xs font-bold text-blue-300 font-mono">{day.count}</span>
                                {/* Date label */}
                                <span className="text-[10px] text-slate-500 text-center leading-tight">{dateLabel}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Peak Hours (Affluence) */}
                  <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800">
                    <h4 className="text-sm uppercase font-bold text-slate-400 tracking-wider mb-4 flex items-center space-x-2">
                      <Clock className="w-4 h-4 text-amber-400" />
                      <span>Horaires d'affluence (Pic d'activité)</span>
                    </h4>
                    {(() => {
                      const slots = [
                        { label: 'Matinée', time: '06h–12h', count: stats?.peakHours?.matin || 0, color: 'bg-amber-400', text: 'text-amber-300' },
                        { label: 'Après-midi', time: '12h–18h', count: stats?.peakHours?.midi || 0, color: 'bg-emerald-400', text: 'text-emerald-300' },
                        { label: 'Soirée', time: '18h–23h', count: stats?.peakHours?.soir || 0, color: 'bg-indigo-400', text: 'text-indigo-300' },
                        { label: 'Nuit', time: '23h–06h', count: stats?.peakHours?.nuit || 0, color: 'bg-slate-500', text: 'text-slate-400' }
                      ];
                      const maxPeak = Math.max(...slots.map((s) => s.count), 1);
                      return (
                        <div className="space-y-3">
                          {slots.map((slot) => (
                            <div key={slot.label} className="flex items-center space-x-4">
                              <div className="w-28 text-right">
                                <div className="text-xs font-bold text-slate-300">{slot.label}</div>
                                <div className="text-[10px] text-slate-500">{slot.time}</div>
                              </div>
                              <div className="flex-1 bg-slate-900 rounded-full h-4 overflow-hidden">
                                <div
                                  className={`h-full ${slot.color} rounded-full transition-all`}
                                  style={{ width: `${Math.max((slot.count / maxPeak) * 100, 2)}%` }}
                                />
                              </div>
                              <span className={`text-sm font-black font-mono w-8 text-right ${slot.text}`}>{slot.count}</span>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Top Modules & QR Codes */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Feature bar chart */}
                    <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800">
                      <h4 className="text-sm uppercase font-bold text-slate-400 tracking-wider mb-4 flex items-center space-x-2">
                        <Layers className="w-4 h-4 text-amber-400" />
                        <span>Modules les plus consultés</span>
                      </h4>
                      {stats?.featureCounts && Object.keys(stats.featureCounts).length > 0 ? (() => {
                        const entries = Object.entries(stats.featureCounts).sort((a, b) => b[1] - a[1]);
                        const maxVal = entries[0]?.[1] || 1;
                        const colors = ['bg-amber-400', 'bg-emerald-400', 'bg-blue-400', 'bg-violet-400', 'bg-rose-400', 'bg-pink-400'];
                        return (
                          <div className="space-y-3">
                            {entries.map(([feature, count], idx) => (
                              <div key={feature} className="flex items-center space-x-3">
                                <span className="text-xs font-bold text-slate-300 w-24 truncate uppercase">{feature}</span>
                                <div className="flex-1 bg-slate-900 rounded-full h-3 overflow-hidden">
                                  <div
                                    className={`h-full ${colors[idx % colors.length]} rounded-full`}
                                    style={{ width: `${(count / maxVal) * 100}%` }}
                                  />
                                </div>
                                <span className="text-xs font-mono text-amber-400 font-bold w-12 text-right">{count}×</span>
                              </div>
                            ))}
                          </div>
                        );
                      })() : (
                        <div className="flex flex-col items-center py-8 text-slate-600">
                          <BarChart3 className="w-10 h-10 mb-2" />
                          <p className="text-xs">Aucune donnée pour le moment.</p>
                        </div>
                      )}
                    </div>

                    {/* Top QR scans */}
                    <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800">
                      <h4 className="text-sm uppercase font-bold text-slate-400 tracking-wider mb-4 flex items-center space-x-2">
                        <Navigation className="w-4 h-4 text-emerald-400" />
                        <span>Lieux & QR Codes les plus scannés</span>
                      </h4>
                      {stats?.topScannedItems && stats.topScannedItems.length > 0 ? (
                        <div className="space-y-3">
                          {stats.topScannedItems.map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between p-3 bg-slate-900 rounded-xl border border-slate-800">
                              <div className="flex items-center space-x-3">
                                <span className="text-lg font-black text-slate-500 w-6">#{idx + 1}</span>
                                <span className="text-xs font-bold text-slate-200 truncate max-w-[140px]">{item.item_clicked}</span>
                              </div>
                              <span className="text-xs font-mono font-black text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-2 py-1 rounded-full">
                                {item.count} scan{item.count > 1 ? 's' : ''}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center py-8 text-slate-600">
                          <Navigation className="w-10 h-10 mb-2" />
                          <p className="text-xs">Aucun scan enregistré.</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Danger zone: clear stats */}
                  <div className="bg-rose-950/30 border border-rose-900/50 rounded-2xl p-5 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-rose-300">Zone dangereuse — Réinitialiser les statistiques</p>
                      <p className="text-xs text-rose-400/70 mt-0.5">Supprime toutes les sessions et interactions. Action irréversible.</p>
                    </div>
                    <button
                      onClick={async () => {
                        if (!window.confirm('Réinitialiser toutes les statistiques ? Cette action est irréversible.')) return;
                        await api.clearStats();
                        await loadAllData();
                      }}
                      className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs uppercase transition active:scale-95"
                    >
                      Tout effacer
                    </button>
                  </div>
                </div>
              )}

              {/* 6. CONFIGURATION DU KIOSQUE & EMPLACEMENT MULTI-VILLES */}
              {activeTab === 'config' && (
                <div className="space-y-6">
                  {/* Ville Active Actuelle */}
                  <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6 relative overflow-hidden">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center space-x-2 mb-2">
                          <span className="w-3 h-3 rounded-full bg-emerald-400 animate-ping" />
                          <span className="text-xs uppercase font-extrabold tracking-wider text-emerald-400">
                            Emplacement Actuel du Kiosque
                          </span>
                        </div>
                        <h2 className="text-3xl font-black text-white flex items-center space-x-3">
                          <Compass className="w-8 h-8 text-amber-400" />
                          <span>{kioskConfigData?.active_city || 'Fianarantsoa'}</span>
                        </h2>
                        <p className="text-slate-400 text-sm mt-1">
                          Région : <span className="text-slate-200 font-bold">{kioskConfigData?.active_region || 'Haute Matsiatra'}</span> • Coordonnées GPS : <span className="font-mono text-amber-300">{kioskConfigData?.active_lat}, {kioskConfigData?.active_lng}</span>
                        </p>
                      </div>

                      {/* Données actives en ce moment pour cette ville */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 text-center">
                          <span className="text-xl font-black text-amber-400">{places.length}</span>
                          <span className="text-[10px] text-slate-400 font-bold block uppercase mt-0.5">Lieux & Hôtels</span>
                        </div>
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 text-center">
                          <span className="text-xl font-black text-emerald-400">{events.length}</span>
                          <span className="text-[10px] text-slate-400 font-bold block uppercase mt-0.5">Événements</span>
                        </div>
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 text-center">
                          <span className="text-xl font-black text-sky-400">{partners.length}</span>
                          <span className="text-[10px] text-slate-400 font-bold block uppercase mt-0.5">Partenaires</span>
                        </div>
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 text-center">
                          <span className="text-xl font-black text-rose-400">{emergencyList.length}</span>
                          <span className="text-[10px] text-slate-400 font-bold block uppercase mt-0.5">Urgences</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Messages de statut */}
                  {switchSuccessMsg && (
                    <div className="p-4 bg-emerald-950/80 border border-emerald-500/50 rounded-2xl text-emerald-300 text-sm flex items-center space-x-3">
                      <Check className="w-5 h-5 flex-shrink-0 text-emerald-400" />
                      <span>{switchSuccessMsg}</span>
                    </div>
                  )}

                  {switchErrorMsg && (
                    <div className="p-4 bg-rose-950/80 border border-rose-500/50 rounded-2xl text-rose-300 text-sm flex items-center space-x-3">
                      <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-400" />
                      <span>{switchErrorMsg}</span>
                    </div>
                  )}

                  {/* Villes mémorisées dans la base (Historique réversible sans perte) */}
                  <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6">
                    <div className="mb-4">
                      <h3 className="text-lg font-bold text-white flex items-center space-x-2">
                        <Layers className="w-5 h-5 text-amber-400" />
                        <span>Villes enregistrées en base ({availableCities.length})</span>
                      </h3>
                      <p className="text-xs text-slate-400 mt-1">
                        Toutes les données manuelles de chaque ville restent sauvegardées. Vous pouvez réactiver une ancienne ville en 1 clic pour restaurer ses événements et partenaires intacts, ou la supprimer définitivement pour libérer la mémoire.
                      </p>
                    </div>

                    {deleteCityMsg && (
                      <div className="mb-4 p-3 bg-emerald-950/60 border border-emerald-500/50 rounded-xl text-emerald-300 text-xs flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Check className="w-4 h-4 flex-shrink-0 text-emerald-400" />
                          <span>{deleteCityMsg}</span>
                        </div>
                        <button onClick={() => setDeleteCityMsg('')} className="text-emerald-400 hover:text-white">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    {deleteCityError && (
                      <div className="mb-4 p-3 bg-rose-950/60 border border-rose-500/50 rounded-xl text-rose-300 text-xs flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
                          <span>{deleteCityError}</span>
                        </div>
                        <button onClick={() => setDeleteCityError('')} className="text-rose-400 hover:text-white">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {availableCities.map((c) => {
                        const isCurrent = c.city === kioskConfigData?.active_city;
                        return (
                          <div
                            key={c.city}
                            className={`p-4 rounded-2xl border transition-all flex flex-col justify-between ${
                              isCurrent
                                ? 'bg-amber-950/30 border-amber-500/60 shadow-lg'
                                : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                            }`}
                          >
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <span className="font-black text-white text-base">{c.city}</span>
                                {isCurrent ? (
                                  <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                                    Actif
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-slate-500 font-mono">En mémoire</span>
                                )}
                              </div>
                              <div className="flex flex-wrap gap-2 text-xs text-slate-400 mb-4">
                                <span className="bg-slate-950 px-2 py-0.5 rounded-md border border-slate-800">
                                  {c.places_count} lieux
                                </span>
                                <span className="bg-slate-950 px-2 py-0.5 rounded-md border border-slate-800">
                                  {c.events_count || 0} événements
                                </span>
                                <span className="bg-slate-950 px-2 py-0.5 rounded-md border border-slate-800">
                                  {c.partners_count || 0} partenaires
                                </span>
                              </div>
                            </div>

                            {!isCurrent ? (
                              <div className="flex items-center space-x-2 pt-2 border-t border-slate-800/80">
                                <button
                                  disabled={isSwitchingCity || isDeletingCity}
                                  onClick={() => setConfirmSwitchTarget({ city: c.city, region: c.region || '', lat: c.lat, lng: c.lng, isExisting: true })}
                                  className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 active:scale-95 text-amber-300 text-xs font-bold rounded-xl border border-amber-400/30 transition flex items-center justify-center space-x-1.5"
                                >
                                  <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
                                  <span>Réactiver</span>
                                </button>
                                <button
                                  disabled={isSwitchingCity || isDeletingCity}
                                  onClick={() => {
                                    setDeleteCityError('');
                                    setCityToDelete(c);
                                  }}
                                  className="px-3 py-2 bg-rose-950/40 hover:bg-rose-900/60 active:scale-95 text-rose-400 hover:text-rose-200 text-xs font-bold rounded-xl border border-rose-500/30 transition flex items-center justify-center space-x-1"
                                  title={`Supprimer définitivement ${c.city} de la mémoire`}
                                >
                                  <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                                  <span>Supprimer</span>
                                </button>
                              </div>
                            ) : (
                              <div className="py-2 text-center text-xs text-emerald-400/80 font-bold bg-emerald-950/20 rounded-xl border border-emerald-500/20">
                                ✓ Emplacement actuel du kiosque
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Rechercher et Déplacer vers une Nouvelle Ville */}
                  <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6">
                    <div className="mb-4">
                      <h3 className="text-lg font-bold text-white flex items-center space-x-2">
                        <MapPin className="w-5 h-5 text-blue-400" />
                        <span>Rechercher & Déplacer le Kiosque vers une autre Ville</span>
                      </h3>
                      <p className="text-xs text-slate-400 mt-1">
                        Entrez le nom d'une commune de Madagascar. Les villes homonymes seront clairement distinguées par région. Si la ville est nouvelle, ses établissements réels seront répertoriés sans inventer de photo.
                      </p>
                    </div>

                    <form onSubmit={handleSearchCity} className="flex gap-3 mb-6">
                      <input
                        type="text"
                        value={citySearchQuery}
                        onChange={(e) => setCitySearchQuery(e.target.value)}
                        placeholder="Ex: Antsirabe, Toamasina, Mahajanga, Nosy Be, Ambositra, Manakara, Morondava..."
                        className="flex-1 bg-slate-900 border border-slate-700 rounded-2xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                      />
                      <button
                        type="submit"
                        disabled={isSearchingCity || !citySearchQuery.trim()}
                        className="px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold rounded-2xl text-xs uppercase flex items-center space-x-2 shadow-lg active:scale-95 transition"
                      >
                        {isSearchingCity ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            <span>Recherche...</span>
                          </>
                        ) : (
                          <>
                            <Compass className="w-4 h-4" />
                            <span>Rechercher</span>
                          </>
                        )}
                      </button>
                    </form>

                    {/* Résultats de recherche avec désambiguïsation des homonymes */}
                    {citySearchResults.length > 0 && (
                      <div className="space-y-3">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                          Résultats trouvés ({citySearchResults.length}) — Sélectionnez la ville voulue :
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {citySearchResults.map((res, idx) => {
                            const isHomonym = citySearchResults.filter((x) => x.city.toLowerCase() === res.city.toLowerCase()).length > 1;
                            return (
                              <div
                                key={idx}
                                className="bg-slate-900 border border-slate-800 hover:border-blue-500/50 rounded-2xl p-4 flex flex-col justify-between transition"
                              >
                                <div>
                                  <div className="flex items-start justify-between gap-2">
                                    <div>
                                      <h5 className="text-base font-black text-white">{res.city}</h5>
                                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                                          Région : {res.region}
                                        </span>
                                        {res.province && (
                                          <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                                            Province : {res.province}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    {isHomonym && (
                                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 flex-shrink-0" title="Plusieurs villes portent ce nom à Madagascar">
                                        Homonyme
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[11px] font-mono text-slate-500 mt-2">
                                    GPS : {res.lat.toFixed(4)}, {res.lng.toFixed(4)}
                                  </p>
                                </div>

                                <button
                                  onClick={() => setConfirmSwitchTarget(res)}
                                  className="mt-4 w-full py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow active:scale-95 transition flex items-center justify-center space-x-2"
                                >
                                  <MapPin className="w-4 h-4" />
                                  <span>Déplacer le Kiosque ici</span>
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Confirmation Modal avant basculement */}
                  {confirmSwitchTarget && (
                    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-6">
                      <div className="bg-slate-900 border-2 border-amber-500 rounded-3xl p-6 max-w-lg w-full text-center relative shadow-2xl animate-fade-in">
                        <div className="w-16 h-16 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center mx-auto mb-4 text-amber-400">
                          <Compass className="w-8 h-8" />
                        </div>
                        <h3 className="text-2xl font-black text-white">
                          Déplacer le Kiosque vers {confirmSwitchTarget.city} ?
                        </h3>
                        {confirmSwitchTarget.region && (
                          <p className="text-sm text-amber-300 font-bold mt-1">
                            Région : {confirmSwitchTarget.region}
                          </p>
                        )}
                        <p className="text-slate-300 text-xs mt-3 leading-relaxed">
                          Le kiosque n'affichera désormais que les établissements, la météo en direct et les événements de <b>{confirmSwitchTarget.city}</b>.
                        </p>
                        <div className="p-3 my-4 bg-slate-950 rounded-xl border border-slate-800 text-left text-xs text-slate-400">
                          💡 <b>Conservation garantie :</b> Toutes les données de <b>{kioskConfigData?.active_city}</b> resteront archivées en sécurité. Si vous y revenez plus tard, vous retrouverez tous vos ajouts manuels.
                        </div>

                        <div className="flex space-x-3 mt-6">
                          <button
                            disabled={isSwitchingCity}
                            onClick={() => setConfirmSwitchTarget(null)}
                            className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs uppercase"
                          >
                            Annuler
                          </button>
                          <button
                            disabled={isSwitchingCity}
                            onClick={() => handleExecuteSwitch(confirmSwitchTarget)}
                            className="flex-1 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black rounded-xl text-xs uppercase shadow-xl flex items-center justify-center space-x-2"
                          >
                            {isSwitchingCity ? (
                              <>
                                <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                                <span>Configuration...</span>
                              </>
                            ) : (
                              <>
                                <Check className="w-4 h-4 text-slate-950" />
                                <span>Confirmer le déplacement</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Modal confirmation suppression d'une ville */}
                  {cityToDelete && (
                    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-6 animate-fade-in">
                      <div className="bg-slate-900 border-2 border-rose-500 rounded-3xl p-6 max-w-lg w-full text-center relative shadow-2xl">
                        <div className="w-16 h-16 rounded-full bg-rose-500/20 border border-rose-500/40 flex items-center justify-center mx-auto mb-4 text-rose-400">
                          <Trash2 className="w-8 h-8" />
                        </div>
                        <h3 className="text-2xl font-black text-white">
                          Supprimer la ville {cityToDelete.city} ?
                        </h3>
                        <p className="text-slate-300 text-xs mt-3 leading-relaxed">
                          Cette action effacera définitivement de la base de données :
                        </p>
                        <div className="p-3 my-4 bg-slate-950 rounded-xl border border-slate-800 text-left text-xs space-y-1.5 text-slate-300">
                          <div>• <b>{cityToDelete.places_count}</b> lieux touristiques & établissements</div>
                          <div>• <b>{cityToDelete.events_count || 0}</b> événements enregistrés</div>
                          <div>• <b>{cityToDelete.partners_count || 0}</b> partenaires locaux</div>
                          <div>• <b>{cityToDelete.emergency_count || 0}</b> contacts d'urgence</div>
                        </div>
                        <p className="text-rose-400 text-xs font-semibold mb-4">
                          ⚠️ Cette action est irréversible pour la ville sélectionnée.
                        </p>

                        <div className="flex space-x-3 mt-4">
                          <button
                            disabled={isDeletingCity}
                            onClick={() => setCityToDelete(null)}
                            className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs uppercase transition"
                          >
                            Annuler
                          </button>
                          <button
                            disabled={isDeletingCity}
                            onClick={() => handleDeleteCity(cityToDelete)}
                            className="flex-1 py-3 bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white font-black rounded-xl text-xs uppercase shadow-xl flex items-center justify-center space-x-2 transition"
                          >
                            {isDeletingCity ? (
                              <>
                                <RefreshCw className="w-4 h-4 animate-spin text-white" />
                                <span>Suppression...</span>
                              </>
                            ) : (
                              <>
                                <Trash2 className="w-4 h-4 text-white" />
                                <span>Confirmer la suppression</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 7. COMPTES & SÉCURITÉ TAB */}
              {activeTab === 'users' && (
                <div className="space-y-6">
                  {/* Change My Profile */}
                  <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6">
                    <div className="flex items-center space-x-2 text-amber-400 font-bold mb-4">
                      <KeyRound className="w-5 h-5" />
                      <span>Modifier mon profil administrateur</span>
                    </div>

                    <form onSubmit={handleUpdateProfile} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="text-xs text-slate-400 font-bold block mb-1">Nom complet</label>
                        <input
                          type="text"
                          value={profileForm.full_name}
                          onChange={(e) => setProfileForm({ ...profileForm, full_name: e.target.value })}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-400 font-bold block mb-1">Nom d'utilisateur</label>
                        <input
                          type="text"
                          required
                          value={profileForm.new_username}
                          onChange={(e) => setProfileForm({ ...profileForm, new_username: e.target.value })}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-400 font-bold block mb-1">Nouveau mot de passe (optionnel)</label>
                        <input
                          type="password"
                          placeholder="Laisser vide pour ne pas changer"
                          value={profileForm.new_password}
                          onChange={(e) => setProfileForm({ ...profileForm, new_password: e.target.value })}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
                        />
                      </div>

                      <div className="md:col-span-3 flex items-center justify-between mt-2">
                        {profileMsg && <span className="text-xs text-emerald-400 font-bold">{profileMsg}</span>}
                        <button
                          type="submit"
                          className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs uppercase"
                        >
                          Enregistrer les modifications
                        </button>
                      </div>
                    </form>
                  </div>

                  {/* Create New Admin Account */}
                  <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6">
                    <div className="flex items-center space-x-2 text-blue-400 font-bold mb-4">
                      <UserPlus className="w-5 h-5" />
                      <span>Créer un nouveau compte administrateur</span>
                    </div>

                    <form onSubmit={handleCreateUser} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="text-xs text-slate-400 font-bold block mb-1">Identifiant *</label>
                        <input
                          type="text"
                          required
                          placeholder="ex: adjoint_mairie"
                          value={newUserForm.username}
                          onChange={(e) => setNewUserForm({ ...newUserForm, username: e.target.value })}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-400 font-bold block mb-1">Nom complet</label>
                        <input
                          type="text"
                          placeholder="ex: Jean Rabe"
                          value={newUserForm.full_name}
                          onChange={(e) => setNewUserForm({ ...newUserForm, full_name: e.target.value })}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-400 font-bold block mb-1">Mot de passe *</label>
                        <input
                          type="password"
                          required
                          placeholder="••••••••"
                          value={newUserForm.password}
                          onChange={(e) => setNewUserForm({ ...newUserForm, password: e.target.value })}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
                        />
                      </div>

                      <div className="md:col-span-3 flex justify-end mt-2">
                        <button
                          type="submit"
                          className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs uppercase"
                        >
                          Créer le compte
                        </button>
                      </div>
                    </form>
                  </div>

                  {/* Accounts List */}
                  <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6">
                    <h4 className="font-bold text-white mb-4">Comptes existants ({usersList.length})</h4>
                    <div className="space-y-2">
                      {usersList.map((u) => (
                        <div key={u.username} className="flex items-center justify-between p-3 bg-slate-900 rounded-xl border border-slate-800">
                          <div>
                            <span className="font-bold text-white text-sm">{u.full_name || u.username}</span>
                            <span className="text-xs text-slate-400 ml-2 font-mono">(@{u.username})</span>
                          </div>
                          {usersList.length > 1 && u.username !== currentUser?.username && (
                            <button
                              onClick={() => handleDeleteUser(u.username)}
                              className="text-rose-400 hover:text-rose-300 p-1"
                              title="Supprimer ce compte"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>

                    <div className="mt-6 pt-4 border-t border-slate-800 flex justify-end">
                      <button
                        onClick={handleLogout}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold"
                      >
                        Se déconnecter
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Interactive Location Picker Modal with OpenStreetMap */}
        <LocationPickerModal
          isOpen={isMapPickerOpen}
          onClose={() => setIsMapPickerOpen(false)}
          initialLat={
            mapPickerTarget === 'places' ? placeForm.lat :
            mapPickerTarget === 'events' ? eventForm.lat :
            mapPickerTarget === 'partners' ? partnerForm.lat :
            mapPickerTarget === 'emergency' ? emergencyForm.lat : -21.4536
          }
          initialLng={
            mapPickerTarget === 'places' ? placeForm.lng :
            mapPickerTarget === 'events' ? eventForm.lng :
            mapPickerTarget === 'partners' ? partnerForm.lng :
            mapPickerTarget === 'emergency' ? emergencyForm.lng : 47.0858
          }
          onConfirm={handleCoordsPicked}
        />
      </div>
    </div>
  );
}

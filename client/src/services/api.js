const API_BASE_URL = 'http://localhost:5000/api';
export const API_ORIGIN = 'http://localhost:5000';

export function resolveMediaUrl(url) {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  return `${API_ORIGIN}${url.startsWith('/') ? '' : '/'}${url}`;
}

function getAuthHeader() {
  const token = localStorage.getItem('kiosk_admin_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export const api = {
  // --- AUTHENTICATION & USERS ---
  async login(username, password) {
    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Identifiants invalides');
    localStorage.setItem('kiosk_admin_token', data.token);
    return data;
  },

  logout() {
    localStorage.removeItem('kiosk_admin_token');
  },

  isAuthenticated() {
    return !!localStorage.getItem('kiosk_admin_token');
  },

  async getUsers() {
    const res = await fetch(`${API_BASE_URL}/auth/users`, {
      headers: { ...getAuthHeader() }
    });
    if (!res.ok) throw new Error('Impossible de charger les utilisateurs.');
    return await res.json();
  },

  async createUser(userData) {
    const res = await fetch(`${API_BASE_URL}/auth/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify(userData)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Impossible de créer le compte.');
    return data;
  },

  async updateProfile(profileData) {
    const res = await fetch(`${API_BASE_URL}/auth/profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify(profileData)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Impossible de mettre à jour le profil.');
    if (data.token) {
      localStorage.setItem('kiosk_admin_token', data.token);
    }
    return data;
  },

  async deleteUser(username) {
    const res = await fetch(`${API_BASE_URL}/auth/users/${username}`, {
      method: 'DELETE',
      headers: { ...getAuthHeader() }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Suppression impossible.');
    return data;
  },

  // --- ADVERTISEMENTS ---
  async getActiveAds() {
    try {
      const res = await fetch(`${API_BASE_URL}/ads`);
      if (!res.ok) throw new Error('Service indisponible.');
      return await res.json();
    } catch {
      return null;
    }
  },

  async getAllAds() {
    const res = await fetch(`${API_BASE_URL}/ads/all`, {
      headers: { ...getAuthHeader() }
    });
    if (!res.ok) throw new Error('Impossible de charger les publicités.');
    return await res.json();
  },

  async addAd(formData) {
    const res = await fetch(`${API_BASE_URL}/ads`, {
      method: 'POST',
      headers: { ...getAuthHeader() },
      body: formData
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Ajout impossible.');
    return data;
  },

  async updateAd(id, formData) {
    const res = await fetch(`${API_BASE_URL}/ads/${id}`, {
      method: 'PUT',
      headers: { ...getAuthHeader() },
      body: formData
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Mise à jour impossible.');
    return data;
  },

  async toggleAd(id) {
    const res = await fetch(`${API_BASE_URL}/ads/${id}/toggle`, {
      method: 'PUT',
      headers: { ...getAuthHeader() }
    });
    return await res.json();
  },

  async deleteAd(id) {
    const res = await fetch(`${API_BASE_URL}/ads/${id}`, {
      method: 'DELETE',
      headers: { ...getAuthHeader() }
    });
    return await res.json();
  },

  // --- PLACES & ITINERARIES ---
  async getPlaces(categoryOrScope = 'all') {
    try {
      let url = `${API_BASE_URL}/places`;
      if (categoryOrScope === 'sites') {
        url += '?scope=sites';
      } else if (categoryOrScope === 'hospitality') {
        url += '?scope=hospitality';
      } else if (categoryOrScope && categoryOrScope !== 'all') {
        url += `?category=${encodeURIComponent(categoryOrScope)}`;
      }
      const res = await fetch(url);
      if (!res.ok) throw new Error('Impossible de charger les données.');
      return await res.json();
    } catch {
      return null;
    }
  },

  async importOsmPlaces(city) {
    if (!city) throw new Error('Aucune ville sélectionnée pour l’import OpenStreetMap.');
    const res = await fetch(`${API_BASE_URL}/places/import-osm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify({ city })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Importation impossible.');
    return data;
  },

  async addPlace(formData) {
    const res = await fetch(`${API_BASE_URL}/places`, {
      method: 'POST',
      headers: { ...getAuthHeader() },
      body: formData
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Impossible d’ajouter le lieu.');
    return data;
  },

  async updatePlace(id, formData) {
    const res = await fetch(`${API_BASE_URL}/places/${id}`, {
      method: 'PUT',
      headers: { ...getAuthHeader() },
      body: formData
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Impossible de mettre à jour le lieu.');
    return data;
  },

  async deletePlace(id) {
    const res = await fetch(`${API_BASE_URL}/places/${id}`, {
      method: 'DELETE',
      headers: { ...getAuthHeader() }
    });
    return await res.json();
  },

  // --- EVENTS ---
  async getEvents() {
    try {
      const res = await fetch(`${API_BASE_URL}/events`);
      if (!res.ok) throw new Error('Impossible de charger les données.');
      return await res.json();
    } catch {
      return null;
    }
  },

  async addEvent(eventData) {
    const res = await fetch(`${API_BASE_URL}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify(eventData)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Impossible d’ajouter l’événement.');
    return data;
  },

  async updateEvent(id, eventData) {
    const res = await fetch(`${API_BASE_URL}/events/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify(eventData)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Impossible de mettre à jour l’événement.');
    return data;
  },

  async deleteEvent(id) {
    const res = await fetch(`${API_BASE_URL}/events/${id}`, {
      method: 'DELETE',
      headers: { ...getAuthHeader() }
    });
    return await res.json();
  },

  // --- EMERGENCY ---
  async getEmergency() {
    try {
      const res = await fetch(`${API_BASE_URL}/emergency`);
      if (!res.ok) throw new Error('Impossible de charger les données.');
      return await res.json();
    } catch {
      return null;
    }
  },

  async addEmergency(contactData) {
    const res = await fetch(`${API_BASE_URL}/emergency`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify(contactData)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Impossible d’ajouter le contact.');
    return data;
  },

  async updateEmergency(id, contactData) {
    const res = await fetch(`${API_BASE_URL}/emergency/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify(contactData)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Impossible de modifier le contact.');
    return data;
  },

  async deleteEmergency(id) {
    const res = await fetch(`${API_BASE_URL}/emergency/${id}`, {
      method: 'DELETE',
      headers: { ...getAuthHeader() }
    });
    return await res.json();
  },

  // --- PHRASES UTILES ---
  async getPhrases() {
    try {
      const res = await fetch(`${API_BASE_URL}/phrases`);
      if (!res.ok) throw new Error('Impossible de charger les données.');
      return await res.json();
    } catch {
      return null;
    }
  },

  async getAllPhrases() {
    const res = await fetch(`${API_BASE_URL}/phrases/all`, {
      headers: { ...getAuthHeader() }
    });
    if (!res.ok) throw new Error('Impossible de charger les phrases.');
    return await res.json();
  },

  async reorderPhrases(category, orderedIds) {
    const res = await fetch(`${API_BASE_URL}/phrases/reorder`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify({ category, orderedIds })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur lors du réordonnancement des phrases.');
    return data;
  },

  async createPhrase(phraseData) {
    const res = await fetch(`${API_BASE_URL}/phrases`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify(phraseData)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur lors de l’ajout de la phrase.');
    return data;
  },

  async updatePhrase(id, phraseData) {
    const res = await fetch(`${API_BASE_URL}/phrases/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify(phraseData)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur lors de la modification de la phrase.');
    return data;
  },

  async deletePhrase(id) {
    const res = await fetch(`${API_BASE_URL}/phrases/${id}`, {
      method: 'DELETE',
      headers: { ...getAuthHeader() }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur lors de la suppression.');
    return data;
  },

  async generatePhraseAudio(id) {
    const res = await fetch(`${API_BASE_URL}/phrases/${id}/tts`, {
      method: 'POST',
      headers: { ...getAuthHeader() }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'La génération audio a échoué.');
    return data;
  },

  async generateMissingPhraseAudios() {
    const res = await fetch(`${API_BASE_URL}/phrases/tts-all`, {
      method: 'POST',
      headers: { ...getAuthHeader() }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'La génération audio a échoué.');
    return data;
  },

  async uploadPhraseAudio(id, file) {
    const formData = new FormData();
    formData.append('audioFile', file);
    const res = await fetch(`${API_BASE_URL}/phrases/${id}/audio`, {
      method: 'POST',
      headers: { ...getAuthHeader() },
      body: formData
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur lors du téléversement audio.');
    return data;
  },

  async deletePhraseAudio(id) {
    const res = await fetch(`${API_BASE_URL}/phrases/${id}/audio`, {
      method: 'DELETE',
      headers: { ...getAuthHeader() }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur lors de la suppression audio.');
    return data;
  },

  // --- STATS & TELEMETRY ---
  async syncSession(sessionData) {
    try {
      await fetch(`${API_BASE_URL}/stats/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sessionData)
      });
    } catch {}
  },

  async syncInteraction(interactionData) {
    try {
      await fetch(`${API_BASE_URL}/stats/interaction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(interactionData)
      });
    } catch {}
  },

  async getSummaryStats() {
    try {
      const res = await fetch(`${API_BASE_URL}/stats/summary`);
      if (!res.ok) throw new Error('Impossible de charger les statistiques.');
      return await res.json();
    } catch {
      return null;
    }
  },

  async clearStats() {
    const res = await fetch(`${API_BASE_URL}/stats/clear`, {
      method: 'DELETE',
      headers: { ...getAuthHeader() }
    });
    return await res.json();
  },

  // --- KIOSK CITY & CONFIGURATION ---
  async getKioskConfig() {
    try {
      const res = await fetch(`${API_BASE_URL}/config`);
      if (!res.ok) throw new Error('Impossible de charger la configuration.');
      return await res.json();
    } catch (e) {
      console.warn('Erreur getKioskConfig:', e);
      return {
        config: {
          active_city: '',
          active_region: '',
          active_lat: -18.7669,
          active_lng: 46.8691,
          active_country: 'Madagascar'
        },
        availableCities: []
      };
    }
  },

  async searchCity(query) {
    const res = await fetch(`${API_BASE_URL}/config/search-city`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify({ query })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Recherche de ville impossible.');
    return data;
  },

  async switchKioskCity(payload) {
    const res = await fetch(`${API_BASE_URL}/config/switch-city`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Déplacement du kiosque impossible.');
    return data;
  },

  async deleteCity(cityName) {
    const res = await fetch(`${API_BASE_URL}/config/city/${encodeURIComponent(cityName)}`, {
      method: 'DELETE',
      headers: { ...getAuthHeader() }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Suppression de la ville impossible.');
    return data;
  },

  async getIpLocation() {
    const res = await fetch(`${API_BASE_URL}/config/ip-location`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Localisation impossible.');
    return data;
  },

  async calibrateDeviceLocation(lat, lng) {
    const res = await fetch(`${API_BASE_URL}/config/calibrate-device`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat, lng })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Calibration GPS impossible.');
    return data;
  },

  async setKioskCoordinates(coords) {
    const res = await fetch(`${API_BASE_URL}/config/set-coordinates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify(coords)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Enregistrement des coordonnées impossible.');
    return data;
  }
};

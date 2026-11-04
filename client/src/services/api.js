const API_BASE_URL = 'http://localhost:5000/api';

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
    if (!res.ok) throw new Error(data.error || 'Erreur création compte.');
    return data;
  },

  async updateProfile(profileData) {
    const res = await fetch(`${API_BASE_URL}/auth/profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify(profileData)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur mise à jour profil.');
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
    if (!res.ok) throw new Error(data.error || 'Erreur suppression.');
    return data;
  },

  // --- ADVERTISEMENTS ---
  async getActiveAds() {
    try {
      const res = await fetch(`${API_BASE_URL}/ads`);
      if (!res.ok) throw new Error('API non disponible');
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
    if (!res.ok) throw new Error(data.error || 'Erreur lors de l’ajout.');
    return data;
  },

  async updateAd(id, formData) {
    const res = await fetch(`${API_BASE_URL}/ads/${id}`, {
      method: 'PUT',
      headers: { ...getAuthHeader() },
      body: formData
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur mise à jour.');
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
      if (!res.ok) throw new Error('Erreur');
      return await res.json();
    } catch {
      return null;
    }
  },

  async importOsmPlaces(city = 'Fianarantsoa') {
    const res = await fetch(`${API_BASE_URL}/places/import-osm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify({ city })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur importation OSM');
    return data;
  },

  async addPlace(formData) {
    const res = await fetch(`${API_BASE_URL}/places`, {
      method: 'POST',
      headers: { ...getAuthHeader() },
      body: formData
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur ajout lieu.');
    return data;
  },

  async updatePlace(id, formData) {
    const res = await fetch(`${API_BASE_URL}/places/${id}`, {
      method: 'PUT',
      headers: { ...getAuthHeader() },
      body: formData
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur mise à jour lieu.');
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
      if (!res.ok) throw new Error('Erreur');
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
    if (!res.ok) throw new Error(data.error || 'Erreur ajout événement.');
    return data;
  },

  async updateEvent(id, eventData) {
    const res = await fetch(`${API_BASE_URL}/events/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify(eventData)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur mise à jour événement.');
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
      if (!res.ok) throw new Error('Erreur');
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
    if (!res.ok) throw new Error(data.error || 'Erreur ajout contact urgence.');
    return data;
  },

  async updateEmergency(id, contactData) {
    const res = await fetch(`${API_BASE_URL}/emergency/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify(contactData)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur modification contact.');
    return data;
  },

  async deleteEmergency(id) {
    const res = await fetch(`${API_BASE_URL}/emergency/${id}`, {
      method: 'DELETE',
      headers: { ...getAuthHeader() }
    });
    return await res.json();
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
      if (!res.ok) throw new Error('Erreur stats');
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
      if (!res.ok) throw new Error('Erreur configuration kiosque');
      return await res.json();
    } catch (e) {
      console.warn('Erreur getKioskConfig:', e);
      return {
        config: {
          active_city: 'Fianarantsoa',
          active_region: 'Haute Matsiatra',
          active_lat: -21.4536,
          active_lng: 47.0858,
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
    if (!res.ok) throw new Error(data.error || 'Erreur recherche de ville.');
    return data;
  },

  async switchKioskCity(payload) {
    const res = await fetch(`${API_BASE_URL}/config/switch-city`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur déplacement du kiosque.');
    return data;
  },

  async deleteCity(cityName) {
    const res = await fetch(`${API_BASE_URL}/config/city/${encodeURIComponent(cityName)}`, {
      method: 'DELETE',
      headers: { ...getAuthHeader() }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur suppression de la ville.');
    return data;
  },

  async calibrateDeviceLocation(lat, lng) {
    const res = await fetch(`${API_BASE_URL}/config/calibrate-device`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat, lng })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur calibration position GPS.');
    return data;
  },

  async setKioskCoordinates(coords) {
    const res = await fetch(`${API_BASE_URL}/config/set-coordinates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify(coords)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur enregistrement coordonnées.');
    return data;
  }
};

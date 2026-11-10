const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { authMiddleware } = require('../middlewares/authMiddleware');
const {
  queryNominatim,
  reverseNominatim,
  normalizePlaceName,
  getDistanceMeters,
  fetchOsmElementsForCity,
  fetchEmergencyContactsForCity
} = require('../utils/osmImporter');

// 1. PUBLIC: Get current active city configuration & all stored cities
router.get('/', (req, res) => {
  try {
    const config = db.getActiveCityConfig();
    const availableCities = db.getAvailableCities();
    res.json({ config, availableCities });
  } catch (err) {
    res.status(500).json({ error: 'Erreur configuration.' });
  }
});

// 2. ADMIN: Search cities with disambiguation for homonyms (villes avec le même nom)
router.post('/search-city', authMiddleware, async (req, res) => {
  const query = (req.body.query || '').trim();
  if (!query) return res.status(400).json({ error: 'Nom de ville requis.' });

  try {
    const rawResults = await queryNominatim(`${query}, Madagascar`);

    // Disambiguate homonyms by grouping with Region / District
    const seenCombos = new Set();
    const disambiguated = [];

    for (const item of rawResults) {
      const addr = item.address || {};
      const cityName = addr.city || addr.town || addr.village || addr.municipality || item.display_name.split(',')[0].trim();
      const region = addr.state_district || addr.region || addr.county || 'Madagascar';
      const province = addr.state || '';

      const comboKey = `${cityName.toLowerCase()}_${region.toLowerCase()}`;
      if (!seenCombos.has(comboKey)) {
        seenCombos.add(comboKey);
        disambiguated.push({
          city: cityName,
          region,
          province,
          fullName: `${cityName} (${region}${province ? `, ${province}` : ''})`,
          lat: parseFloat(item.lat),
          lng: parseFloat(item.lon),
          rawAddress: item.display_name
        });
      }
    }

    res.json({ results: disambiguated });
  } catch (err) {
    console.error('City search error:', err);
    res.status(500).json({ error: 'Erreur recherche ville.' });
  }
});

// 3. ADMIN: Switch Kiosk City (Déménager le Kiosque vers une nouvelle ville)
router.post('/switch-city', authMiddleware, async (req, res) => {
  const { city, region, lat, lng, country } = req.body;
  if (!city || !city.trim()) {
    return res.status(400).json({ error: 'Nom de ville requis.' });
  }

  try {
    let parsedLat = parseFloat(lat);
    let parsedLng = parseFloat(lng);
    let finalRegion = (region || '').trim();

    // If lat or lng is missing or invalid, resolve from the registered city or Nominatim
    if (isNaN(parsedLat) || isNaN(parsedLng) || parsedLat === 0) {
      const registeredCity = db
        .prepare('SELECT lat, lng, region FROM cities WHERE LOWER(name) = LOWER(?)')
        .get(city.trim());
      if (registeredCity && Number.isFinite(registeredCity.lat) && Number.isFinite(registeredCity.lng)) {
        parsedLat = registeredCity.lat;
        parsedLng = registeredCity.lng;
        if (!finalRegion && registeredCity.region) finalRegion = registeredCity.region;
      } else {
        const existingGeo = db
          .prepare('SELECT lat, lng FROM places WHERE LOWER(city) = LOWER(?) AND lat IS NOT NULL AND lat != 0 LIMIT 1')
          .get(city.trim());
        if (existingGeo) {
          parsedLat = existingGeo.lat;
          parsedLng = existingGeo.lng;
        } else {
          const geoResults = await queryNominatim(`${city.trim()}, Madagascar`);
          if (geoResults && geoResults.length > 0) {
            parsedLat = parseFloat(geoResults[0].lat);
            parsedLng = parseFloat(geoResults[0].lon);
            if (!finalRegion) {
              const addr = geoResults[0].address || {};
              finalRegion = addr.state_district || addr.region || addr.county || 'Madagascar';
            }
          }
        }
      }
    }

    if (isNaN(parsedLat) || isNaN(parsedLng)) {
      parsedLat = -18.7669;
      parsedLng = 46.8691;
    }

    if (!finalRegion) {
      finalRegion = 'Madagascar';
    }

    // 1. Update active kiosk configuration
    const updatedConfig = db.setActiveCityConfig({
      city: city.trim(),
      region: finalRegion,
      lat: parsedLat,
      lng: parsedLng,
      country: country || 'Madagascar'
    });

    // 2. Check existing places and sites for this city
    const existingPlaces = db.prepare('SELECT count(*) as count FROM places WHERE LOWER(city) = LOWER(?)').get(city.trim()).count;
    const existingSites = db.prepare("SELECT count(*) as count FROM places WHERE LOWER(city) = LOWER(?) AND category NOT IN ('hotel', 'restaurant', 'cafe', 'bar', 'pizzeria', 'auberge', 'snack')").get(city.trim()).count;
    const existingEmergency = db.prepare('SELECT count(*) as count FROM emergency_contacts WHERE LOWER(city) = LOWER(?)').get(city.trim()).count;

    let importedCount = 0;
    // 3. If no places or few tourist sites exist yet for this city, automatically extract from OpenStreetMap
    if (existingPlaces === 0 || existingSites < 5) {
      console.log(`[KIOSK CITY SWITCH] Importing places for: ${city} (${parsedLat}, ${parsedLng})...`);
      const osmPlaces = await fetchOsmElementsForCity(city, parsedLat, parsedLng);

      const existingInDb = db.prepare('SELECT name, lat, lng FROM places WHERE LOWER(city) = LOWER(?)').all(city.trim());
      const acceptedPlaces = [];

      for (const p of osmPlaces) {
        const norm = normalizePlaceName(p.name);
        if (!norm || norm.length < 2) continue;

        const redundantWithDb = existingInDb.some((ex) => {
          const dist = getDistanceMeters(p.lat, p.lng, ex.lat, ex.lng);
          const sameNorm = normalizePlaceName(ex.name) === norm;
          return sameNorm || dist < 70;
        });
        if (redundantWithDb) continue;

        acceptedPlaces.push(p);
      }

      const insertPlace = db.prepare(`
        INSERT INTO places (
          id, category, name, desc_fr, desc_mg, desc_en,
          price_indicative, contact, lat, lng, rating,
          photo_url, distance_km, travel_time, itinerary_steps, google_maps_url, city
        ) VALUES (
          @id, @category, @name, @desc_fr, @desc_mg, @desc_en,
          @price_indicative, @contact, @lat, @lng, @rating,
          @photo_url, @distance_km, @travel_time, @itinerary_steps, @google_maps_url, @city
        )
      `);

      const tx = db.transaction((places) => {
        for (const p of places) {
          insertPlace.run({
            id: p.id || `kiosk_${city.toLowerCase().replace(/[^a-z0-9]/g, '')}_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
            category: p.category,
            name: p.name,
            desc_fr: p.desc_fr,
            desc_mg: `Toerana voatanisa ao ${city}.`,
            desc_en: `Point of interest in ${city}.`,
            price_indicative: p.price || 'Accès libre',
            contact: p.phone || '',
            lat: p.lat,
            lng: p.lng,
            rating: 4.6,
            photo_url: p.photo_url || '',
            distance_km: city,
            travel_time: 'Proche',
            itinerary_steps: `${p.name}, ${city}.`,
            google_maps_url: '',
            city: city.trim()
          });
          importedCount++;
        }
      });

      tx(acceptedPlaces);
      console.log(`[KIOSK CITY SWITCH] Inserted ${acceptedPlaces.length} new places for ${city}.`);
    }

    // 4. Auto-import emergency services if none exist for this city
    if (existingEmergency === 0) {
      console.log(`[KIOSK CITY SWITCH] Auto-importing emergency services for ${city}...`);
      const contacts = await fetchEmergencyContactsForCity(city, parsedLat, parsedLng);

      const insertEmergency = db.prepare(`
        INSERT OR IGNORE INTO emergency_contacts (name, number, address, icon, lat, lng, city, display_order)
        VALUES (@name, @number, @address, @icon, @lat, @lng, @city, @display_order)
      `);

      const emTx = db.transaction((list) => {
        let order = 0;
        for (const c of list) {
          insertEmergency.run({
            name: c.name,
            number: c.number || '',
            address: c.address || `${city}`,
            icon: c.icon || 'Ambulance',
            lat: c.lat,
            lng: c.lng,
            city: city.trim(),
            display_order: order++
          });
        }
      });
      emTx(contacts);
      console.log(`[KIOSK CITY SWITCH] Imported ${contacts.length} emergency contacts for ${city}.`);
    }

    const totalPlacesNow = db.prepare('SELECT count(*) as count FROM places WHERE LOWER(city) = LOWER(?)').get(city.trim()).count;
    const availableCities = db.getAvailableCities();
    res.json({
      success: true,
      config: updatedConfig,
      placesCount: totalPlacesNow,
      importedCount,
      availableCities,
      message: `Le kiosque est désormais configuré pour : ${city} (${finalRegion}).`
    });
  } catch (err) {
    console.error('Switch city error:', err);
    res.status(500).json({ error: 'Erreur changement de ville du kiosque.' });
  }
});

// 4. ADMIN: Delete a city from memory / SQLite database
router.delete('/city/:cityName', authMiddleware, (req, res) => {
  const cityName = (req.params.cityName || '').trim();
  if (!cityName) return res.status(400).json({ error: 'Nom de ville requis.' });

  try {
    const result = db.deleteCity(cityName);
    const availableCities = db.getAvailableCities();
    res.json({
      success: true,
      message: `La ville "${cityName}" a été supprimée de la mémoire (${result.deletedPlaces} lieux, ${result.deletedEmergency} urgences).`,
      availableCities,
      deleted: result
    });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Erreur lors de la suppression de la ville.' });
  }
});

router.post('/delete-city', authMiddleware, (req, res) => {
  const cityName = (req.body.city || req.body.cityName || '').trim();
  if (!cityName) return res.status(400).json({ error: 'Nom de ville requis.' });

  try {
    const result = db.deleteCity(cityName);
    const availableCities = db.getAvailableCities();
    res.json({
      success: true,
      message: `La ville "${cityName}" a été supprimée de la mémoire (${result.deletedPlaces} lieux, ${result.deletedEmergency} urgences).`,
      availableCities,
      deleted: result
    });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Erreur lors de la suppression de la ville.' });
  }
});

// 5. PUBLIC & ADMIN: Calibrate exact GPS position of this kiosk device (PC / Borne physique)
router.post('/calibrate-device', async (req, res) => {
  const { lat, lng } = req.body;
  const parsedLat = parseFloat(lat);
  const parsedLng = parseFloat(lng);
  if (isNaN(parsedLat) || isNaN(parsedLng)) {
    return res.status(400).json({ error: 'Coordonnées GPS invalides.' });
  }

  try {
    const rev = await reverseNominatim(parsedLat, parsedLng);
    const addr = rev?.address || {};
    const city = addr.city || addr.town || addr.village || addr.municipality || addr.county || 'Mon Emplacement';
    const region = addr.state_district || addr.region || addr.state || 'Madagascar';

    const updatedConfig = db.setActiveCityConfig({
      city: city,
      region: region,
      lat: parsedLat,
      lng: parsedLng,
      country: addr.country || 'Madagascar'
    });

    const availableCities = db.getAvailableCities();
    res.json({
      success: true,
      config: updatedConfig,
      availableCities,
      message: `Position GPS du kiosque calibrée avec succès sur votre appareil (${city}, ${parsedLat.toFixed(5)}, ${parsedLng.toFixed(5)}).`
    });
  } catch (err) {
    console.error('Calibrate device error:', err);
    res.status(500).json({ error: 'Erreur calibration position GPS.' });
  }
});

// 6. Set manual GPS coordinates directly for the active kiosk
router.post('/set-coordinates', authMiddleware, (req, res) => {
  const { lat, lng, city, region } = req.body;
  const parsedLat = parseFloat(lat);
  const parsedLng = parseFloat(lng);
  if (isNaN(parsedLat) || isNaN(parsedLng)) {
    return res.status(400).json({ error: 'Coordonnées GPS invalides.' });
  }

  try {
    const currentCfg = db.getActiveCityConfig();
    const updatedConfig = db.setActiveCityConfig({
      city: city || currentCfg.active_city,
      region: region || currentCfg.active_region,
      lat: parsedLat,
      lng: parsedLng,
      country: currentCfg.active_country || 'Madagascar'
    });
    res.json({
      success: true,
      config: updatedConfig,
      message: `Nouvel emplacement GPS enregistré : [${parsedLat}, ${parsedLng}]`
    });
  } catch (err) {
    res.status(500).json({ error: 'Erreur mise à jour coordonnées GPS.' });
  }
});

// 7. PUBLIC: IP-based Geolocation fallback when PC hardware lacks GPS receiver or browser blocks location
router.get('/ip-location', async (req, res) => {
  try {
    const http = require('http');
    const ipData = await new Promise((resolve) => {
      const request = http.get('http://ip-api.com/json', { timeout: 6000 }, (response) => {
        if (response.statusCode !== 200) {
          response.resume();
          return resolve(null);
        }
        const chunks = [];
        response.on('data', chunk => chunks.push(chunk));
        response.on('end', () => {
          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
          } catch {
            resolve(null);
          }
        });
      });
      request.on('timeout', () => { request.destroy(); resolve(null); });
      request.on('error', () => resolve(null));
    });

    if (ipData && ipData.status === 'success') {
      return res.json({
        success: true,
        source: 'ip',
        city: ipData.city || 'Antananarivo',
        region: ipData.regionName || 'Madagascar',
        lat: ipData.lat,
        lng: ipData.lon,
        country: ipData.country || 'Madagascar'
      });
    }

    res.status(404).json({ error: 'Géolocalisation IP indisponible.' });
  } catch (err) {
    res.status(500).json({ error: 'Erreur géolocalisation IP.' });
  }
});

module.exports = router;


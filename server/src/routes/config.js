const express = require('express');
const router = express.Router();
const https = require('https');
const db = require('../db/database');
const { authMiddleware } = require('../middlewares/authMiddleware');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function queryNominatim(queryStr) {
  return new Promise((resolve) => {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(queryStr)}&countrycodes=mg&format=json&addressdetails=1&extratags=1&limit=25`;
    const request = https.get(url, { 
      headers: { 
        'User-Agent': 'MadagascarTourismKiosk/3.0 (contact@eni.mg)',
        'Accept': 'application/json'
      },
      timeout: 8000
    }, (response) => {
      if (response.statusCode !== 200) {
        response.resume();
        return resolve([]);
      }
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => {
        try {
          const raw = Buffer.concat(chunks).toString('utf8');
          const data = JSON.parse(raw);
          resolve(Array.isArray(data) ? data : []);
        } catch {
          resolve([]);
        }
      });
    });
    request.on('timeout', () => {
      request.destroy();
      resolve([]);
    });
    request.on('error', () => resolve([]));
  });
}

function reverseNominatim(lat, lng) {
  return new Promise((resolve) => {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}&format=json&addressdetails=1`;
    const request = https.get(url, {
      headers: {
        'User-Agent': 'MadagascarTourismKiosk/3.0 (contact@eni.mg)',
        'Accept': 'application/json'
      },
      timeout: 8000
    }, (response) => {
      if (response.statusCode !== 200) {
        response.resume();
        return resolve(null);
      }
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => {
        try {
          const raw = Buffer.concat(chunks).toString('utf8');
          const data = JSON.parse(raw);
          resolve(data && typeof data === 'object' ? data : null);
        } catch {
          resolve(null);
        }
      });
    });
    request.on('timeout', () => {
      request.destroy();
      resolve(null);
    });
    request.on('error', () => resolve(null));
  });
}

// Extract real photograph URL from OpenStreetMap / Wikimedia metadata if available. Never invent fake photos!
function extractRealPhoto(item) {
  const tags = item.extratags || {};
  if (tags.image && (tags.image.startsWith('http://') || tags.image.startsWith('https://'))) {
    return tags.image;
  }
  if (tags.wikimedia_commons) {
    const cleanCommons = tags.wikimedia_commons.replace(/^File:/i, '');
    return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(cleanCommons)}?width=800`;
  }
  return '';
}

// Distance in meters between two lat/lng coordinates (Haversine formula)
function getDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

// Name normalizer to detect redundancies and duplicate entries
function normalizePlaceName(name) {
  if (!name) return '';
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\b(hotel|restaurant|chez|auberge|le|la|les|l'|bar|snack|pizzeria|cafe|villa|chambre)\b/g, '')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Extract real phone number from OSM Nominatim result (checks all known fields)
function extractPhone(item) {
  const ext = item.extratags || {};
  return (
    ext.phone ||
    ext['contact:phone'] ||
    ext['contact:mobile'] ||
    ext['phone:mobile'] ||
    ext['mobile'] ||
    item.address?.phone ||
    ''
  );
}

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

    // If lat or lng is missing or invalid, resolve from existing places or Nominatim
    if (isNaN(parsedLat) || isNaN(parsedLng) || parsedLat === 0) {
      const existingGeo = db.prepare('SELECT lat, lng FROM places WHERE city = ? AND lat IS NOT NULL AND lat != 0 LIMIT 1').get(city.trim());
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

    if (isNaN(parsedLat) || isNaN(parsedLng)) {
      parsedLat = -21.4536;
      parsedLng = 47.0858;
    }

    if (!finalRegion) {
      if (city.trim() === 'Fianarantsoa') finalRegion = 'Haute Matsiatra';
      else if (city.trim() === 'Manakara') finalRegion = 'Fitovinany';
      else if (city.trim() === 'Antsirabe') finalRegion = 'Vakinankaratra';
      else finalRegion = 'Madagascar';
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
    const existingPlaces = db.prepare('SELECT count(*) as count FROM places WHERE city = ?').get(city.trim()).count;
    const existingSites = db.prepare("SELECT count(*) as count FROM places WHERE city = ? AND category NOT IN ('hotel', 'restaurant', 'cafe', 'bar', 'pizzeria', 'auberge', 'snack')").get(city.trim()).count;
    const existingEmergency = db.prepare('SELECT count(*) as count FROM emergency_contacts WHERE city = ?').get(city.trim()).count;

    let importedCount = 0;
    // 3. If no places or few tourist sites exist yet for this city, automatically extract from OpenStreetMap with deduplication
    if (existingPlaces === 0 || existingSites < 5) {
      console.log(`[KIOSK CITY SWITCH] Importing places & tourist sites for city: ${city} (${parsedLat}, ${parsedLng})...`);

      const queries = [
        existingPlaces === 0 ? { key: 'hotels', q: `hotel in ${city}` } : null,
        existingPlaces === 0 ? { key: 'restos', q: `restaurant in ${city}` } : null,
        { key: 'gares', q: `gare ${city}` },
        { key: 'ponts', q: `pont ${city}` },
        { key: 'canaux', q: `canal ${city}` },
        { key: 'pangalanes', q: `Pangalanes ${city}` },
        { key: 'lacs', q: `lac ${city}` },
        { key: 'thermes', q: `thermes ${city}` },
        { key: 'parcs', q: `parc ${city}` },
        { key: 'cathedrales', q: `cathedrale ${city}` },
        { key: 'eglises', q: `eglise ${city}` },
        { key: 'monuments', q: `monument ${city}` },
        { key: 'marches', q: `marche ${city}` },
        { key: 'aeroport', q: `aeroport ${city}` }
      ].filter(Boolean);

      const resultsMap = {};
      for (const item of queries) {
        try {
          const res = await queryNominatim(item.q);
          resultsMap[item.key] = Array.isArray(res) ? res : [];
        } catch {
          resultsMap[item.key] = [];
        }
        await sleep(100); // 100ms anti-429 throttle
      }

      const osmHotels = resultsMap.hotels || [];
      const osmRestos = resultsMap.restos || [];
      const osmGares = resultsMap.gares || [];
      const osmPonts = resultsMap.ponts || [];
      const osmCanaux = resultsMap.canaux || [];
      const osmPangalanes = resultsMap.pangalanes || [];
      const osmLacs = resultsMap.lacs || [];
      const osmThermes = resultsMap.thermes || [];
      const osmParcs = resultsMap.parcs || [];
      const osmCathedrales = resultsMap.cathedrales || [];
      const osmEglises = resultsMap.eglises || [];
      const osmMonuments = resultsMap.monuments || [];
      const osmMarches = resultsMap.marches || [];
      const osmAeroPort = resultsMap.aeroport || [];

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

      const candidates = [];

      // Collect hotels
      for (const h of osmHotels) {
        const rawName = h.display_name.split(',')[0].trim();
        if (/ecole|college|lycee|school/i.test(rawName)) continue;
        candidates.push({
          rawName,
          category: 'hotel',
          lat: parseFloat(h.lat),
          lng: parseFloat(h.lon),
          phone: extractPhone(h),
          photo_url: extractRealPhoto(h),
          desc_fr: `Hébergement répertorié à ${city} sur OpenStreetMap & Google Maps.`,
          price: 'Tarif selon saison'
        });
      }

      // Collect restaurants
      for (const r of osmRestos) {
        const rawName = r.display_name.split(',')[0].trim();
        if (/ecole|college|lycee|school/i.test(rawName)) continue;
        candidates.push({
          rawName,
          category: 'restaurant',
          lat: parseFloat(r.lat),
          lng: parseFloat(r.lon),
          phone: extractPhone(r),
          photo_url: extractRealPhoto(r),
          desc_fr: `Restaurant et cuisine locale répertoriés à ${city} sur OpenStreetMap.`,
          price: 'Cuisine locale & variée'
        });
      }

      // Gares (Train & transport historique)
      for (const g of osmGares) {
        const rawName = g.display_name.split(',')[0].trim();
        if (/ecole|college|lycee|school/i.test(rawName)) continue;
        candidates.push({
          rawName,
          category: 'aventure',
          lat: parseFloat(g.lat),
          lng: parseFloat(g.lon),
          phone: extractPhone(g),
          photo_url: extractRealPhoto(g),
          desc_fr: `Gare ferroviaire et routière historique de ${city}, point de départ de circuits et découvertes.`,
          price: 'Accès public / Voyage'
        });
      }

      // Ponts remarquables
      for (const p of osmPonts) {
        const rawName = p.display_name.split(',')[0].trim();
        if (/ecole|college|lycee|school/i.test(rawName)) continue;
        candidates.push({
          rawName,
          category: 'patrimoine',
          lat: parseFloat(p.lat),
          lng: parseFloat(p.lon),
          phone: extractPhone(p),
          photo_url: extractRealPhoto(p),
          desc_fr: `Pont remarquable et ouvrage d'art emblématique à ${city}.`,
          price: 'Accès libre'
        });
      }

      // Canaux & Pangalanes
      for (const c of [...osmCanaux, ...osmPangalanes]) {
        const rawName = c.display_name.split(',')[0].trim();
        if (/ecole|college|lycee|school/i.test(rawName)) continue;
        candidates.push({
          rawName,
          category: 'aventure',
          lat: parseFloat(c.lat),
          lng: parseFloat(c.lon),
          phone: extractPhone(c),
          photo_url: extractRealPhoto(c),
          desc_fr: `Voie d'eau légendaire longeant la côte Est, balades en pirogue et nature.`,
          price: 'Excursion guidée / Pirogue'
        });
      }

      // Lacs & Thermes
      for (const l of [...osmLacs, ...osmThermes]) {
        const rawName = l.display_name.split(',')[0].trim();
        if (/ecole|college|lycee|school/i.test(rawName)) continue;
        candidates.push({
          rawName,
          category: 'nature',
          lat: parseFloat(l.lat),
          lng: parseFloat(l.lon),
          phone: extractPhone(l),
          photo_url: extractRealPhoto(l),
          desc_fr: `Site naturel d'exception, détente et découverte du paysage à ${city}.`,
          price: 'Accès libre / Détente'
        });
      }

      // Parcs & réserves
      for (const pk of osmParcs) {
        const rawName = pk.display_name.split(',')[0].trim();
        if (/ecole|college|lycee|school/i.test(rawName)) continue;
        candidates.push({
          rawName,
          category: 'nature',
          lat: parseFloat(pk.lat),
          lng: parseFloat(pk.lon),
          phone: extractPhone(pk),
          photo_url: extractRealPhoto(pk),
          desc_fr: `Espace vert, détente et biodiversité locale à ${city}.`,
          price: 'Visite & découverte'
        });
      }

      // Cathédrales & Églises historiques
      for (const e of [...osmCathedrales, ...osmEglises]) {
        const rawName = e.display_name.split(',')[0].trim();
        if (/ecole|college|lycee|school/i.test(rawName)) continue;
        candidates.push({
          rawName,
          category: 'religieux',
          lat: parseFloat(e.lat),
          lng: parseFloat(e.lon),
          phone: extractPhone(e),
          photo_url: extractRealPhoto(e),
          desc_fr: `Édifice religieux historique et patrimoine architectural au cœur de ${city}.`,
          price: 'Accès libre'
        });
      }

      // Monuments & Mémoriaux
      for (const m of osmMonuments) {
        const rawName = m.display_name.split(',')[0].trim();
        if (/ecole|college|lycee|school/i.test(rawName)) continue;
        candidates.push({
          rawName,
          category: 'patrimoine',
          lat: parseFloat(m.lat),
          lng: parseFloat(m.lon),
          phone: extractPhone(m),
          photo_url: extractRealPhoto(m),
          desc_fr: `Monument et lieu de mémoire emblématique de ${city}.`,
          price: 'Accès libre'
        });
      }

      // Marchés & artisanat
      for (const mk of osmMarches) {
        const rawName = mk.display_name.split(',')[0].trim();
        if (/ecole|college|lycee|school/i.test(rawName)) continue;
        candidates.push({
          rawName,
          category: 'marche',
          lat: parseFloat(mk.lat),
          lng: parseFloat(mk.lon),
          phone: extractPhone(mk),
          photo_url: extractRealPhoto(mk),
          desc_fr: `Marché populaire et animé, produits du terroir et artisanat local.`,
          price: 'Achats locaux'
        });
      }

      // Aéroports & transport
      for (const ap of osmAeroPort) {
        const rawName = ap.display_name.split(',')[0].trim();
        if (/ecole|college|lycee|school/i.test(rawName)) continue;
        candidates.push({
          rawName,
          category: 'aventure',
          lat: parseFloat(ap.lat),
          lng: parseFloat(ap.lon),
          phone: extractPhone(ap),
          photo_url: extractRealPhoto(ap),
          desc_fr: `Point d'accès et infrastructure de liaison pour la région de ${city}.`,
          price: 'Information transport'
        });
      }

      // DEDUPLICATION PIPELINE (Anti-redondance with existing DB items & batch candidates)
      const existingInDb = db.prepare('SELECT name, lat, lng FROM places WHERE city = ?').all(city.trim());
      const acceptedPlaces = [];

      for (const c of candidates) {
        const norm = normalizePlaceName(c.rawName);
        if (!norm || norm.length < 3) continue;

        // Check if redundant with already existing places in this city
        const redundantWithDb = existingInDb.some((ex) => {
          const dist = getDistanceMeters(c.lat, c.lng, ex.lat, ex.lng);
          const sameNorm = normalizePlaceName(ex.name) === norm;
          return sameNorm || dist < 70;
        });
        if (redundantWithDb) continue;

        // Check if redundant with already accepted candidate in this batch
        const isDuplicate = acceptedPlaces.some((existing) => {
          const dist = getDistanceMeters(c.lat, c.lng, existing.lat, existing.lng);
          const sameNorm = existing.norm === norm;
          const closeDist = dist < 70;
          return sameNorm || (closeDist && (existing.norm.includes(norm) || norm.includes(existing.norm)));
        });

        if (!isDuplicate) {
          acceptedPlaces.push({ ...c, norm });
        }
      }

      // Insert all deduplicated places
      const tx = db.transaction((places) => {
        for (const p of places) {
          insertPlace.run({
            id: `kiosk_${city.toLowerCase().replace(/[^a-z0-9]/g, '')}_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
            category: p.category,
            name: p.rawName,
            desc_fr: p.desc_fr || `Établissement répertorié à ${city} sur OpenStreetMap & Google Maps.`,
            desc_mg: `Toerana voatanisa ao ${city}.`,
            desc_en: `Establishment listed in ${city} via OpenStreetMap & Google Maps.`,
            price_indicative: p.price || (p.category === 'hotel' ? 'Tarif selon saison' : p.category === 'restaurant' ? 'Cuisine locale et variée' : 'Visite & découverte'),
            contact: p.phone,
            lat: p.lat,
            lng: p.lng,
            rating: 4.6,
            photo_url: p.photo_url,
            distance_km: `${city}`,
            travel_time: 'Proche',
            itinerary_steps: `Situé à ${p.rawName}, ${city}. Suivre l'itinéraire GPS.`,
            google_maps_url: `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`,
            city: city.trim()
          });
          importedCount++;
        }
      });

      tx(acceptedPlaces);
    }

    // 4. Auto-import emergency services from OSM if none exist for this city
    if (existingEmergency === 0) {
      console.log(`[KIOSK CITY SWITCH] Auto-importing emergency services for ${city}...`);

      const emergencySearchConfigs = [
        { key: 'hospitals', q: `hospital ${city}` },
        { key: 'police',    q: `police commissariat ${city}` },
        { key: 'gendarme',  q: `gendarmerie ${city}` },
        { key: 'fire',      q: `pompiers feu ${city}` },
        { key: 'pharmacy',  q: `pharmacie ${city}` },
        { key: 'clinic',    q: `clinique ${city}` }
      ];

      const emMap = {};
      for (const item of emergencySearchConfigs) {
        try {
          const res = await queryNominatim(item.q);
          emMap[item.key] = Array.isArray(res) ? res : [];
        } catch {
          emMap[item.key] = [];
        }
        await sleep(100);
      }

      const osmHospitals = emMap.hospitals || [];
      const osmPolice = emMap.police || [];
      const osmGendarme = emMap.gendarme || [];
      const osmFirestations = emMap.fire || [];
      const osmPharmacies = emMap.pharmacy || [];
      const osmClinics = emMap.clinic || [];

      const insertEmergency = db.prepare(`
        INSERT OR IGNORE INTO emergency_contacts (name, number, address, icon, lat, lng, city, display_order)
        VALUES (@name, @number, @address, @icon, @lat, @lng, @city, @display_order)
      `);

      const emergencyCandidates = [];

      // Map OSM results to emergency contact type
      const emergencyTypes = [
        { results: osmHospitals, icon: 'Ambulance', label: 'Hôpital', defaultNumber: '020' },
        { results: osmPolice,    icon: 'ShieldAlert', label: 'Police nationale', defaultNumber: '17' },
        { results: osmGendarme,  icon: 'ShieldAlert', label: 'Gendarmerie', defaultNumber: '17' },
        { results: osmFirestations, icon: 'Flame', label: 'Pompiers', defaultNumber: '18' },
        { results: osmPharmacies, icon: 'HeartPulse', label: 'Pharmacie', defaultNumber: '' },
        { results: osmClinics,   icon: 'Ambulance', label: 'Clinique', defaultNumber: '020' }
      ];

      const existingEmContacts = db.prepare('SELECT name, lat, lng FROM emergency_contacts WHERE city = ?').all(city.trim());
      let emOrder = 0;

      for (const { results, icon, label, defaultNumber } of emergencyTypes) {
        for (const item of results.slice(0, 3)) { // max 3 per type
          const rawName = item.display_name.split(',')[0].trim();
          const itemLat = parseFloat(item.lat);
          const itemLng = parseFloat(item.lon);
          const addr = (item.address?.road || item.address?.suburb || item.address?.city_district || city);
          const phone = extractPhone(item) || defaultNumber;

          // Dedup check
          const isDup = emergencyCandidates.some(e => {
            const d = getDistanceMeters(itemLat, itemLng, e.lat, e.lng);
            return d < 100;
          }) || existingEmContacts.some(e => {
            const d = getDistanceMeters(itemLat, itemLng, e.lat, e.lng);
            return d < 100;
          });

          if (!isDup && rawName.length > 2) {
            emergencyCandidates.push({
              name: rawName,
              number: phone,
              address: `${addr}, ${city}`,
              icon,
              lat: itemLat,
              lng: itemLng,
              city: city.trim(),
              display_order: emOrder++
            });
          }
        }
      }

      // Insert emergency contacts in a transaction
      const emTx = db.transaction((contacts) => {
        for (const c of contacts) {
          insertEmergency.run(c);
        }
      });
      emTx(emergencyCandidates);
      console.log(`[KIOSK CITY SWITCH] Imported ${emergencyCandidates.length} emergency contacts for ${city}.`);
    }

    const totalPlacesNow = db.prepare('SELECT count(*) as count FROM places WHERE city = ?').get(city.trim()).count;
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

module.exports = router;


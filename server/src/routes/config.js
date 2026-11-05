const express = require('express');
const router = express.Router();
const https = require('https');
const db = require('../db/database');
const { authMiddleware } = require('../middlewares/authMiddleware');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ─────────────────────────────────────────────────────────────────────────────
// Overpass API — returns rich OSM tag data (phone, image, website, description…)
// Much richer than Nominatim extratags for contact & photo retrieval.
// ─────────────────────────────────────────────────────────────────────────────
function queryOverpass(overpassQL) {
  return new Promise((resolve) => {
    const postData = `data=${encodeURIComponent(overpassQL)}`;
    const options = {
      hostname: 'overpass-api.de',
      path: '/api/interpreter',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
        'User-Agent': 'MadagascarTourismKiosk/3.0 (contact@eni.mg)'
      },
      timeout: 25000
    };
    const request = https.request(options, (response) => {
      if (response.statusCode !== 200) {
        response.resume();
        return resolve({ elements: [] });
      }
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => {
        try {
          const raw = Buffer.concat(chunks).toString('utf8');
          const data = JSON.parse(raw);
          resolve(data && Array.isArray(data.elements) ? data : { elements: [] });
        } catch {
          resolve({ elements: [] });
        }
      });
    });
    request.on('timeout', () => { request.destroy(); resolve({ elements: [] }); });
    request.on('error', () => resolve({ elements: [] }));
    request.write(postData);
    request.end();
  });
}

// Nominatim — kept for city geocoding / reverse geocoding only
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

// Extract real photograph URL from OSM tags (Overpass or Nominatim). Never invent fake photos!
function extractRealPhoto(tags) {
  // tags can be from Overpass (element.tags) or Nominatim (item.extratags)
  if (!tags) return '';
  if (tags.image && (tags.image.startsWith('http://') || tags.image.startsWith('https://'))) {
    return tags.image;
  }
  if (tags.wikimedia_commons) {
    const cleanCommons = tags.wikimedia_commons.replace(/^File:/i, '');
    return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(cleanCommons)}?width=800`;
  }
  return '';
}

// Extract phone from Overpass tags object (much richer than Nominatim)
function extractPhone(tags) {
  if (!tags) return '';
  return (
    tags.phone ||
    tags['contact:phone'] ||
    tags['contact:mobile'] ||
    tags['phone:mobile'] ||
    tags['mobile'] ||
    ''
  );
}

// Generate a meaningful, category-aware description — no boilerplate "OSM & Google Maps" text
function generateDescription(tags, category, cityName) {
  if (!tags) tags = {};
  const descFr = tags['description:fr'] || tags.description;
  if (descFr) return descFr;

  const stars = tags.stars ? ` ${tags.stars} étoile(s).` : '';
  const cuisine = tags.cuisine ? `, cuisine ${tags.cuisine}` : '';
  const rooms = tags.rooms ? `, ${tags.rooms} chambres` : '';
  const capacity = tags.capacity ? `, capacité ${tags.capacity}` : '';
  const historic = tags.historic;
  const tourism = tags.tourism;
  const amenity = tags.amenity;
  const natural = tags.natural;
  const leisure = tags.leisure;

  if (category === 'hotel' || tourism === 'hotel') return `Hébergement à ${cityName}.${stars}${rooms}`;
  if (tourism === 'hostel') return `Auberge de jeunesse à ${cityName}.${rooms}`;
  if (tourism === 'guest_house') return `Chambre d'hôtes à ${cityName}.${rooms}`;
  if (category === 'restaurant' || amenity === 'restaurant') return `Restaurant à ${cityName}${cuisine}.`;
  if (amenity === 'cafe' || category === 'cafe') return `Café et salon de thé à ${cityName}${cuisine}.`;
  if (amenity === 'bar' || category === 'bar') return `Bar à ${cityName}.`;
  if (historic === 'monument' || historic === 'memorial') return `Monument historique emblématique de ${cityName}.`;
  if (historic === 'ruins') return `Ruines historiques à découvrir à ${cityName}.`;
  if (historic === 'castle') return `Forteresse et patrimoine royal de ${cityName}.`;
  if (tourism === 'museum') return `Musée et collections culturelles à ${cityName}.`;
  if (tourism === 'attraction') return `Site touristique incontournable de ${cityName}.`;
  if (tourism === 'viewpoint') return `Belvédère avec vue panoramique sur ${cityName}.`;
  if (natural === 'lake' || natural === 'water') return `Plan d'eau naturel aux abords de ${cityName}.`;
  if (natural === 'hot_spring') return `Sources thermales et détente naturelle à ${cityName}.`;
  if (natural === 'park' || leisure === 'nature_reserve') return `Espace naturel et biodiversité locale à ${cityName}.`;
  if (amenity === 'place_of_worship') return `Édifice religieux historique au cœur de ${cityName}.`;
  if (amenity === 'marketplace' || category === 'marche') return `Marché animé, produits locaux et artisanat de ${cityName}.`;
  if (amenity === 'station' || tags.railway) return `Gare ferroviaire, point de départ d'excursions depuis ${cityName}.`;
  if (category === 'nature') return `Site naturel remarquable à ${cityName}.`;
  if (category === 'patrimoine') return `Site patrimonial et culturel de ${cityName}.`;
  if (category === 'religieux') return `Lieu de culte et patrimoine religieux de ${cityName}.`;
  if (category === 'aventure') return `Point d'intérêt et aventure à ${cityName}.`;
  return `Établissement répertorié à ${cityName}.`;
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
    // 3. If no places or few tourist sites exist yet for this city, automatically extract from OpenStreetMap via Overpass API
    if (existingPlaces === 0 || existingSites < 5) {
      console.log(`[KIOSK CITY SWITCH] Importing places via Overpass API for: ${city} (${parsedLat}, ${parsedLng})...`);

      // Overpass query: fetch nodes & ways within 15km radius around city coords
      const radius = 15000;
      const overpassQuery = `[out:json][timeout:25];
(
  node[tourism=hotel](around:${radius},${parsedLat},${parsedLng});
  node[tourism=hostel](around:${radius},${parsedLat},${parsedLng});
  node[tourism=guest_house](around:${radius},${parsedLat},${parsedLng});
  node[amenity=restaurant](around:${radius},${parsedLat},${parsedLng});
  node[amenity=cafe](around:${radius},${parsedLat},${parsedLng});
  node[tourism=attraction](around:${radius},${parsedLat},${parsedLng});
  node[tourism=museum](around:${radius},${parsedLat},${parsedLng});
  node[tourism=viewpoint](around:${radius},${parsedLat},${parsedLng});
  node[historic=monument](around:${radius},${parsedLat},${parsedLng});
  node[historic=memorial](around:${radius},${parsedLat},${parsedLng});
  node[historic=ruins](around:${radius},${parsedLat},${parsedLng});
  node[historic=castle](around:${radius},${parsedLat},${parsedLng});
  node[natural=lake](around:${radius},${parsedLat},${parsedLng});
  node[natural=hot_spring](around:${radius},${parsedLat},${parsedLng});
  node[leisure=park](around:${radius},${parsedLat},${parsedLng});
  node[leisure=nature_reserve](around:${radius},${parsedLat},${parsedLng});
  node[amenity=place_of_worship](around:${radius},${parsedLat},${parsedLng});
  node[amenity=marketplace](around:${radius},${parsedLat},${parsedLng});
  node[railway=station](around:${radius},${parsedLat},${parsedLng});
  node[aeroway=aerodrome](around:${radius},${parsedLat},${parsedLng});
  node[waterway=canal](around:${radius},${parsedLat},${parsedLng});
  node[bridge=yes](around:${radius},${parsedLat},${parsedLng});
);
out body;`;

      const overpassResult = await queryOverpass(overpassQuery);
      const elements = overpassResult.elements || [];
      console.log(`[KIOSK CITY SWITCH] Overpass returned ${elements.length} elements for ${city}.`);

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

      // Map Overpass element to our category
      function mapCategory(tags) {
        if (!tags) return 'patrimoine';
        const { tourism, amenity, historic, natural, leisure, railway, aeroway, waterway, bridge } = tags;
        if (tourism === 'hotel' || tourism === 'hostel' || tourism === 'guest_house') return 'hotel';
        if (amenity === 'restaurant') return 'restaurant';
        if (amenity === 'cafe') return 'cafe';
        if (amenity === 'bar') return 'bar';
        if (tourism === 'museum') return 'patrimoine';
        if (tourism === 'attraction' || tourism === 'viewpoint') return 'nature';
        if (historic) return 'patrimoine';
        if (natural === 'lake' || natural === 'hot_spring') return 'nature';
        if (leisure === 'park' || leisure === 'nature_reserve') return 'nature';
        if (amenity === 'place_of_worship') return 'religieux';
        if (amenity === 'marketplace') return 'marche';
        if (railway === 'station') return 'aventure';
        if (aeroway === 'aerodrome') return 'aventure';
        if (waterway === 'canal') return 'aventure';
        if (bridge === 'yes') return 'patrimoine';
        return 'patrimoine';
      }

      function defaultPrice(category) {
        if (category === 'hotel') return 'Tarif selon saison';
        if (category === 'restaurant' || category === 'cafe' || category === 'bar') return 'Cuisine locale et variée';
        if (category === 'marche') return 'Achats locaux';
        return 'Accès libre';
      }

      const candidates = [];
      for (const el of elements) {
        const tags = el.tags || {};
        const rawName = tags['name:fr'] || tags.name || tags['name:mg'] || '';
        if (!rawName || rawName.length < 2) continue;
        // Filter out schools, offices, etc.
        if (/ecole|college|lycee|school|bureau|office|mairie|prefecture/i.test(rawName)) continue;
        const elLat = el.lat || (el.center && el.center.lat) || null;
        const elLng = el.lon || (el.center && el.center.lon) || null;
        if (!elLat || !elLng) continue;

        const category = mapCategory(tags);
        const descFr = generateDescription(tags, category, city);
        const phone = extractPhone(tags);
        const photo_url = extractRealPhoto(tags);

        candidates.push({
          rawName,
          category,
          lat: parseFloat(elLat),
          lng: parseFloat(elLng),
          phone,
          photo_url,
          desc_fr: descFr,
          price: defaultPrice(category),
          tags
        });
      }

      // DEDUPLICATION PIPELINE
      const existingInDb = db.prepare('SELECT name, lat, lng FROM places WHERE LOWER(city) = LOWER(?)').all(city.trim());
      const acceptedPlaces = [];

      for (const c of candidates) {
        const norm = normalizePlaceName(c.rawName);
        if (!norm || norm.length < 3) continue;

        const redundantWithDb = existingInDb.some((ex) => {
          const dist = getDistanceMeters(c.lat, c.lng, ex.lat, ex.lng);
          const sameNorm = normalizePlaceName(ex.name) === norm;
          return sameNorm || dist < 70;
        });
        if (redundantWithDb) continue;

        const isDuplicate = acceptedPlaces.some((existing) => {
          const dist = getDistanceMeters(c.lat, c.lng, existing.lat, existing.lng);
          const sameNorm = existing.norm === norm;
          return sameNorm || (dist < 70 && (existing.norm.includes(norm) || norm.includes(existing.norm)));
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
            desc_fr: p.desc_fr,
            desc_mg: `Toerana voatanisa ao ${city}.`,
            desc_en: `Point of interest in ${city}.`,
            price_indicative: p.price,
            contact: p.phone,
            lat: p.lat,
            lng: p.lng,
            rating: 4.6,
            photo_url: p.photo_url,
            distance_km: city,
            travel_time: 'Proche',
            itinerary_steps: `${p.rawName}, ${city}.`,
            google_maps_url: '',
            city: city.trim()
          });
          importedCount++;
        }
      });

      tx(acceptedPlaces);
      console.log(`[KIOSK CITY SWITCH] Inserted ${acceptedPlaces.length} new places for ${city} (Overpass).`);
    }

    // 4. Auto-import emergency services from Overpass if none exist for this city
    if (existingEmergency === 0) {
      console.log(`[KIOSK CITY SWITCH] Auto-importing emergency services via Overpass for ${city}...`);

      const radius = 15000;
      const emQuery = `[out:json][timeout:25];
(
  node[amenity=hospital](around:${radius},${parsedLat},${parsedLng});
  node[amenity=clinic](around:${radius},${parsedLat},${parsedLng});
  node[amenity=doctors](around:${radius},${parsedLat},${parsedLng});
  node[amenity=pharmacy](around:${radius},${parsedLat},${parsedLng});
  node[amenity=police](around:${radius},${parsedLat},${parsedLng});
  node[amenity=fire_station](around:${radius},${parsedLat},${parsedLng});
);
out body;`;

      const emResult = await queryOverpass(emQuery);
      const emElements = emResult.elements || [];

      const insertEmergency = db.prepare(`
        INSERT OR IGNORE INTO emergency_contacts (name, number, address, icon, lat, lng, city, display_order)
        VALUES (@name, @number, @address, @icon, @lat, @lng, @city, @display_order)
      `);

      const emergencyCandidates = [];
      const existingEmContacts = db.prepare('SELECT name, lat, lng FROM emergency_contacts WHERE LOWER(city) = LOWER(?)').all(city.trim());
      let emOrder = 0;

      // Map OSM amenity tags to emergency contact metadata
      function emIcon(amenity) {
        if (amenity === 'hospital' || amenity === 'clinic' || amenity === 'doctors') return 'Ambulance';
        if (amenity === 'police') return 'ShieldAlert';
        if (amenity === 'fire_station') return 'Flame';
        if (amenity === 'pharmacy') return 'HeartPulse';
        return 'Ambulance';
      }
      function emDefaultNumber(amenity) {
        if (amenity === 'hospital' || amenity === 'clinic') return '020';
        if (amenity === 'police') return '17';
        if (amenity === 'fire_station') return '18';
        return '';
      }

      for (const el of emElements) {
        const tags = el.tags || {};
        const rawName = tags['name:fr'] || tags.name || tags['name:mg'] || '';
        if (!rawName || rawName.length < 2) continue;
        const itemLat = el.lat || (el.center && el.center.lat) || null;
        const itemLng = el.lon || (el.center && el.center.lon) || null;
        if (!itemLat || !itemLng) continue;

        const amenity = tags.amenity || '';
        const phone = extractPhone(tags) || emDefaultNumber(amenity);
        const addr = tags['addr:street'] || tags['addr:suburb'] || city;

        const isDup = emergencyCandidates.some(e => {
          return getDistanceMeters(itemLat, itemLng, e.lat, e.lng) < 100;
        }) || existingEmContacts.some(e => {
          return getDistanceMeters(itemLat, itemLng, e.lat, e.lng) < 100;
        });

        if (!isDup) {
          emergencyCandidates.push({
            name: rawName,
            number: phone,
            address: `${addr}, ${city}`,
            icon: emIcon(amenity),
            lat: parseFloat(itemLat),
            lng: parseFloat(itemLng),
            city: city.trim(),
            display_order: emOrder++
          });
        }
      }

      // Insert emergency contacts in a transaction
      const emTx = db.transaction((contacts) => {
        for (const c of contacts) {
          insertEmergency.run(c);
        }
      });
      emTx(emergencyCandidates);
      console.log(`[KIOSK CITY SWITCH] Imported ${emergencyCandidates.length} emergency contacts for ${city} (Overpass).`);
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


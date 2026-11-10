const https = require('https');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Distance in meters between two lat/lng coordinates (Haversine formula)
function getDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
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

// ─────────────────────────────────────────────────────────────────────────────
// Overpass API — with fast timeout so kiosk doesn't hang if Overpass is down
// ─────────────────────────────────────────────────────────────────────────────
function queryOverpass(overpassQL, timeoutMs = 4000) {
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
      timeout: timeoutMs
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

// ─────────────────────────────────────────────────────────────────────────────
// Nominatim API — ultra-fast & reliable in Madagascar
// ─────────────────────────────────────────────────────────────────────────────
function queryNominatim(queryStr, limit = 20) {
  return new Promise((resolve) => {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(queryStr)}&countrycodes=mg&format=json&addressdetails=1&extratags=1&limit=${limit}`;
    const request = https.get(url, {
      headers: {
        'User-Agent': 'MadagascarTourismKiosk/3.0 (contact@eni.mg)',
        'Accept': 'application/json'
      },
      timeout: 7000
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
      timeout: 7000
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

// ─────────────────────────────────────────────────────────────────────────────
// Wikipedia REST API — authentic photos & summaries
// ─────────────────────────────────────────────────────────────────────────────
function fetchWikiSummary(title) {
  return new Promise((resolve) => {
    if (!title) return resolve(null);
    const cleanTitle = encodeURIComponent(title.replace(/\s+/g, '_'));
    const url = `https://fr.wikipedia.org/api/rest_v1/page/summary/${cleanTitle}`;
    const request = https.get(url, {
      headers: {
        'User-Agent': 'MadagascarTourismKiosk/3.0 (contact@eni.mg)',
        'Accept': 'application/json'
      },
      timeout: 3500
    }, (response) => {
      if (response.statusCode !== 200) {
        response.resume();
        return resolve(null);
      }
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => {
        try {
          const json = JSON.parse(Buffer.concat(chunks).toString('utf8'));
          resolve({
            photo: json.thumbnail ? json.thumbnail.source : '',
            description: json.extract || ''
          });
        } catch {
          resolve(null);
        }
      });
    });
    request.on('timeout', () => { request.destroy(); resolve(null); });
    request.on('error', () => resolve(null));
  });
}

// Extract real photograph URL from OSM tags or extratags. Never invent fake photos!
function extractRealPhoto(tags) {
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

// Extract phone from tags object
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

// Map OSM tags to our category schema
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
  if (waterway === 'canal') return 'nature';
  if (bridge === 'yes') return 'patrimoine';
  return 'patrimoine';
}

function defaultPrice(category) {
  if (category === 'hotel') return 'Tarif selon saison';
  if (category === 'restaurant' || category === 'cafe' || category === 'bar') return 'Cuisine locale et variée';
  if (category === 'marche') return 'Achats locaux';
  return 'Accès libre';
}

// Generate a meaningful, category-aware description
function generateDescription(tags, category, cityName) {
  if (!tags) tags = {};
  const descFr = tags['description:fr'] || tags.description;
  if (descFr) return descFr;

  const stars = tags.stars ? ` ${tags.stars} étoile(s).` : '';
  const cuisine = tags.cuisine ? `, cuisine ${tags.cuisine}` : '';
  const rooms = tags.rooms ? `, ${tags.rooms} chambres` : '';
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
  if (tags.waterway === 'canal') return `Canal historique et voies navigables à ${cityName}.`;
  if (category === 'nature') return `Site naturel remarquable à ${cityName}.`;
  if (category === 'patrimoine') return `Site patrimonial et culturel de ${cityName}.`;
  if (category === 'religieux') return `Lieu de culte et patrimoine religieux de ${cityName}.`;
  if (category === 'aventure') return `Point d'intérêt et aventure à ${cityName}.`;
  return `Établissement répertorié à ${cityName}.`;
}

// ─────────────────────────────────────────────────────────────────────────────
// High-resilient multi-tier place extraction (Overpass -> Nominatim -> Wikipedia)
// ─────────────────────────────────────────────────────────────────────────────
async function fetchOsmElementsForCity(city, lat, lng) {
  const radius = 18000;
  let candidates = [];

  // Step 1: Try Overpass with 3.5s timeout
  console.log(`[OSM ENGINE] Attempting Overpass API for ${city} (${lat}, ${lng})...`);
  const overpassQuery = `[out:json][timeout:5];
(
  node[tourism=hotel](around:${radius},${lat},${lng});
  node[tourism=hostel](around:${radius},${lat},${lng});
  node[tourism=guest_house](around:${radius},${lat},${lng});
  node[amenity=restaurant](around:${radius},${lat},${lng});
  node[amenity=cafe](around:${radius},${lat},${lng});
  node[tourism=attraction](around:${radius},${lat},${lng});
  node[tourism=museum](around:${radius},${lat},${lng});
  node[tourism=viewpoint](around:${radius},${lat},${lng});
  node[historic=monument](around:${radius},${lat},${lng});
  node[historic=memorial](around:${radius},${lat},${lng});
  node[historic=ruins](around:${radius},${lat},${lng});
  node[historic=castle](around:${radius},${lat},${lng});
  node[natural=lake](around:${radius},${lat},${lng});
  node[natural=hot_spring](around:${radius},${lat},${lng});
  node[leisure=park](around:${radius},${lat},${lng});
  node[leisure=nature_reserve](around:${radius},${lat},${lng});
  node[amenity=place_of_worship](around:${radius},${lat},${lng});
  node[amenity=marketplace](around:${radius},${lat},${lng});
  node[railway=station](around:${radius},${lat},${lng});
  node[aeroway=aerodrome](around:${radius},${lat},${lng});
  node[waterway=canal](around:${radius},${lat},${lng});
  node[bridge=yes](around:${radius},${lat},${lng});
);
out body;`;

  try {
    const overpassResult = await queryOverpass(overpassQuery, 3500);
    const elements = overpassResult.elements || [];
    if (elements.length > 0) {
      console.log(`[OSM ENGINE] Overpass responded with ${elements.length} elements for ${city}.`);
      for (const el of elements) {
        const tags = el.tags || {};
        const rawName = tags['name:fr'] || tags.name || tags['name:mg'] || '';
        if (!rawName || rawName.length < 2) continue;
        if (/ecole|college|lycee|school|bureau|office|mairie|prefecture/i.test(rawName)) continue;
        const elLat = el.lat || (el.center && el.center.lat);
        const elLng = el.lon || (el.center && el.center.lon);
        if (!elLat || !elLng) continue;

        const category = mapCategory(tags);
        candidates.push({
          id: `osm_${el.type || 'node'}_${el.id}`,
          name: rawName,
          category,
          lat: parseFloat(elLat),
          lng: parseFloat(elLng),
          phone: extractPhone(tags),
          photo_url: extractRealPhoto(tags),
          desc_fr: generateDescription(tags, category, city),
          price: defaultPrice(category)
        });
      }
    }
  } catch (err) {
    console.warn('[OSM ENGINE] Overpass query failed or timed out:', err.message);
  }

  // Step 2: If Overpass failed, timed out, or returned 0 elements, use Nominatim batch queries
  if (candidates.length === 0) {
    console.log(`[OSM ENGINE] Overpass returned 0 elements. Falling back to Nominatim pipeline for ${city}...`);
    const searchDefinitions = [
      { q: `hotel in ${city}`, cat: 'hotel' },
      { q: `restaurant in ${city}`, cat: 'restaurant' },
      { q: `cafe in ${city}`, cat: 'cafe' },
      { q: `monument ${city}`, cat: 'patrimoine' },
      { q: `pont ${city}`, cat: 'patrimoine' },
      { q: `gare ${city}`, cat: 'aventure' },
      { q: `canal ${city}`, cat: 'nature' },
      { q: `parc ${city}`, cat: 'nature' },
      { q: `marche ${city}`, cat: 'marche' },
      { q: `aeroport ${city}`, cat: 'aventure' },
      { q: `attraction ${city}`, cat: 'nature' }
    ];

    for (const item of searchDefinitions) {
      const results = await queryNominatim(item.q, 15);
      for (const r of results) {
        const rawName = r.name || (r.display_name ? r.display_name.split(',')[0].trim() : '');
        if (!rawName || rawName.length < 2) continue;
        if (/ecole|college|lycee|school|bureau|office|mairie|prefecture/i.test(rawName)) continue;

        const itemLat = parseFloat(r.lat);
        const itemLng = parseFloat(r.lon);
        if (isNaN(itemLat) || isNaN(itemLng)) continue;

        // Ensure within ~35 km radius from city center
        if (lat && lng) {
          const dist = getDistanceMeters(lat, lng, itemLat, itemLng);
          if (dist > 35000) continue;
        }

        const tags = r.extratags || {};
        const category = item.cat || mapCategory(tags);
        const phone = extractPhone(tags);
        let photo_url = extractRealPhoto(tags);

        candidates.push({
          id: `osm_${r.osm_type || 'node'}_${r.osm_id || Math.floor(Math.random() * 1000000)}`,
          name: rawName,
          category,
          lat: itemLat,
          lng: itemLng,
          phone,
          photo_url,
          desc_fr: generateDescription(tags, category, city),
          price: defaultPrice(category),
          wikipediaTag: tags.wikipedia || null
        });
      }
      // Brief pause to respect Nominatim rate limit
      await sleep(150);
    }
  }

  // Step 3: Deduplicate candidates among themselves
  const accepted = [];
  for (const c of candidates) {
    const norm = normalizePlaceName(c.name);
    if (!norm || norm.length < 2) continue;

    const isDuplicate = accepted.some((existing) => {
      const dist = getDistanceMeters(c.lat, c.lng, existing.lat, existing.lng);
      const sameNorm = normalizePlaceName(existing.name) === norm;
      return sameNorm || (dist < 70 && (normalizePlaceName(existing.name).includes(norm) || norm.includes(normalizePlaceName(existing.name))));
    });

    if (!isDuplicate) {
      accepted.push(c);
    }
  }

  // Step 4: Wikipedia & Wikimedia enrichment for authentic photos & descriptions (fast parallel batch)
  const toEnrich = accepted.filter(p => !p.photo_url && (p.wikipediaTag || ['nature', 'patrimoine', 'aventure'].includes(p.category))).slice(0, 6);
  await Promise.allSettled(toEnrich.map(async (p) => {
    try {
      const queryKey = p.wikipediaTag ? p.wikipediaTag.replace(/^[a-z]+:/i, '') : p.name;
      const wikiData = await fetchWikiSummary(queryKey);
      if (wikiData && wikiData.photo) {
        p.photo_url = wikiData.photo;
        if (wikiData.description) {
          p.desc_fr = wikiData.description;
        }
      }
    } catch {}
  }));

  console.log(`[OSM ENGINE] Total deduplicated places resolved for ${city}: ${accepted.length}`);
  return accepted;
}

// ─────────────────────────────────────────────────────────────────────────────
// Emergency contacts extraction (Overpass -> Nominatim)
// ─────────────────────────────────────────────────────────────────────────────
async function fetchEmergencyContactsForCity(city, lat, lng) {
  const radius = 18000;
  let candidates = [];

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

  // Step 1: Overpass with 3.5s timeout
  console.log(`[EMERGENCY ENGINE] Attempting Overpass API for emergency contacts in ${city}...`);
  const emQuery = `[out:json][timeout:5];
(
  node[amenity=hospital](around:${radius},${lat},${lng});
  node[amenity=clinic](around:${radius},${lat},${lng});
  node[amenity=doctors](around:${radius},${lat},${lng});
  node[amenity=pharmacy](around:${radius},${lat},${lng});
  node[amenity=police](around:${radius},${lat},${lng});
  node[amenity=fire_station](around:${radius},${lat},${lng});
);
out body;`;

  try {
    const emResult = await queryOverpass(emQuery, 3500);
    const elements = emResult.elements || [];
    if (elements.length > 0) {
      console.log(`[EMERGENCY ENGINE] Overpass responded with ${elements.length} emergency contacts for ${city}.`);
      for (const el of elements) {
        const tags = el.tags || {};
        const rawName = tags['name:fr'] || tags.name || tags['name:mg'] || '';
        if (!rawName || rawName.length < 2) continue;
        const itemLat = el.lat || (el.center && el.center.lat);
        const itemLng = el.lon || (el.center && el.center.lon);
        if (!itemLat || !itemLng) continue;

        const amenity = tags.amenity || '';
        const phone = extractPhone(tags) || emDefaultNumber(amenity);
        const addr = tags['addr:street'] || tags['addr:suburb'] || city;

        candidates.push({
          name: rawName,
          number: phone,
          address: `${addr}, ${city}`,
          icon: emIcon(amenity),
          lat: parseFloat(itemLat),
          lng: parseFloat(itemLng)
        });
      }
    }
  } catch (err) {
    console.warn('[EMERGENCY ENGINE] Overpass emergency query failed:', err.message);
  }

  // Step 2: Fallback to Nominatim if Overpass returned 0 elements
  if (candidates.length === 0) {
    console.log(`[EMERGENCY ENGINE] Falling back to Nominatim for emergency services in ${city}...`);
    const emQueries = [
      { q: `hospital in ${city}`, icon: 'Ambulance', defaultPhone: '020' },
      { q: `CSB ${city}`, icon: 'Ambulance', defaultPhone: '020' },
      { q: `pharmacy in ${city}`, icon: 'HeartPulse', defaultPhone: '' },
      { q: `police in ${city}`, icon: 'ShieldAlert', defaultPhone: '17' },
      { q: `gendarmerie in ${city}`, icon: 'ShieldAlert', defaultPhone: '17' },
      { q: `pompiers in ${city}`, icon: 'Flame', defaultPhone: '18' }
    ];

    for (const item of emQueries) {
      const res = await queryNominatim(item.q, 8);
      for (const r of res) {
        const rawName = r.name || (r.display_name ? r.display_name.split(',')[0].trim() : '');
        if (!rawName || rawName.length < 2) continue;
        const itemLat = parseFloat(r.lat);
        const itemLng = parseFloat(r.lon);
        if (isNaN(itemLat) || isNaN(itemLng)) continue;

        if (lat && lng) {
          const dist = getDistanceMeters(lat, lng, itemLat, itemLng);
          if (dist > 35000) continue;
        }

        const tags = r.extratags || {};
        const phone = extractPhone(tags) || item.defaultPhone;
        const addr = (r.address && (r.address.road || r.address.suburb || r.address.town)) || city;

        candidates.push({
          name: rawName,
          number: phone,
          address: `${addr}, ${city}`,
          icon: item.icon,
          lat: itemLat,
          lng: itemLng
        });
      }
      await sleep(150);
    }
  }

  // Step 3: Deduplicate emergency contacts
  const accepted = [];
  for (const c of candidates) {
    const isDup = accepted.some(a => {
      const dist = getDistanceMeters(c.lat, c.lng, a.lat, a.lng);
      return a.name.toLowerCase() === c.name.toLowerCase() || dist < 80;
    });
    if (!isDup) {
      accepted.push(c);
    }
  }

  console.log(`[EMERGENCY ENGINE] Total emergency contacts resolved for ${city}: ${accepted.length}`);
  return accepted;
}

module.exports = {
  getDistanceMeters,
  normalizePlaceName,
  queryNominatim,
  reverseNominatim,
  fetchWikiSummary,
  extractRealPhoto,
  extractPhone,
  fetchOsmElementsForCity,
  fetchEmergencyContactsForCity
};

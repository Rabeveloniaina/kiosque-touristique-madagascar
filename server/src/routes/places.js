const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const https = require('https');
const db = require('../db/database');
const { authMiddleware } = require('../middlewares/authMiddleware');

const uploadsDir = path.resolve(__dirname, '../../uploads');
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, 'place-' + Date.now() + ext);
  }
});
const upload = multer({ storage });

// 1. PUBLIC: Get places with scope filtering ('sites' vs 'hospitality') or specific category for active city
router.get('/', (req, res) => {
  try {
    const { category, scope, city } = req.query;
    const activeCity = city || db.getActiveCityConfig().active_city;

    let query = 'SELECT * FROM places WHERE LOWER(city) = LOWER(?)';
    let params = [activeCity];

    if (category && category !== 'all') {
      query += ' AND category = ?';
      params.push(category);
    } else if (scope === 'sites') {
      // Sites touristiques & Itinéraires uniquement (tout lieu touristique hors hébergement / restauration pure)
      query += ` AND category NOT IN ('hotel', 'restaurant', 'cafe', 'bar', 'pizzeria', 'auberge', 'snack')`;
    } else if (scope === 'hospitality') {
      // Hôtels, hébergements, restaurants, guides & transports
      query += ` AND category IN ('hotel', 'restaurant', 'cafe', 'bar', 'pizzeria', 'auberge', 'snack', 'guide', 'transport', 'boutique')`;
    }

    query += ' ORDER BY rating DESC, name ASC';

    const places = db.prepare(query).all(...params);
    res.json(places);
  } catch (err) {
    res.status(500).json({ error: 'Erreur lecture des lieux.' });
  }
});

// 2. ADMIN: Import places automatically from OpenStreetMap for ANY city (Overpass API — richer data)
router.post('/import-osm', authMiddleware, async (req, res) => {
  const city = String(req.body.city || db.getActiveCityConfig().active_city || '').trim();
  if (!city) {
    return res.status(400).json({ error: "Aucune ville active. Choisissez d'abord une ville pour le kiosque." });
  }

  // Overpass API — provides full OSM tag data: phone, image, website, description, stars, cuisine…
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
        timeout: 30000
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

  function generateDescription(tags, category, cityName) {
    if (!tags) tags = {};
    const descFr = tags['description:fr'] || tags.description;
    if (descFr) return descFr;
    const stars = tags.stars ? ` ${tags.stars} étoile(s).` : '';
    const cuisine = tags.cuisine ? `, cuisine ${tags.cuisine}` : '';
    const rooms = tags.rooms ? `, ${tags.rooms} chambres` : '';
    if (category === 'hotel') return `Hébergement à ${cityName}.${stars}${rooms}`;
    if (category === 'restaurant') return `Restaurant à ${cityName}${cuisine}.`;
    if (category === 'cafe') return `Café et salon de thé à ${cityName}${cuisine}.`;
    if (category === 'bar') return `Bar à ${cityName}.`;
    if (tags.historic === 'monument' || tags.historic === 'memorial') return `Monument historique emblématique de ${cityName}.`;
    if (tags.historic === 'ruins') return `Ruines historiques à découvrir à ${cityName}.`;
    if (tags.historic === 'castle') return `Forteresse et patrimoine royal de ${cityName}.`;
    if (tags.tourism === 'museum') return `Musée et collections culturelles à ${cityName}.`;
    if (tags.tourism === 'attraction') return `Site touristique incontournable de ${cityName}.`;
    if (tags.tourism === 'viewpoint') return `Belvédère avec vue panoramique sur ${cityName}.`;
    if (tags.natural === 'lake') return `Plan d'eau naturel aux abords de ${cityName}.`;
    if (tags.natural === 'hot_spring') return `Sources thermales et détente naturelle à ${cityName}.`;
    if (tags.leisure === 'park' || tags.leisure === 'nature_reserve') return `Espace naturel et biodiversité locale à ${cityName}.`;
    if (tags.amenity === 'place_of_worship') return `Édifice religieux historique au cœur de ${cityName}.`;
    if (tags.amenity === 'marketplace') return `Marché animé, produits locaux et artisanat de ${cityName}.`;
    if (tags.railway === 'station') return `Gare ferroviaire, point de départ d'excursions depuis ${cityName}.`;
    if (tags.aeroway === 'aerodrome') return `Aérodrome et infrastructure aérienne de ${cityName}.`;
    return `Établissement répertorié à ${cityName}.`;
  }

  function mapCategory(tags) {
    if (!tags) return 'patrimoine';
    const { tourism, amenity, historic, natural, leisure, railway, aeroway } = tags;
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
    return 'patrimoine';
  }

  try {
    // Resolve city coordinates
    let cityLat = null, cityLng = null;
    const cityRow = db.prepare('SELECT lat, lng FROM cities WHERE LOWER(name) = LOWER(?)').get(city);
    if (cityRow && cityRow.lat && cityRow.lng) {
      cityLat = cityRow.lat;
      cityLng = cityRow.lng;
    } else {
      const cfg = db.getActiveCityConfig();
      if (cfg && cfg.active_lat && cfg.active_lng) {
        cityLat = cfg.active_lat;
        cityLng = cfg.active_lng;
      } else {
        const placeRow = db.prepare('SELECT lat, lng FROM places WHERE LOWER(city) = LOWER(?) AND lat IS NOT NULL LIMIT 1').get(city);
        if (placeRow) { cityLat = placeRow.lat; cityLng = placeRow.lng; }
      }
    }

    if (!cityLat || !cityLng) {
      return res.status(400).json({ error: `Coordonnées GPS de ${city} introuvables. Utilisez "Changer de ville" d'abord pour géolocaliser la ville.` });
    }

    console.log(`[OSM IMPORT] Starting Overpass API search for ${city} (${cityLat}, ${cityLng})...`);

    const radius = 15000;
    const overpassQuery = `[out:json][timeout:30];
(
  node[tourism=hotel](around:${radius},${cityLat},${cityLng});
  node[tourism=hostel](around:${radius},${cityLat},${cityLng});
  node[tourism=guest_house](around:${radius},${cityLat},${cityLng});
  node[amenity=restaurant](around:${radius},${cityLat},${cityLng});
  node[amenity=cafe](around:${radius},${cityLat},${cityLng});
  node[tourism=attraction](around:${radius},${cityLat},${cityLng});
  node[tourism=museum](around:${radius},${cityLat},${cityLng});
  node[tourism=viewpoint](around:${radius},${cityLat},${cityLng});
  node[historic=monument](around:${radius},${cityLat},${cityLng});
  node[historic=memorial](around:${radius},${cityLat},${cityLng});
  node[historic=ruins](around:${radius},${cityLat},${cityLng});
  node[historic=castle](around:${radius},${cityLat},${cityLng});
  node[natural=lake](around:${radius},${cityLat},${cityLng});
  node[natural=hot_spring](around:${radius},${cityLat},${cityLng});
  node[leisure=park](around:${radius},${cityLat},${cityLng});
  node[leisure=nature_reserve](around:${radius},${cityLat},${cityLng});
  node[amenity=place_of_worship](around:${radius},${cityLat},${cityLng});
  node[amenity=marketplace](around:${radius},${cityLat},${cityLng});
  node[railway=station](around:${radius},${cityLat},${cityLng});
  node[aeroway=aerodrome](around:${radius},${cityLat},${cityLng});
);
out body;`;

    const overpassResult = await queryOverpass(overpassQuery);
    const elements = overpassResult.elements || [];
    console.log(`[OSM IMPORT] Overpass returned ${elements.length} elements for ${city}.`);

    const insertPlace = db.prepare(`
      INSERT OR IGNORE INTO places (
        id, category, name, desc_fr, desc_mg, desc_en,
        price_indicative, contact, lat, lng, rating,
        photo_url, distance_km, travel_time, itinerary_steps, google_maps_url, city
      ) VALUES (
        @id, @category, @name, @desc_fr, @desc_mg, @desc_en,
        @price_indicative, @contact, @lat, @lng, @rating,
        @photo_url, @distance_km, @travel_time, @itinerary_steps, @google_maps_url, @city
      )
    `);

    let importedCount = 0;
    const items = [];

    for (const el of elements) {
      const tags = el.tags || {};
      const cleanName = tags['name:fr'] || tags.name || tags['name:mg'] || '';
      if (!cleanName || cleanName.length < 2) continue;
      if (/ecole|college|lycee|school|bureau|mairie|prefecture/i.test(cleanName)) continue;

      const lat = el.lat || (el.center && el.center.lat) || null;
      const lng = el.lon || (el.center && el.center.lon) || null;
      if (!lat || !lng) continue;

      const category = mapCategory(tags);
      const desc_fr = generateDescription(tags, category, city);
      const phone = extractPhone(tags);
      const photo_url = extractRealPhoto(tags);
      const id = `osm_${el.type}_${el.id}`;

      let price_indicative = 'Accès libre';
      if (category === 'hotel') price_indicative = tags.rooms ? `${tags.rooms} chambres — tarif selon saison` : 'Tarif sur demande';
      if (category === 'restaurant' || category === 'cafe' || category === 'bar') price_indicative = 'Cuisine locale et variée';
      if (category === 'marche') price_indicative = 'Achats locaux';

      items.push({
        id,
        category,
        name: cleanName,
        desc_fr,
        desc_mg: `Toerana voatanisa ao ${city}.`,
        desc_en: `Point of interest in ${city}.`,
        price_indicative,
        contact: phone,
        lat: parseFloat(lat),
        lng: parseFloat(lng),
        rating: 4.5,
        photo_url,
        distance_km: city,
        travel_time: 'Proche centre',
        itinerary_steps: `${cleanName}, ${city}.`,
        google_maps_url: '',
        city
      });
    }

    const tx = db.transaction((rows) => {
      for (const row of rows) {
        const result = insertPlace.run(row);
        if (result.changes > 0) importedCount++;
      }
    });

    tx(items);

    // Update city coords if not yet set
    if (items.length > 0) {
      db.upsertCity({ name: city, lat: cityLat, lng: cityLng });
    }

    res.json({
      success: true,
      city,
      totalFound: items.length,
      importedCount,
      message: `${items.length} établissements trouvés sur OpenStreetMap pour ${city} (${importedCount} nouveaux enregistrés).`
    });
  } catch (err) {
    console.error('OSM import error:', err);
    res.status(500).json({ error: "Erreur lors de l'importation OpenStreetMap." });
  }
});

// 3. ADMIN: Add a new place with itinerary
router.post('/', authMiddleware, upload.single('photoFile'), (req, res) => {
  try {
    const name = req.body.name;
    const category = req.body.category || 'patrimoine';
    const desc_fr = req.body.desc_fr;
    const desc_mg = req.body.desc_mg;
    const desc_en = req.body.desc_en;
    const price_indicative = req.body.price_indicative;
    const contact = req.body.contact;
    const distance_km = req.body.distance_km;
    const travel_time = req.body.travel_time;
    const itinerary_steps = req.body.itinerary_steps;
    const activeConfig = db.getActiveCityConfig();
    const lat = parseFloat(req.body.lat) || activeConfig.active_lat || -18.7669;
    const lng = parseFloat(req.body.lng) || activeConfig.active_lng || 46.8691;
    const rating = parseFloat(req.body.rating) || 4.7;

    let photo_url = req.body.photo_url;
    if (req.file) {
      photo_url = `http://localhost:5000/uploads/${req.file.filename}`;
    }

    const city = String(req.body.city || activeConfig.active_city || '').trim();
    if (!city) {
      return res.status(400).json({ error: "Aucune ville active. Choisissez d'abord une ville pour le kiosque." });
    }
    const id = 'place_' + Date.now();

    const insert = db.prepare(`
      INSERT INTO places (
        id, category, name, desc_fr, desc_mg, desc_en,
        price_indicative, contact, lat, lng, rating,
        photo_url, distance_km, travel_time, itinerary_steps, google_maps_url, city
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insert.run(
      id, category, name, desc_fr, desc_mg || desc_fr, desc_en || desc_fr,
      price_indicative || '', contact || '', lat, lng, rating,
      photo_url || '',
      distance_km || '', travel_time || '', itinerary_steps || '', '',
      city
    );

    db.upsertCity({ name: city, lat, lng });

    const newPlace = db.prepare('SELECT * FROM places WHERE id = ?').get(id);
    res.status(201).json(newPlace);
  } catch (err) {
    console.error('Add place error:', err);
    res.status(500).json({ error: 'Erreur création du lieu.' });
  }
});

// 4. ADMIN: Edit a place
router.put('/:id', authMiddleware, upload.single('photoFile'), (req, res) => {
  try {
    const { id } = req.params;
    const existing = db.prepare('SELECT * FROM places WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ error: 'Lieu introuvable.' });

    const name = req.body.name || existing.name;
    const category = req.body.category || existing.category;
    const desc_fr = req.body.desc_fr !== undefined ? req.body.desc_fr : existing.desc_fr;
    const desc_mg = req.body.desc_mg !== undefined ? req.body.desc_mg : existing.desc_mg;
    const desc_en = req.body.desc_en !== undefined ? req.body.desc_en : existing.desc_en;
    const price_indicative = req.body.price_indicative !== undefined ? req.body.price_indicative : existing.price_indicative;
    const contact = req.body.contact !== undefined ? req.body.contact : existing.contact;
    const distance_km = req.body.distance_km !== undefined ? req.body.distance_km : existing.distance_km;
    const travel_time = req.body.travel_time !== undefined ? req.body.travel_time : existing.travel_time;
    const itinerary_steps = req.body.itinerary_steps !== undefined ? req.body.itinerary_steps : existing.itinerary_steps;
    const lat = req.body.lat !== undefined ? parseFloat(req.body.lat) : existing.lat;
    const lng = req.body.lng !== undefined ? parseFloat(req.body.lng) : existing.lng;
    const rating = req.body.rating !== undefined ? parseFloat(req.body.rating) : existing.rating;

    let photo_url = existing.photo_url;
    if (req.file) {
      photo_url = `http://localhost:5000/uploads/${req.file.filename}`;
    } else if (req.body.photo_url) {
      photo_url = req.body.photo_url;
    }

    db.prepare(`
      UPDATE places SET
        name = ?, category = ?, desc_fr = ?, desc_mg = ?, desc_en = ?,
        price_indicative = ?, contact = ?, lat = ?, lng = ?, rating = ?,
        photo_url = ?, distance_km = ?, travel_time = ?, itinerary_steps = ?
      WHERE id = ?
    `).run(
      name, category, desc_fr, desc_mg, desc_en,
      price_indicative, contact, lat, lng, rating,
      photo_url, distance_km, travel_time, itinerary_steps,
      id
    );

    const updated = db.prepare('SELECT * FROM places WHERE id = ?').get(id);
    res.json(updated);
  } catch (err) {
    console.error('Update place error:', err);
    res.status(500).json({ error: 'Erreur mise à jour lieu.' });
  }
});

// 5. ADMIN: Delete a place
router.delete('/:id', authMiddleware, (req, res) => {
  try {
    const { id } = req.params;
    db.prepare('DELETE FROM places WHERE id = ?').run(id);
    res.json({ success: true, message: 'Lieu supprimé avec succès.' });
  } catch (err) {
    res.status(500).json({ error: 'Erreur suppression du lieu.' });
  }
});

module.exports = router;

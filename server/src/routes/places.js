const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const db = require('../db/database');
const { authMiddleware } = require('../middlewares/authMiddleware');
const {
  fetchOsmElementsForCity,
  normalizePlaceName,
  getDistanceMeters,
  queryNominatim
} = require('../utils/osmImporter');

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

// 2. ADMIN: Import places automatically from OpenStreetMap for ANY city (Overpass -> Nominatim -> Wikipedia)
router.post('/import-osm', authMiddleware, async (req, res) => {
  const city = String(req.body.city || db.getActiveCityConfig().active_city || '').trim();
  if (!city) {
    return res.status(400).json({ error: "Aucune ville active. Choisissez d'abord une ville pour le kiosque." });
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
      if (cfg && cfg.active_city && cfg.active_city.toLowerCase() === city.toLowerCase() && cfg.active_lat && cfg.active_lng) {
        cityLat = cfg.active_lat;
        cityLng = cfg.active_lng;
      } else {
        const placeRow = db.prepare('SELECT lat, lng FROM places WHERE LOWER(city) = LOWER(?) AND lat IS NOT NULL LIMIT 1').get(city);
        if (placeRow) { cityLat = placeRow.lat; cityLng = placeRow.lng; }
      }
    }

    if (!cityLat || !cityLng) {
      const geo = await queryNominatim(`${city}, Madagascar`);
      if (geo && geo.length > 0) {
        cityLat = parseFloat(geo[0].lat);
        cityLng = parseFloat(geo[0].lon);
      }
    }

    if (!cityLat || !cityLng) {
      cityLat = -18.7669;
      cityLng = 46.8691;
    }

    console.log(`[OSM MANUAL IMPORT] Starting place extraction for ${city} (${cityLat}, ${cityLng})...`);
    const osmPlaces = await fetchOsmElementsForCity(city, cityLat, cityLng);

    const existingInDb = db.prepare('SELECT name, lat, lng FROM places WHERE LOWER(city) = LOWER(?)').all(city);
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
    const accepted = [];

    for (const p of osmPlaces) {
      const norm = normalizePlaceName(p.name);
      if (!norm || norm.length < 2) continue;

      const isDuplicate = existingInDb.some((ex) => {
        const dist = getDistanceMeters(p.lat, p.lng, ex.lat, ex.lng);
        const sameNorm = normalizePlaceName(ex.name) === norm;
        return sameNorm || dist < 70;
      });

      if (!isDuplicate) {
        accepted.push(p);
      }
    }

    const tx = db.transaction((rows) => {
      for (const row of rows) {
        const result = insertPlace.run({
          id: row.id,
          category: row.category,
          name: row.name,
          desc_fr: row.desc_fr,
          desc_mg: `Toerana voatanisa ao ${city}.`,
          desc_en: `Point of interest in ${city}.`,
          price_indicative: row.price || 'Accès libre',
          contact: row.phone || '',
          lat: row.lat,
          lng: row.lng,
          rating: 4.6,
          photo_url: row.photo_url || '',
          distance_km: city,
          travel_time: 'Proche centre',
          itinerary_steps: `${row.name}, ${city}.`,
          google_maps_url: '',
          city
        });
        if (result.changes > 0) importedCount++;
      }
    });

    tx(accepted);

    // Update city coords if not yet set
    if (accepted.length > 0) {
      db.upsertCity({ name: city, lat: cityLat, lng: cityLng });
    }

    res.json({
      success: true,
      city,
      totalFound: osmPlaces.length,
      importedCount,
      message: `${osmPlaces.length} établissements trouvés sur OpenStreetMap pour ${city} (${importedCount} nouveaux enregistrés).`
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

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

function fixUtf8(str) {
  if (!str || typeof str !== 'string') return str || '';
  // Only convert if it looks like UTF-8 bytes wrongly interpreted as latin1 (mojibake)
  if (/[\xC2-\xC3][\x80-\xBF]/.test(str)) {
    try {
      const decoded = Buffer.from(str, 'latin1').toString('utf8');
      if (!decoded.includes('\uFFFD')) return decoded;
    } catch {}
  }
  return str;
}

// 1. PUBLIC: Get places with scope filtering ('sites' vs 'hospitality') or specific category for active city
router.get('/', (req, res) => {
  try {
    const { category, scope, city } = req.query;
    const activeCity = city || db.getActiveCityConfig().active_city;

    let query = 'SELECT * FROM places WHERE city = ?';
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

// 2. ADMIN: Import places automatically from OpenStreetMap for ANY city (e.g. Fianarantsoa)
router.post('/import-osm', authMiddleware, async (req, res) => {
  const city = (req.body.city || 'Fianarantsoa').trim();

  function queryNominatim(queryStr) {
    return new Promise((resolve) => {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(queryStr)}&countrycodes=mg&format=json&addressdetails=1&extratags=1&limit=25`;
      const request = https.get(url, { headers: { 'User-Agent': 'FianarKioskApp/1.0 (contact@eni.mg)' } }, (response) => {
        const chunks = [];
        response.on('data', chunk => chunks.push(chunk));
        response.on('end', () => {
          try {
            const raw = Buffer.concat(chunks).toString('utf8');
            resolve(JSON.parse(raw));
          } catch {
            resolve([]);
          }
        });
      });
      request.on('error', () => resolve([]));
    });
  }

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

  try {
    console.log(`[OSM IMPORT] Starting OpenStreetMap search for ${city}...`);
    const [osmHotels, osmRestos] = await Promise.all([
      queryNominatim(`hotel in ${city}`),
      queryNominatim(`restaurant in ${city}`)
    ]);

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

    // Process Hotels
    for (const h of osmHotels) {
      const cleanName = h.display_name.split(',')[0].trim();
      const id = 'osm_hotel_' + h.osm_id;
      const lat = parseFloat(h.lat);
      const lng = parseFloat(h.lon);
      items.push({
        id,
        category: 'hotel',
        name: cleanName,
        desc_fr: `Hébergement répertorié à ${city} sur OpenStreetMap & Google Maps.`,
        desc_mg: `Toeram-ponenana voatanisa ao ${city}.`,
        desc_en: `Accommodation listed in ${city} via OpenStreetMap & Google Maps.`,
        price_indicative: 'Tarif sur demande',
        contact: extractPhone(h),
        lat,
        lng,
        rating: 4.5,
        photo_url: extractRealPhoto(h),
        distance_km: `${city} intra-muros`,
        travel_time: 'Proche centre',
        itinerary_steps: `Situé à ${cleanName}, ${city}. Suivre la navigation GPS.`,
        google_maps_url: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
        city
      });
    }

    // Process Restaurants
    for (const r of osmRestos) {
      const cleanName = r.display_name.split(',')[0].trim();
      const id = 'osm_resto_' + r.osm_id;
      const lat = parseFloat(r.lat);
      const lng = parseFloat(r.lon);
      items.push({
        id,
        category: 'restaurant',
        name: cleanName,
        desc_fr: `Restaurant et table locale répertorié à ${city} sur OpenStreetMap & Google Maps.`,
        desc_mg: `Toeram-pisakafoanana ao ${city}.`,
        desc_en: `Restaurant and dining spot listed in ${city} via OpenStreetMap & Google Maps.`,
        price_indicative: 'Cuisine locale & variée',
        contact: extractPhone(r),
        lat,
        lng,
        rating: 4.6,
        photo_url: extractRealPhoto(r),
        distance_km: `${city}`,
        travel_time: 'Proche centre',
        itinerary_steps: `Situé à ${cleanName}, ${city}. Suivre la navigation GPS.`,
        google_maps_url: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
        city
      });
    }

    const tx = db.transaction((rows) => {
      for (const row of rows) {
        const res = insertPlace.run(row);
        if (res.changes > 0) importedCount++;
      }
    });

    tx(items);

    res.json({
      success: true,
      city,
      totalFound: items.length,
      importedCount,
      message: `${items.length} établissements trouvés sur OpenStreetMap pour ${city} (${importedCount} nouveaux enregistrés).`
    });
  } catch (err) {
    console.error('OSM import error:', err);
    res.status(500).json({ error: 'Erreur lors de l’importation OpenStreetMap.' });
  }
});

// 3. ADMIN: Add a new place with itinerary
router.post('/', authMiddleware, upload.single('photoFile'), (req, res) => {
  try {
    const name = fixUtf8(req.body.name);
    const category = req.body.category || 'patrimoine';
    const desc_fr = fixUtf8(req.body.desc_fr);
    const desc_mg = fixUtf8(req.body.desc_mg);
    const desc_en = fixUtf8(req.body.desc_en);
    const price_indicative = fixUtf8(req.body.price_indicative);
    const contact = fixUtf8(req.body.contact);
    const distance_km = fixUtf8(req.body.distance_km);
    const travel_time = fixUtf8(req.body.travel_time);
    const itinerary_steps = fixUtf8(req.body.itinerary_steps);
    const lat = parseFloat(req.body.lat) || -21.4536;
    const lng = parseFloat(req.body.lng) || 47.0858;
    const rating = parseFloat(req.body.rating) || 4.7;

    let photo_url = req.body.photo_url;
    if (req.file) {
      photo_url = `http://localhost:5000/uploads/${req.file.filename}`;
    }

    const city = req.body.city || db.getActiveCityConfig().active_city;
    const id = 'place_' + Date.now();
    const google_maps_url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

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
      photo_url || 'https://images.unsplash.com/photo-1547471080-7cc2caa01a7e?w=800',
      distance_km || '', travel_time || '', itinerary_steps || '', google_maps_url,
      city
    );

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

    const name = fixUtf8(req.body.name) || existing.name;
    const category = req.body.category || existing.category;
    const desc_fr = fixUtf8(req.body.desc_fr) !== undefined ? fixUtf8(req.body.desc_fr) : existing.desc_fr;
    const desc_mg = fixUtf8(req.body.desc_mg) !== undefined ? fixUtf8(req.body.desc_mg) : existing.desc_mg;
    const desc_en = fixUtf8(req.body.desc_en) !== undefined ? fixUtf8(req.body.desc_en) : existing.desc_en;
    const price_indicative = fixUtf8(req.body.price_indicative) !== undefined ? fixUtf8(req.body.price_indicative) : existing.price_indicative;
    const contact = fixUtf8(req.body.contact) !== undefined ? fixUtf8(req.body.contact) : existing.contact;
    const distance_km = fixUtf8(req.body.distance_km) !== undefined ? fixUtf8(req.body.distance_km) : existing.distance_km;
    const travel_time = fixUtf8(req.body.travel_time) !== undefined ? fixUtf8(req.body.travel_time) : existing.travel_time;
    const itinerary_steps = fixUtf8(req.body.itinerary_steps) !== undefined ? fixUtf8(req.body.itinerary_steps) : existing.itinerary_steps;
    const lat = req.body.lat !== undefined ? parseFloat(req.body.lat) : existing.lat;
    const lng = req.body.lng !== undefined ? parseFloat(req.body.lng) : existing.lng;
    const rating = req.body.rating !== undefined ? parseFloat(req.body.rating) : existing.rating;

    let photo_url = existing.photo_url;
    if (req.file) {
      photo_url = `http://localhost:5000/uploads/${req.file.filename}`;
    } else if (req.body.photo_url) {
      photo_url = req.body.photo_url;
    }

    const google_maps_url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

    db.prepare(`
      UPDATE places SET
        name = ?, category = ?, desc_fr = ?, desc_mg = ?, desc_en = ?,
        price_indicative = ?, contact = ?, lat = ?, lng = ?, rating = ?,
        photo_url = ?, distance_km = ?, travel_time = ?, itinerary_steps = ?, google_maps_url = ?
      WHERE id = ?
    `).run(
      name, category, desc_fr, desc_mg, desc_en,
      price_indicative, contact, lat, lng, rating,
      photo_url, distance_km, travel_time, itinerary_steps, google_maps_url,
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

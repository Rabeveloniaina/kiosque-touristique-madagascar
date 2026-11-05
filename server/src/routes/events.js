const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { authMiddleware } = require('../middlewares/authMiddleware');

// 1. PUBLIC: Get events for active city (with is_expired flag)
router.get('/', (req, res) => {
  try {
    const { city } = req.query;
    const activeCity = city || db.getActiveCityConfig().active_city;
    const today = new Date().toISOString().split('T')[0];
    const events = db.prepare(`
      SELECT *, 
        CASE WHEN event_date < ? THEN 1 ELSE 0 END as is_expired
      FROM events
      WHERE LOWER(city) = LOWER(?)
      ORDER BY event_date ASC
    `).all(today, activeCity);

    res.json(events);
  } catch (err) {
    res.status(500).json({ error: 'Erreur lecture événements.' });
  }
});

// 2. ADMIN: Add an event (prevents past dates!)
router.post('/', authMiddleware, (req, res) => {
  try {
    const title_fr = req.body.title_fr;
    const title_mg = req.body.title_mg;
    const title_en = req.body.title_en;
    const description_fr = req.body.description_fr;
    const location = req.body.location;
    const event_date = req.body.event_date;
    const event_time = req.body.event_time || '10h00';
    const activeConfig = db.getActiveCityConfig();
    const lat = parseFloat(req.body.lat) || activeConfig.active_lat || -18.7669;
    const lng = parseFloat(req.body.lng) || activeConfig.active_lng || 46.8691;
    const city = String(req.body.city || activeConfig.active_city || '').trim();

    if (!title_fr || !location || !event_date) {
      return res.status(400).json({ error: 'Titre, lieu et date sont obligatoires.' });
    }
    if (!city) {
      return res.status(400).json({ error: 'Aucune ville active. Choisissez d’abord une ville pour le kiosque.' });
    }

    // Validation: prevent adding event in the past
    const today = new Date().toISOString().split('T')[0];
    if (event_date < today) {
      return res.status(400).json({ error: 'Impossible de créer un événement avec une date déjà passée.' });
    }

    const insert = db.prepare(`
      INSERT INTO events (title_fr, title_mg, title_en, description_fr, location, event_date, event_time, lat, lng, city)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = insert.run(
      title_fr,
      title_mg || title_fr,
      title_en || title_fr,
      description_fr || '',
      location,
      event_date,
      event_time,
      lat,
      lng,
      city
    );

    const newEvent = db.prepare('SELECT * FROM events WHERE id = ?').get(result.lastInsertRowid);
    db.upsertCity({ name: city, lat, lng });
    res.status(201).json(newEvent);
  } catch (err) {
    res.status(500).json({ error: 'Erreur création événement.' });
  }
});

// 3. ADMIN: Edit an event
router.put('/:id', authMiddleware, (req, res) => {
  try {
    const { id } = req.params;
    const existing = db.prepare('SELECT * FROM events WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ error: 'Événement introuvable.' });

    const title_fr = req.body.title_fr;
    const title_mg = req.body.title_mg;
    const title_en = req.body.title_en;
    const description_fr = req.body.description_fr;
    const location = req.body.location;
    const event_date = req.body.event_date;
    const event_time = req.body.event_time;
    const lat = req.body.lat !== undefined && req.body.lat !== ''
      ? parseFloat(req.body.lat)
      : existing.lat;
    const lng = req.body.lng !== undefined && req.body.lng !== ''
      ? parseFloat(req.body.lng)
      : existing.lng;

    db.prepare(`
      UPDATE events
      SET title_fr = ?, title_mg = ?, title_en = ?,
          description_fr = ?, location = ?, event_date = ?, event_time = ?,
          lat = ?, lng = ?
      WHERE id = ?
    `).run(title_fr, title_mg, title_en, description_fr, location, event_date, event_time, lat, lng, id);

    const updated = db.prepare('SELECT * FROM events WHERE id = ?').get(id);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Erreur mise à jour événement.' });
  }
});

// 4. ADMIN: Delete an event
router.delete('/:id', authMiddleware, (req, res) => {
  try {
    const { id } = req.params;
    db.prepare('DELETE FROM events WHERE id = ?').run(id);
    res.json({ success: true, message: 'Événement supprimé.' });
  } catch (err) {
    res.status(500).json({ error: 'Erreur suppression.' });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { authMiddleware } = require('../middlewares/authMiddleware');

// 1. PUBLIC: Get emergency numbers for active city (or national)
router.get('/', (req, res) => {
  try {
    const { city } = req.query;
    const activeCity = city || db.getActiveCityConfig().active_city;

    const list = db.prepare("SELECT * FROM emergency_contacts WHERE (LOWER(city) = LOWER(?) OR city = 'National') ORDER BY display_order ASC, id ASC").all(activeCity);
    res.json(list);
  } catch (err) {
    console.error('Emergency GET error:', err);
    res.status(500).json({ error: 'Erreur lecture contacts urgence.' });
  }
});

// 2. ADMIN: Add emergency contact
router.post('/', authMiddleware, (req, res) => {
  try {
    const name = req.body.name;
    const number = req.body.number;
    const address = req.body.address;
    const icon = req.body.icon || 'ShieldAlert';
    const display_order = parseInt(req.body.display_order, 10) || 0;
    const activeConfig = db.getActiveCityConfig();
    const lat = parseFloat(req.body.lat) || activeConfig.active_lat || -18.7669;
    const lng = parseFloat(req.body.lng) || activeConfig.active_lng || 46.8691;
    const city = String(req.body.city || activeConfig.active_city || '').trim();

    if (!name || !number) {
      return res.status(400).json({ error: 'Nom et numéro d’appel obligatoires.' });
    }
    if (!city) {
      return res.status(400).json({ error: 'Aucune ville active. Choisissez d’abord une ville pour le kiosque.' });
    }

    const insert = db.prepare(`
      INSERT INTO emergency_contacts (name, number, address, icon, display_order, lat, lng, city)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = insert.run(name, number, address || '', icon, display_order, lat, lng, city);
    const newContact = db.prepare('SELECT * FROM emergency_contacts WHERE id = ?').get(result.lastInsertRowid);
    db.upsertCity({ name: city, lat, lng });
    res.status(201).json(newContact);
  } catch (err) {
    res.status(500).json({ error: 'Erreur création contact urgence.' });
  }
});

// 3. ADMIN: Edit emergency contact
router.put('/:id', authMiddleware, (req, res) => {
  try {
    const { id } = req.params;
    const existing = db.prepare('SELECT * FROM emergency_contacts WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ error: 'Contact introuvable.' });

    const name = req.body.name;
    const number = req.body.number;
    const address = req.body.address;
    const icon = req.body.icon || 'ShieldAlert';
    const lat = req.body.lat !== undefined && req.body.lat !== ''
      ? parseFloat(req.body.lat)
      : existing.lat;
    const lng = req.body.lng !== undefined && req.body.lng !== ''
      ? parseFloat(req.body.lng)
      : existing.lng;
    const city = req.body.city;

    if (city) {
      db.prepare(`
        UPDATE emergency_contacts
        SET name = ?, number = ?, address = ?, icon = ?, lat = ?, lng = ?, city = ?
        WHERE id = ?
      `).run(name, number, address, icon, lat, lng, city, id);
    } else {
      db.prepare(`
        UPDATE emergency_contacts
        SET name = ?, number = ?, address = ?, icon = ?, lat = ?, lng = ?
        WHERE id = ?
      `).run(name, number, address, icon, lat, lng, id);
    }

    const updated = db.prepare('SELECT * FROM emergency_contacts WHERE id = ?').get(id);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Erreur mise à jour contact urgence.' });
  }
});

// 4. ADMIN: Delete emergency contact
router.delete('/:id', authMiddleware, (req, res) => {
  try {
    const { id } = req.params;
    db.prepare('DELETE FROM emergency_contacts WHERE id = ?').run(id);
    res.json({ success: true, message: 'Contact supprimé.' });
  } catch (err) {
    res.status(500).json({ error: 'Erreur suppression.' });
  }
});

module.exports = router;

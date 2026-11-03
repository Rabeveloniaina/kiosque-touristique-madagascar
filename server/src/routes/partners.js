const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const db = require('../db/database');
const { authMiddleware } = require('../middlewares/authMiddleware');

const uploadsDir = path.resolve(__dirname, '../../uploads');
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, 'partner-' + Date.now() + ext);
  }
});
const upload = multer({ storage });

function fixUtf8(str) {
  if (!str || typeof str !== 'string') return str || '';
  if (/[\xC2-\xC3][\x80-\xBF]/.test(str)) {
    try {
      const decoded = Buffer.from(str, 'latin1').toString('utf8');
      if (!decoded.includes('\uFFFD')) return decoded;
    } catch {}
  }
  return str;
}

// 1. PUBLIC: Get partners for active city
router.get('/', (req, res) => {
  try {
    const { city } = req.query;
    const activeCity = city || db.getActiveCityConfig().active_city;

    const partners = db.prepare('SELECT * FROM partners WHERE city = ? ORDER BY id DESC').all(activeCity);
    res.json(partners);
  } catch (err) {
    res.status(500).json({ error: 'Erreur lecture partenaires.' });
  }
});

// 2. ADMIN: Add partner
router.post('/', authMiddleware, upload.single('imageFile'), (req, res) => {
  try {
    const name = fixUtf8(req.body.name);
    const type = fixUtf8(req.body.type);
    const description = fixUtf8(req.body.description);
    const contact = fixUtf8(req.body.contact);
    const address = fixUtf8(req.body.address);
    const lat = parseFloat(req.body.lat) || -21.4536;
    const lng = parseFloat(req.body.lng) || 47.0858;
    const city = (req.body.city || db.getActiveCityConfig().active_city).trim();
    let image_url = req.body.image_url || '';

    if (req.file) {
      image_url = `http://localhost:5000/uploads/${req.file.filename}`;
    }

    if (!name || !type) {
      return res.status(400).json({ error: 'Nom et type obligatoires.' });
    }

    const insert = db.prepare(`
      INSERT INTO partners (name, type, description, contact, address, image_url, lat, lng, city)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = insert.run(
      name,
      type,
      description || '',
      contact || '',
      address || '',
      image_url,
      lat,
      lng,
      city
    );

    const newPartner = db.prepare('SELECT * FROM partners WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(newPartner);
  } catch (err) {
    res.status(500).json({ error: 'Erreur création partenaire.' });
  }
});

// 3. ADMIN: Edit partner
router.put('/:id', authMiddleware, upload.single('imageFile'), (req, res) => {
  try {
    const { id } = req.params;
    const existing = db.prepare('SELECT * FROM partners WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ error: 'Partenaire introuvable.' });

    const name = fixUtf8(req.body.name) || existing.name;
    const type = fixUtf8(req.body.type) || existing.type;
    const description = fixUtf8(req.body.description) || existing.description;
    const contact = fixUtf8(req.body.contact) || existing.contact;
    const address = fixUtf8(req.body.address) || existing.address;
    const lat = req.body.lat !== undefined ? parseFloat(req.body.lat) : existing.lat;
    const lng = req.body.lng !== undefined ? parseFloat(req.body.lng) : existing.lng;
    let image_url = req.body.image_url || existing.image_url;

    if (req.file) {
      image_url = `http://localhost:5000/uploads/${req.file.filename}`;
    }

    const city = req.body.city || existing.city;

    db.prepare(`
      UPDATE partners
      SET name = ?, type = ?, description = ?, contact = ?, address = ?, image_url = ?, lat = ?, lng = ?, city = ?
      WHERE id = ?
    `).run(name, type, description, contact, address, image_url, lat, lng, city, id);

    const updated = db.prepare('SELECT * FROM partners WHERE id = ?').get(id);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Erreur mise à jour partenaire.' });
  }
});

// 4. ADMIN: Delete partner
router.delete('/:id', authMiddleware, (req, res) => {
  try {
    const { id } = req.params;
    db.prepare('DELETE FROM partners WHERE id = ?').run(id);
    res.json({ success: true, message: 'Partenaire supprimé.' });
  } catch (err) {
    res.status(500).json({ error: 'Erreur suppression.' });
  }
});

module.exports = router;

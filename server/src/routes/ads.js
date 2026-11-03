const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db/database');
const { authMiddleware } = require('../middlewares/authMiddleware');

// Storage configuration for media uploads
const uploadsDir = path.resolve(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Helper to fix Latin-1 to UTF-8 conversion in Multer multipart forms
function fixUtf8(str) {
  if (!str) return '';
  try {
    return Buffer.from(str, 'latin1').toString('utf8');
  } catch {
    return str;
  }
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'ad-' + uniqueSuffix + ext);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB max for high-res videos/photos
});

// 1. PUBLIC: Get active ads for screensaver
router.get('/', (req, res) => {
  try {
    const ads = db.prepare(`
      SELECT * FROM ads 
      WHERE is_active = 1 
      ORDER BY display_order ASC, id DESC
    `).all();
    res.json(ads);
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la récupération des publicités.' });
  }
});

// 2. ADMIN: Get all ads (both active and hidden)
router.get('/all', authMiddleware, (req, res) => {
  try {
    const ads = db.prepare('SELECT * FROM ads ORDER BY id DESC').all();
    res.json(ads);
  } catch (err) {
    res.status(500).json({ error: 'Erreur base de données.' });
  }
});

// 3. ADMIN: Add new advertisement (File upload OR direct URL)
router.post('/', authMiddleware, upload.single('mediaFile'), (req, res) => {
  try {
    const title_fr = fixUtf8(req.body.title_fr);
    const title_mg = fixUtf8(req.body.title_mg);
    const title_en = fixUtf8(req.body.title_en);
    const subtitle_fr = fixUtf8(req.body.subtitle_fr);
    const subtitle_mg = fixUtf8(req.body.subtitle_mg);
    const subtitle_en = fixUtf8(req.body.subtitle_en);
    const badge = fixUtf8(req.body.badge);
    const tag = fixUtf8(req.body.tag);
    const duration_seconds = parseInt(req.body.duration_seconds, 10) || 7;

    let finalMediaUrl = req.body.media_url;

    // If file uploaded locally
    if (req.file) {
      finalMediaUrl = `http://localhost:5000/uploads/${req.file.filename}`;
    }

    if (!title_fr || !finalMediaUrl) {
      return res.status(400).json({ error: 'Le titre et l’image/vidéo sont obligatoires.' });
    }

    const isVideo = req.file 
      ? req.file.mimetype.startsWith('video') 
      : (finalMediaUrl.endsWith('.mp4') || finalMediaUrl.endsWith('.webm'));

    const insert = db.prepare(`
      INSERT INTO ads (
        title_fr, title_mg, title_en,
        subtitle_fr, subtitle_mg, subtitle_en,
        badge, tag, media_type, media_url, duration_seconds
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = insert.run(
      title_fr,
      title_mg || title_fr,
      title_en || title_fr,
      subtitle_fr || '',
      subtitle_mg || '',
      subtitle_en || '',
      badge || 'Partenaire',
      tag || 'Local',
      isVideo ? 'video' : 'image',
      finalMediaUrl,
      duration_seconds
    );

    const newAd = db.prepare('SELECT * FROM ads WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(newAd);
  } catch (err) {
    console.error('Error adding ad:', err);
    res.status(500).json({ error: 'Erreur lors de la création de la publicité.' });
  }
});

// 4. ADMIN: Update advertisement (Edit)
router.put('/:id', authMiddleware, upload.single('mediaFile'), (req, res) => {
  try {
    const { id } = req.params;
    const existing = db.prepare('SELECT * FROM ads WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ error: 'Publicité introuvable.' });

    const title_fr = fixUtf8(req.body.title_fr) || existing.title_fr;
    const title_mg = fixUtf8(req.body.title_mg) || existing.title_mg;
    const title_en = fixUtf8(req.body.title_en) || existing.title_en;
    const subtitle_fr = fixUtf8(req.body.subtitle_fr) !== undefined ? fixUtf8(req.body.subtitle_fr) : existing.subtitle_fr;
    const badge = fixUtf8(req.body.badge) || existing.badge;
    const duration_seconds = parseInt(req.body.duration_seconds, 10) || existing.duration_seconds;

    let media_url = req.body.media_url || existing.media_url;
    let media_type = existing.media_type;

    if (req.file) {
      media_url = `http://localhost:5000/uploads/${req.file.filename}`;
      media_type = req.file.mimetype.startsWith('video') ? 'video' : 'image';
    }

    db.prepare(`
      UPDATE ads 
      SET title_fr = ?, title_mg = ?, title_en = ?,
          subtitle_fr = ?, badge = ?, duration_seconds = ?,
          media_url = ?, media_type = ?
      WHERE id = ?
    `).run(title_fr, title_mg, title_en, subtitle_fr, badge, duration_seconds, media_url, media_type, id);

    const updated = db.prepare('SELECT * FROM ads WHERE id = ?').get(id);
    res.json(updated);
  } catch (err) {
    console.error('Error updating ad:', err);
    res.status(500).json({ error: 'Erreur mise à jour publicité.' });
  }
});

// 5. ADMIN: Toggle ad activation state
router.put('/:id/toggle', authMiddleware, (req, res) => {
  try {
    const { id } = req.params;
    const ad = db.prepare('SELECT * FROM ads WHERE id = ?').get(id);
    if (!ad) return res.status(404).json({ error: 'Publicité introuvable.' });

    const newStatus = ad.is_active === 1 ? 0 : 1;
    db.prepare('UPDATE ads SET is_active = ? WHERE id = ?').run(newStatus, id);

    res.json({ success: true, id, is_active: newStatus });
  } catch (err) {
    res.status(500).json({ error: 'Erreur mise à jour.' });
  }
});

// 6. ADMIN: Delete advertisement
router.delete('/:id', authMiddleware, (req, res) => {
  try {
    const { id } = req.params;
    const ad = db.prepare('SELECT * FROM ads WHERE id = ?').get(id);
    if (!ad) return res.status(404).json({ error: 'Publicité introuvable.' });

    // Clean up local uploaded file
    if (ad.media_url && ad.media_url.includes('/uploads/')) {
      const filename = path.basename(ad.media_url);
      const filePath = path.join(uploadsDir, filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    db.prepare('DELETE FROM ads WHERE id = ?').run(id);
    res.json({ success: true, message: 'Publicité supprimée avec succès.' });
  } catch (err) {
    res.status(500).json({ error: 'Erreur suppression.' });
  }
});

module.exports = router;

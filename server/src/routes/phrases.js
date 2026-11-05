const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');
const db = require('../db/database');
const { authMiddleware } = require('../middlewares/authMiddleware');

const CATEGORIES = ['salutations', 'restauration', 'transport', 'urgences', 'commerce'];
const AUDIO_EXTENSIONS = ['.mp3', '.wav', '.ogg', '.m4a', '.webm', '.aac'];

const audioDir = path.resolve(__dirname, '../../uploads/audio');
if (!fs.existsSync(audioDir)) {
  fs.mkdirSync(audioDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, audioDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `phrase-${req.params.id}-${Date.now()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!AUDIO_EXTENSIONS.includes(ext)) {
      return cb(new Error('Format audio non supporté. Utilisez MP3, WAV, OGG, M4A, WEBM ou AAC.'));
    }
    cb(null, true);
  }
});

function normalizeCategory(value, fallback = 'salutations') {
  const category = String(value || '').trim().toLowerCase();
  return CATEGORIES.includes(category) ? category : fallback;
}

function mapPhrase(row) {
  if (!row) return row;
  return { ...row, audio_url: row.audio_key || null };
}

function getPhrase(id) {
  return db.prepare('SELECT * FROM phrases WHERE id = ?').get(id);
}

function removeAudioFile(audioKey) {
  if (!audioKey) return;
  const filePath = path.join(audioDir, path.basename(audioKey));
  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch (err) {
      console.warn('[PHRASES] Impossible de supprimer le fichier audio:', err.message);
    }
  }
}

function parseSortOrder(value, fallback = 0) {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

// Génération MMS dans un processus séparé : le modèle ONNX n'occupe pas la
// mémoire du serveur Express et est libéré dès la fin de la synthèse.
let ttsRunning = false;

function runTtsScript(args) {
  if (ttsRunning) {
    return Promise.reject(new Error('Une génération audio MMS est déjà en cours. Veuillez patienter.'));
  }
  ttsRunning = true;

  const scriptPath = path.resolve(__dirname, '../../scripts/generate-phrase-audio.js');
  const serverRoot = path.resolve(__dirname, '../..');

  return new Promise((resolve, reject) => {
    try {
      execFile(
        process.execPath,
        [scriptPath, ...args],
        {
          cwd: serverRoot,
          timeout: 15 * 60 * 1000,
          maxBuffer: 20 * 1024 * 1024,
          windowsHide: true
        },
        (error, stdout, stderr) => {
          ttsRunning = false;

          const lines = String(stdout || '').split(/\r?\n/);
          const markerLine = [...lines].reverse().find((line) => line.includes('__KIOSK_TTS_RESULT__'));
          let payload = null;
          if (markerLine) {
            try {
              payload = JSON.parse(markerLine.split('__KIOSK_TTS_RESULT__')[1]);
            } catch {}
          }

          if (payload && payload.ok) {
            return resolve(payload);
          }

          const errorDetail =
            (payload && payload.error) ||
            String(stderr || '').trim().split(/\r?\n/).slice(-6).join(' ') ||
            (error && error.message) ||
            'La génération audio MMS a échoué.';

          reject(new Error(errorDetail));
        }
      );
    } catch (err) {
      ttsRunning = false;
      reject(err);
    }
  });
}

// 1. PUBLIC: phrases actives pour le kiosque
router.get('/', (req, res) => {
  try {
    const phrases = db.prepare(`
      SELECT * FROM phrases
      WHERE is_active = 1
      ORDER BY
        CASE category
          WHEN 'salutations' THEN 1
          WHEN 'restauration' THEN 2
          WHEN 'transport' THEN 3
          WHEN 'urgences' THEN 4
          WHEN 'commerce' THEN 5
          ELSE 6
        END,
        sort_order ASC,
        id ASC
    `).all();
    res.json(phrases.map(mapPhrase));
  } catch (err) {
    console.error('[PHRASES] Erreur liste publique:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération des phrases.' });
  }
});

// 2. ADMIN: toutes les phrases (actives et masquées)
router.get('/all', authMiddleware, (req, res) => {
  try {
    const phrases = db.prepare(`
      SELECT * FROM phrases
      ORDER BY
        CASE category
          WHEN 'salutations' THEN 1
          WHEN 'restauration' THEN 2
          WHEN 'transport' THEN 3
          WHEN 'urgences' THEN 4
          WHEN 'commerce' THEN 5
          ELSE 6
        END,
        sort_order ASC,
        id ASC
    `).all();
    res.json(phrases.map(mapPhrase));
  } catch (err) {
    console.error('[PHRASES] Erreur liste admin:', err);
    res.status(500).json({ error: 'Erreur base de données.' });
  }
});

// 3. ADMIN: créer une phrase
router.post('/', authMiddleware, (req, res) => {
  try {
    const text_mg = String(req.body.text_mg || '').trim();
    if (!text_mg) {
      return res.status(400).json({ error: 'La phrase en malgache est obligatoire.' });
    }

    const result = db.prepare(`
      INSERT INTO phrases (category, text_mg, text_fr, text_en, pronunciation, sort_order, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      normalizeCategory(req.body.category),
      text_mg,
      String(req.body.text_fr || '').trim(),
      String(req.body.text_en || '').trim(),
      String(req.body.pronunciation || '').trim(),
      parseSortOrder(req.body.sort_order, 0),
      req.body.is_active === undefined ? 1 : (req.body.is_active ? 1 : 0)
    );

    const phrase = getPhrase(result.lastInsertRowid);
    res.status(201).json(mapPhrase(phrase));
  } catch (err) {
    console.error('[PHRASES] Erreur création:', err);
    res.status(500).json({ error: 'Erreur lors de la création de la phrase.' });
  }
});

// 4. ADMIN: modifier une phrase (mise à jour totale ou partielle)
router.put('/:id', authMiddleware, (req, res) => {
  try {
    const existing = getPhrase(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Phrase introuvable.' });

    const text_mg = req.body.text_mg !== undefined
      ? String(req.body.text_mg || '').trim()
      : existing.text_mg;
    if (!text_mg) {
      return res.status(400).json({ error: 'La phrase en malgache est obligatoire.' });
    }

    const category = req.body.category !== undefined
      ? normalizeCategory(req.body.category, existing.category)
      : existing.category;
    const text_fr = req.body.text_fr !== undefined ? String(req.body.text_fr || '').trim() : existing.text_fr;
    const text_en = req.body.text_en !== undefined ? String(req.body.text_en || '').trim() : existing.text_en;
    const pronunciation = req.body.pronunciation !== undefined
      ? String(req.body.pronunciation || '').trim()
      : existing.pronunciation;
    const sort_order = req.body.sort_order !== undefined
      ? parseSortOrder(req.body.sort_order, existing.sort_order)
      : existing.sort_order;
    const is_active = req.body.is_active !== undefined
      ? (req.body.is_active ? 1 : 0)
      : existing.is_active;

    db.prepare(`
      UPDATE phrases
      SET category = ?, text_mg = ?, text_fr = ?, text_en = ?, pronunciation = ?,
          sort_order = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(category, text_mg, text_fr, text_en, pronunciation, sort_order, is_active, req.params.id);

    res.json(mapPhrase(getPhrase(req.params.id)));
  } catch (err) {
    console.error('[PHRASES] Erreur modification:', err);
    res.status(500).json({ error: 'Erreur lors de la modification de la phrase.' });
  }
});

// 5. ADMIN: supprimer une phrase (et son audio)
router.delete('/:id', authMiddleware, (req, res) => {
  try {
    const phrase = getPhrase(req.params.id);
    if (!phrase) return res.status(404).json({ error: 'Phrase introuvable.' });

    removeAudioFile(phrase.audio_key);
    db.prepare('DELETE FROM phrases WHERE id = ?').run(req.params.id);

    res.json({ success: true, message: 'Phrase supprimée avec succès.' });
  } catch (err) {
    console.error('[PHRASES] Erreur suppression:', err);
    res.status(500).json({ error: 'Erreur lors de la suppression de la phrase.' });
  }
});

// 6. ADMIN: générer l'audio malgache avec MMS-TTS
router.post('/:id/tts', authMiddleware, async (req, res) => {
  try {
    const phrase = getPhrase(req.params.id);
    if (!phrase) return res.status(404).json({ error: 'Phrase introuvable.' });

    const result = await runTtsScript(['--id', String(phrase.id)]);
    const updated = getPhrase(phrase.id);

    res.json({
      success: true,
      phrase: mapPhrase(updated),
      generation: (result.generated && result.generated[0]) || null
    });
  } catch (err) {
    console.error('[PHRASES] Erreur génération MMS:', err.message);
    res.status(500).json({ error: err.message || 'Erreur lors de la génération audio MMS.' });
  }
});

// 7. ADMIN: générer tous les audios manquants
router.post('/tts-all', authMiddleware, async (req, res) => {
  try {
    const result = await runTtsScript(['--missing']);
    const phrases = db.prepare('SELECT * FROM phrases ORDER BY sort_order ASC, id ASC').all();
    res.json({
      success: true,
      generated: result.generated || [],
      skipped: !!result.skipped,
      phrases: phrases.map(mapPhrase)
    });
  } catch (err) {
    console.error('[PHRASES] Erreur génération MMS globale:', err.message);
    res.status(500).json({ error: err.message || 'Erreur lors de la génération audio MMS.' });
  }
});

// 8. ADMIN: téléverser un fichier audio personnalisé
router.post('/:id/audio', authMiddleware, upload.single('audioFile'), (req, res) => {
  try {
    const phrase = getPhrase(req.params.id);
    if (!phrase) {
      if (req.file) removeAudioFile(`/uploads/audio/${req.file.filename}`);
      return res.status(404).json({ error: 'Phrase introuvable.' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'Aucun fichier audio reçu.' });
    }

    const audioKey = `/uploads/audio/${req.file.filename}`;
    removeAudioFile(phrase.audio_key);
    db.prepare('UPDATE phrases SET audio_key = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(audioKey, phrase.id);

    res.json({ success: true, phrase: mapPhrase(getPhrase(phrase.id)) });
  } catch (err) {
    console.error('[PHRASES] Erreur upload audio:', err);
    res.status(500).json({ error: 'Erreur lors du téléversement audio.' });
  }
});

// 9. ADMIN: supprimer l'audio d'une phrase
router.delete('/:id/audio', authMiddleware, (req, res) => {
  try {
    const phrase = getPhrase(req.params.id);
    if (!phrase) return res.status(404).json({ error: 'Phrase introuvable.' });

    removeAudioFile(phrase.audio_key);
    db.prepare('UPDATE phrases SET audio_key = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(phrase.id);

    res.json({ success: true, phrase: mapPhrase(getPhrase(phrase.id)) });
  } catch (err) {
    console.error('[PHRASES] Erreur suppression audio:', err);
    res.status(500).json({ error: 'Erreur lors de la suppression audio.' });
  }
});

// Erreurs Multer (format ou taille de fichier)
router.use((err, req, res, next) => {
  if (err) {
    return res.status(400).json({ error: err.message || 'Erreur lors du téléversement.' });
  }
  next();
});

module.exports = router;

const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { authMiddleware } = require('../middlewares/authMiddleware');

// 1. Record or close an anonymous session
router.post('/session', (req, res) => {
  try {
    const { id, language, duration_seconds } = req.body;
    if (!id || !language) {
      return res.status(400).json({ error: 'ID et langue requis.' });
    }

    const existing = db.prepare('SELECT id FROM sessions WHERE id = ?').get(id);

    if (existing) {
      db.prepare(`
        UPDATE sessions 
        SET ended_at = CURRENT_TIMESTAMP, duration_seconds = ?
        WHERE id = ?
      `).run(duration_seconds || 0, id);
    } else {
      db.prepare(`
        INSERT INTO sessions (id, language, duration_seconds)
        VALUES (?, ?, ?)
      `).run(id, language, duration_seconds || 0);
    }

    res.json({ success: true, sessionId: id });
  } catch (err) {
    res.status(500).json({ error: 'Erreur enregistrement session.' });
  }
});

// 2. Log interaction
router.post('/interaction', (req, res) => {
  try {
    const { session_id, feature_name, item_clicked } = req.body;
    if (!feature_name) {
      return res.status(400).json({ error: 'Nom de fonctionnalité requis.' });
    }

    db.prepare(`
      INSERT INTO interactions (session_id, feature_name, item_clicked)
      VALUES (?, ?, ?)
    `).run(session_id || null, feature_name, item_clicked || null);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erreur interaction.' });
  }
});

// 3. ADMIN: Get enriched analytics
router.get('/summary', (req, res) => {
  try {
    const totalSessions = db.prepare('SELECT COUNT(*) as count FROM sessions').get().count;

    const avgDurationRow = db.prepare('SELECT AVG(duration_seconds) as avg FROM sessions WHERE duration_seconds > 0').get();
    const avgDurationSeconds = Math.round(avgDurationRow?.avg || 0);

    // Language breakdown
    const langRows = db.prepare(`
      SELECT language, COUNT(*) as count 
      FROM sessions 
      GROUP BY language
    `).all();

    const languages = { mg: 0, fr: 0, en: 0 };
    langRows.forEach((r) => {
      if (languages[r.language] !== undefined) {
        languages[r.language] = r.count;
      }
    });

    // Feature popularity
    const featureRows = db.prepare(`
      SELECT feature_name, COUNT(*) as count 
      FROM interactions 
      GROUP BY feature_name 
      ORDER BY count DESC
    `).all();

    const featureCounts = {};
    featureRows.forEach((r) => {
      featureCounts[r.feature_name] = r.count;
    });

    // Top scanned items / QR codes
    const topScannedItems = db.prepare(`
      SELECT item_clicked, COUNT(*) as count 
      FROM interactions 
      WHERE item_clicked IS NOT NULL 
      GROUP BY item_clicked 
      ORDER BY count DESC 
      LIMIT 6
    `).all();

    // Peak visiting hours breakdown
    const peakHours = {
      matin: db.prepare(`SELECT COUNT(*) as count FROM sessions WHERE strftime('%H', started_at) BETWEEN '06' AND '11'`).get().count,
      midi: db.prepare(`SELECT COUNT(*) as count FROM sessions WHERE strftime('%H', started_at) BETWEEN '12' AND '17'`).get().count,
      soir: db.prepare(`SELECT COUNT(*) as count FROM sessions WHERE strftime('%H', started_at) BETWEEN '18' AND '23'`).get().count,
      nuit: db.prepare(`SELECT COUNT(*) as count FROM sessions WHERE strftime('%H', started_at) BETWEEN '00' AND '05'`).get().count
    };

    // Sessions by day (last 7 days)
    const dailyTrend = db.prepare(`
      SELECT date(started_at) as date, count(*) as count 
      FROM sessions 
      GROUP BY date(started_at) 
      ORDER BY date(started_at) DESC 
      LIMIT 7
    `).all();

    res.json({
      totalSessions,
      avgDurationSeconds,
      languages,
      featureCounts,
      topScannedItems,
      peakHours,
      dailyTrend
    });
  } catch (err) {
    console.error('Stats summary error:', err);
    res.status(500).json({ error: 'Erreur calcul statistiques.' });
  }
});

// 4. Clear all stats
router.delete('/clear', authMiddleware, (req, res) => {
  try {
    db.prepare('DELETE FROM interactions').run();
    db.prepare('DELETE FROM sessions').run();
    res.json({ success: true, message: 'Statistiques réinitialisées.' });
  } catch (err) {
    res.status(500).json({ error: 'Erreur réinitialisation.' });
  }
});

module.exports = router;

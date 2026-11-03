const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db/database');
const { authMiddleware, JWT_SECRET } = require('../middlewares/authMiddleware');

// 1. Login
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Identifiant et mot de passe requis.' });
  }

  const admin = db.prepare('SELECT * FROM admins WHERE username = ?').get(username);
  if (!admin) {
    return res.status(401).json({ error: 'Identifiants invalides.' });
  }

  const isMatch = bcrypt.compareSync(password, admin.password_hash);
  if (!isMatch) {
    return res.status(401).json({ error: 'Identifiants invalides.' });
  }

  const token = jwt.sign({ username: admin.username }, JWT_SECRET, { expiresIn: '48h' });
  return res.json({
    success: true,
    token,
    username: admin.username,
    full_name: admin.full_name || admin.username
  });
});

// 2. List all admin accounts
router.get('/users', authMiddleware, (req, res) => {
  try {
    const users = db.prepare('SELECT username, full_name, created_at FROM admins ORDER BY created_at ASC').all();
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la lecture des comptes.' });
  }
});

// 3. Create a new admin account
router.post('/users', authMiddleware, (req, res) => {
  try {
    const { username, full_name, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Identifiant et mot de passe requis.' });
    }

    const existing = db.prepare('SELECT username FROM admins WHERE username = ?').get(username);
    if (existing) {
      return res.status(400).json({ error: 'Cet identifiant existe déjà.' });
    }

    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(password, salt);

    db.prepare(`
      INSERT INTO admins (username, full_name, password_hash)
      VALUES (?, ?, ?)
    `).run(username, full_name || username, hash);

    res.status(201).json({ success: true, username, full_name: full_name || username });
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la création du compte.' });
  }
});

// 4. Update profile (Username & Password)
router.put('/profile', authMiddleware, (req, res) => {
  try {
    const currentUsername = req.admin.username;
    const { new_username, new_password, full_name } = req.body;

    const admin = db.prepare('SELECT * FROM admins WHERE username = ?').get(currentUsername);
    if (!admin) return res.status(404).json({ error: 'Compte introuvable.' });

    let finalUsername = currentUsername;
    let finalHash = admin.password_hash;
    let finalFullName = full_name !== undefined ? full_name : admin.full_name;

    // Password change
    if (new_password && new_password.trim().length >= 4) {
      const salt = bcrypt.genSaltSync(10);
      finalHash = bcrypt.hashSync(new_password.trim(), salt);
    }

    // Username change
    if (new_username && new_username !== currentUsername) {
      const existing = db.prepare('SELECT username FROM admins WHERE username = ?').get(new_username);
      if (existing) {
        return res.status(400).json({ error: 'Ce nom d’utilisateur est déjà pris.' });
      }
      finalUsername = new_username.trim();

      db.prepare(`
        UPDATE admins 
        SET username = ?, full_name = ?, password_hash = ?
        WHERE username = ?
      `).run(finalUsername, finalFullName, finalHash, currentUsername);
    } else {
      db.prepare(`
        UPDATE admins 
        SET full_name = ?, password_hash = ?
        WHERE username = ?
      `).run(finalFullName, finalHash, currentUsername);
    }

    // Re-issue token with updated username
    const token = jwt.sign({ username: finalUsername }, JWT_SECRET, { expiresIn: '48h' });

    res.json({
      success: true,
      username: finalUsername,
      full_name: finalFullName,
      token,
      message: 'Profil mis à jour avec succès.'
    });
  } catch (err) {
    console.error('Profile update error:', err);
    res.status(500).json({ error: 'Erreur lors de la mise à jour du profil.' });
  }
});

// 5. Delete an admin account
router.delete('/users/:username', authMiddleware, (req, res) => {
  try {
    const targetUsername = req.params.username;

    const count = db.prepare('SELECT count(*) as count FROM admins').get().count;
    if (count <= 1) {
      return res.status(400).json({ error: 'Impossible de supprimer le seul compte administrateur restant.' });
    }

    db.prepare('DELETE FROM admins WHERE username = ?').run(targetUsername);
    res.json({ success: true, message: 'Compte supprimé.' });
  } catch (err) {
    res.status(500).json({ error: 'Erreur suppression.' });
  }
});

module.exports = router;

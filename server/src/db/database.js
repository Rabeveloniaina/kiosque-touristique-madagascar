const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = process.env.KIOSK_DB_PATH || path.join(__dirname, '../../../server/kiosk.db');
const db = new Database(dbPath);

// Ensure WAL mode and UTF-8 encoding
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('encoding = "UTF-8"');

function initDatabase() {
  db.exec(`
    -- 1. Table Administrateurs & Gestion des comptes
    CREATE TABLE IF NOT EXISTS admins (
      username TEXT PRIMARY KEY,
      full_name TEXT,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 2. Table Publicités du mode veille
    CREATE TABLE IF NOT EXISTS ads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title_fr TEXT NOT NULL,
      title_mg TEXT NOT NULL,
      title_en TEXT NOT NULL,
      subtitle_fr TEXT,
      subtitle_mg TEXT,
      subtitle_en TEXT,
      badge TEXT DEFAULT 'À découvrir',
      tag TEXT DEFAULT 'Tourisme',
      media_type TEXT DEFAULT 'image',
      media_url TEXT NOT NULL,
      duration_seconds INTEGER DEFAULT 7,
      is_active INTEGER DEFAULT 1,
      display_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 3. Table Lieux, Sites touristiques, Hôtels & Itinéraires
    CREATE TABLE IF NOT EXISTS places (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL,
      name TEXT NOT NULL,
      desc_fr TEXT,
      desc_mg TEXT,
      desc_en TEXT,
      price_indicative TEXT,
      contact TEXT,
      lat REAL,
      lng REAL,
      rating REAL DEFAULT 4.7,
      photo_url TEXT,
      distance_km TEXT,
      travel_time TEXT,
      itinerary_steps TEXT,
      google_maps_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 4. Table Événements avec date d'expiration et coordonnées GPS
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title_fr TEXT NOT NULL,
      title_mg TEXT,
      title_en TEXT,
      description_fr TEXT,
      location TEXT NOT NULL,
      event_date DATE NOT NULL,
      event_time TEXT,
      lat REAL,
      lng REAL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 5. Table Urgences & Infos pratiques avec coordonnées GPS
    CREATE TABLE IF NOT EXISTS emergency_contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      number TEXT NOT NULL,
      address TEXT,
      icon TEXT DEFAULT 'ShieldAlert',
      display_order INTEGER DEFAULT 0,
      lat REAL,
      lng REAL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 6. Table Phrases utiles (CRUD back-office + audio MMS)
    CREATE TABLE IF NOT EXISTS phrases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL DEFAULT 'salutations',
      text_mg TEXT NOT NULL,
      text_fr TEXT,
      text_en TEXT,
      pronunciation TEXT,
      audio_key TEXT,
      sort_order INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 7. Télémétrie anonyme : sessions & interactions
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      ended_at DATETIME,
      duration_seconds INTEGER DEFAULT 0,
      language TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS interactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT,
      feature_name TEXT NOT NULL,
      item_clicked TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(session_id) REFERENCES sessions(id) ON DELETE CASCADE
    );

    -- 8. Configuration du Kiosque (Ville active, coordonnées, région)
    CREATE TABLE IF NOT EXISTS kiosk_config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    -- 9. Répertoire des villes enregistrées (métadonnées dynamiques)
    CREATE TABLE IF NOT EXISTS cities (
      name TEXT PRIMARY KEY,
      region TEXT,
      lat REAL,
      lng REAL,
      country TEXT DEFAULT 'Madagascar',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Safe schema migrations for existing database columns
  try { db.exec("ALTER TABLE places ADD COLUMN photo_url TEXT;"); } catch {}
  try { db.exec("ALTER TABLE places ADD COLUMN distance_km TEXT;"); } catch {}
  try { db.exec("ALTER TABLE places ADD COLUMN travel_time TEXT;"); } catch {}
  try { db.exec("ALTER TABLE places ADD COLUMN itinerary_steps TEXT;"); } catch {}
  try { db.exec("ALTER TABLE places ADD COLUMN google_maps_url TEXT;"); } catch {}
  try { db.exec("ALTER TABLE places ADD COLUMN city TEXT DEFAULT '';"); } catch {}
  try { db.exec("ALTER TABLE admins ADD COLUMN full_name TEXT;"); } catch {}
  try { db.exec("ALTER TABLE events ADD COLUMN lat REAL;"); } catch {}
  try { db.exec("ALTER TABLE events ADD COLUMN lng REAL;"); } catch {}
  try { db.exec("ALTER TABLE events ADD COLUMN city TEXT DEFAULT '';"); } catch {}
  try { db.exec("ALTER TABLE emergency_contacts ADD COLUMN lat REAL;"); } catch {}
  try { db.exec("ALTER TABLE emergency_contacts ADD COLUMN lng REAL;"); } catch {}
  try { db.exec("ALTER TABLE emergency_contacts ADD COLUMN city TEXT DEFAULT '';"); } catch {}

  // Initialize default active city config if none exists.
  // Aucune ville n'est imposée : l'administrateur choisit l'emplacement du kiosque.
  const configCount = db.prepare('SELECT count(*) as count FROM kiosk_config').get().count;
  if (configCount === 0) {
    const setCfg = db.prepare('INSERT OR REPLACE INTO kiosk_config (key, value) VALUES (?, ?)');
    setCfg.run('active_city', '');
    setCfg.run('active_region', '');
    setCfg.run('active_lat', '-18.7669');
    setCfg.run('active_lng', '46.8691');
    setCfg.run('active_country', 'Madagascar');
  }

  // Seed default admin if none exists
  const adminCount = db.prepare('SELECT count(*) as count FROM admins').get().count;
  if (adminCount === 0) {
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync('admin123', salt);
    db.prepare(`
      INSERT INTO admins (username, full_name, password_hash)
      VALUES (?, ?, ?)
    `).run('admin', 'Administrateur Principal', hash);
  }

  // Seed default useful phrases & categories if none exists
  seedPhrases();

  // Supprime une seule fois les anciennes données de démonstration codées en dur.
  cleanupLegacyCitySeed();

  // Enregistre les villes réellement présentes en base, sans métadonnées inventées.
  backfillCityRegistry();
}

function seedPhrases() {
  const phrasesCount = db.prepare('SELECT count(*) as count FROM phrases').get().count;
  if (phrasesCount > 0) return;

  const insertPhrase = db.prepare(`
    INSERT INTO phrases (category, text_mg, text_fr, text_en, pronunciation, sort_order)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const defaultPhrases = [
    ['salutations', 'Manao ahoana ianao ?', 'Bonjour / Comment ça va ?', 'Hello / How are you?', 'Mah-now ow-nah ee-ah-now', 10],
    ['salutations', 'Misaotra betsaka', 'Merci beaucoup', 'Thank you very much', 'Mee-sow-trah bet-sah-kah', 20],
    ['salutations', 'Azafady', 'S\'il vous plaît / Excusez-moi', 'Please / Excuse me', 'Ah-zah-fah-dee', 30],
    ['commerce', 'Ohatrinona ity ?', 'Combien ça coûte ?', 'How much is this?', 'Oo-ah-tree-noo-nah ee-tee', 40],
    ['restauration', 'Matsiro be !', 'C\'est délicieux !', 'It\'s delicious!', 'Mat-see-roo bay', 50],
    ['restauration', 'Misy sakafo gasy ve ?', 'Avez-vous des plats malgaches ?', 'Do you have Malagasy dishes?', 'Mee-see sah-kah-foo gah-see veh', 60],
    ['transport', 'Aiza ny... ?', 'Où se trouve... ?', 'Where is...?', 'Eye-zah nee', 70],
    ['transport', 'Mandeha amin\'ny ... ve ity ?', 'Est-ce que celui-ci va à ... ?', 'Does this go to ...?', 'Mahn-deh-hah ah-meen-ee ... veh ee-tee', 80],
    ['commerce', 'Manomeza ... azafady', 'Donnez-moi ..., s\'il vous plaît', 'Please give me ...', 'Mah-noo-meh-zah ... ah-zah-fah-dee', 90],
    ['urgences', 'Mila fanampiana aho !', 'J\'ai besoin d\'aide !', 'I need help!', 'Mee-lah fah-nah-mpee-ah-nah ah-oo', 100]
  ];

  const seed = db.transaction((rows) => {
    for (const row of rows) insertPhrase.run(...row);
  });

  try {
    seed(defaultPhrases);
    console.log(`[KIOSK DB] Successfully seeded ${defaultPhrases.length} useful phrases`);
  } catch (err) {
    console.warn('[KIOSK DB] Seed phrases warning:', err.message);
  }
}

initDatabase();

function checkForCorruptedText() {
  const replacementChar = '\uFFFD';
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
    .all();

  for (const { name } of tables) {
    const rows = db.prepare(`SELECT * FROM ${name}`).all();
    let count = 0;
    for (const row of rows) {
      for (const value of Object.values(row)) {
        if (typeof value === 'string' && value.includes(replacementChar)) count += 1;
      }
    }
    if (count > 0) {
      console.warn(`[KIOSK DB] ⚠ ${name}: ${count} valeur(s) contiennent U+FFFD (encodage corrompu).`);
    }
  }
}

checkForCorruptedText();

// Anciennes données de démonstration codées en dur (Fianarantsoa uniquement).
// Supprimées une seule fois pour que la base ne les réinjecte plus jamais.
function cleanupLegacyCitySeed() {
  const LEGACY_SEED_PLACE_IDS = [
    'site_haute_ville',
    'site_ranomafana',
    'site_sahambavy_tea',
    'site_gare_fce',
    'site_kianjasoa',
    'site_maromby',
    'site_cathedrale',
    'site_marche_zoma',
    'hotel_zomatel',
    'hotel_cotsoyannis',
    'hotel_lac_sahambavy',
    'hotel_tsara_guest',
    'hotel_tombontsoa',
    'hotel_plazza_inn',
    'hotel_ranjalia',
    'hotel_rova',
    'resto_chez_aina',
    'resto_chez_mi',
    'resto_entrecote',
    'resto_la_verdure',
    'resto_panda_pizza',
    'resto_riziere',
    'guide_ortf',
    'transp_coop_fiana'
  ];

  const marker = db
    .prepare("SELECT value FROM kiosk_config WHERE key = 'legacy_city_seed_cleanup_v1'")
    .get();
  if (marker) return;

  const placeholders = LEGACY_SEED_PLACE_IDS.map(() => '?').join(',');
  const cleanup = db.transaction(() => {
    const places = db
      .prepare(`DELETE FROM places WHERE id IN (${placeholders})`)
      .run(...LEGACY_SEED_PLACE_IDS);
    const events = db.prepare(`
      DELETE FROM events
      WHERE city = 'Fianarantsoa'
        AND title_fr IN (?, ?, ?)
    `).run(
      'Grand Marché Traditionnel du Zoma',
      'Concert de Musique Traditionnelle Betsileo',
      'Fête des Vendanges et Dégustation des Vins'
    );
    db.prepare("INSERT OR REPLACE INTO kiosk_config (key, value) VALUES ('legacy_city_seed_cleanup_v1', 'done')").run();
    return { places: places.changes, events: events.changes };
  });

  const result = cleanup();
  if (result.places > 0 || result.events > 0) {
    console.log(
      `[KIOSK DB] Anciennes données de démonstration supprimées : ${result.places} lieu(x), ${result.events} événement(s).`
    );
  }
}

function upsertCity({ name, region, lat, lng, country }) {
  const cityName = String(name || '').trim();
  if (!cityName) return;

  const parsedLat = Number.isFinite(Number(lat)) && Number(lat) !== 0 ? Number(lat) : null;
  const parsedLng = Number.isFinite(Number(lng)) && Number(lng) !== 0 ? Number(lng) : null;

  db.prepare(`
    INSERT INTO cities (name, region, lat, lng, country)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(name) DO UPDATE SET
      region = CASE
        WHEN excluded.region IS NOT NULL AND excluded.region != '' THEN excluded.region
        ELSE cities.region
      END,
      lat = COALESCE(excluded.lat, cities.lat),
      lng = COALESCE(excluded.lng, cities.lng),
      country = CASE
        WHEN excluded.country IS NOT NULL AND excluded.country != '' THEN excluded.country
        ELSE cities.country
      END,
      updated_at = CURRENT_TIMESTAMP
  `).run(cityName, region || '', parsedLat, parsedLng, country || 'Madagascar');
}

function backfillCityRegistry() {
  const rows = db.prepare(`
    SELECT city AS name,
           AVG(lat) AS lat,
           AVG(lng) AS lng
    FROM (
      SELECT city, lat, lng FROM places WHERE city IS NOT NULL AND city != ''
      UNION ALL
      SELECT city, lat, lng FROM events WHERE city IS NOT NULL AND city != ''
      UNION ALL
      SELECT city, lat, lng FROM emergency_contacts WHERE city IS NOT NULL AND city != ''
    )
    GROUP BY city
  `).all();

  for (const row of rows) {
    upsertCity({ name: row.name, region: '', lat: row.lat, lng: row.lng, country: 'Madagascar' });
  }

  const cfg = getActiveCityConfig();
  if (cfg.active_city) {
    upsertCity({
      name: cfg.active_city,
      region: cfg.active_region,
      lat: cfg.active_lat,
      lng: cfg.active_lng,
      country: cfg.active_country
    });
  }
}

function getActiveCityConfig() {
  const rows = db.prepare('SELECT key, value FROM kiosk_config').all();
  const cfg = {
    active_city: '',
    active_region: '',
    active_lat: -18.7669,
    active_lng: 46.8691,
    active_country: 'Madagascar'
  };
  for (const r of rows) {
    if (!r.key.startsWith('active_')) continue;
    if (r.key === 'active_lat' || r.key === 'active_lng') {
      const parsed = parseFloat(r.value);
      if (Number.isFinite(parsed)) cfg[r.key] = parsed;
    } else {
      cfg[r.key] = r.value;
    }
  }
  return cfg;
}

function setActiveCityConfig({ city, region, lat, lng, country }) {
  const setCfg = db.prepare('INSERT OR REPLACE INTO kiosk_config (key, value) VALUES (?, ?)');
  if (city) setCfg.run('active_city', city);
  if (region) setCfg.run('active_region', region);
  if (lat) setCfg.run('active_lat', String(lat));
  if (lng) setCfg.run('active_lng', String(lng));
  if (country) setCfg.run('active_country', country);

  if (city) {
    upsertCity({ name: city, region, lat, lng, country });
  }

  return getActiveCityConfig();
}

function getAvailableCities() {
  const names = db.prepare(`
    SELECT name FROM cities
    UNION
    SELECT city FROM places WHERE city IS NOT NULL AND city != ''
    UNION
    SELECT city FROM events WHERE city IS NOT NULL AND city != ''
    UNION
    SELECT city FROM emergency_contacts WHERE city IS NOT NULL AND city != ''
    ORDER BY name ASC
  `).all();

  return names.map(({ name }) => {
    const meta = db.prepare('SELECT * FROM cities WHERE LOWER(name) = LOWER(?)').get(name);
    const sample = db
      .prepare('SELECT lat, lng FROM places WHERE LOWER(city) = LOWER(?) AND lat IS NOT NULL AND lat != 0 LIMIT 1')
      .get(name);

    const places_count = db
      .prepare('SELECT count(*) as count FROM places WHERE LOWER(city) = LOWER(?)')
      .get(name).count;
    const events_count = db
      .prepare('SELECT count(*) as count FROM events WHERE LOWER(city) = LOWER(?)')
      .get(name).count;
    const emergency_count = db
      .prepare('SELECT count(*) as count FROM emergency_contacts WHERE LOWER(city) = LOWER(?)')
      .get(name).count;

    const lat = meta && Number.isFinite(meta.lat) ? meta.lat : sample?.lat ?? null;
    const lng = meta && Number.isFinite(meta.lng) ? meta.lng : sample?.lng ?? null;

    return {
      city: name,
      lat: lat ?? -18.7669,
      lng: lng ?? 46.8691,
      region: meta?.region || 'Madagascar',
      places_count,
      events_count,
      emergency_count
    };
  });
}

function deleteCity(cityName) {
  if (!cityName || !cityName.trim()) throw new Error('Nom de ville invalide.');
  const target = cityName.trim();
  const currentConfig = getActiveCityConfig();
  if (currentConfig.active_city.toLowerCase() === target.toLowerCase()) {
    throw new Error(`Impossible de supprimer "${target}" car c'est la ville actuellement active du kiosque. Veuillez d'abord basculer vers une autre ville.`);
  }

  const delPlaces = db.prepare('DELETE FROM places WHERE LOWER(city) = LOWER(?)');
  const delEvents = db.prepare('DELETE FROM events WHERE LOWER(city) = LOWER(?)');
  const delEmergency = db.prepare('DELETE FROM emergency_contacts WHERE LOWER(city) = LOWER(?)');
  const delCity = db.prepare('DELETE FROM cities WHERE LOWER(name) = LOWER(?)');

  const tx = db.transaction((name) => {
    const p = delPlaces.run(name);
    const e = delEvents.run(name);
    const em = delEmergency.run(name);
    const c = delCity.run(name);
    return {
      deletedPlaces: p.changes,
      deletedEvents: e.changes,
      deletedEmergency: em.changes,
      deletedCity: c.changes
    };
  });

  return tx(target);
}

db.getActiveCityConfig = getActiveCityConfig;
db.setActiveCityConfig = setActiveCityConfig;
db.getAvailableCities = getAvailableCities;
db.upsertCity = upsertCity;
db.deleteCity = deleteCity;

module.exports = db;

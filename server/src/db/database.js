const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, '../../../server/kiosk.db');
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
      lat REAL DEFAULT -21.4536,
      lng REAL DEFAULT 47.0858,
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
      lat REAL DEFAULT -21.4536,
      lng REAL DEFAULT 47.0858,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 6. Télémétrie anonyme : sessions & interactions
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

    -- 7. Configuration du Kiosque (Ville active, coordonnées, région)
    CREATE TABLE IF NOT EXISTS kiosk_config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Safe schema migrations for existing database columns
  try { db.exec("ALTER TABLE places ADD COLUMN photo_url TEXT;"); } catch {}
  try { db.exec("ALTER TABLE places ADD COLUMN distance_km TEXT;"); } catch {}
  try { db.exec("ALTER TABLE places ADD COLUMN travel_time TEXT;"); } catch {}
  try { db.exec("ALTER TABLE places ADD COLUMN itinerary_steps TEXT;"); } catch {}
  try { db.exec("ALTER TABLE places ADD COLUMN google_maps_url TEXT;"); } catch {}
  try { db.exec("ALTER TABLE places ADD COLUMN city TEXT DEFAULT 'Fianarantsoa';"); } catch {}
  try { db.exec("ALTER TABLE admins ADD COLUMN full_name TEXT;"); } catch {}
  try { db.exec("ALTER TABLE events ADD COLUMN lat REAL;"); } catch {}
  try { db.exec("ALTER TABLE events ADD COLUMN lng REAL;"); } catch {}
  try { db.exec("ALTER TABLE events ADD COLUMN city TEXT DEFAULT 'Fianarantsoa';"); } catch {}
  try { db.exec("ALTER TABLE emergency_contacts ADD COLUMN lat REAL;"); } catch {}
  try { db.exec("ALTER TABLE emergency_contacts ADD COLUMN lng REAL;"); } catch {}
  try { db.exec("ALTER TABLE emergency_contacts ADD COLUMN city TEXT DEFAULT 'Fianarantsoa';"); } catch {}

  // Update default coordinates and city for existing items if null
  try {
    db.exec(`
      UPDATE places SET city = 'Fianarantsoa' WHERE city IS NULL OR city = '';
      UPDATE events SET city = 'Fianarantsoa' WHERE city IS NULL OR city = '';
      UPDATE events SET lat = -21.4536, lng = 47.0858 WHERE lat IS NULL;
      UPDATE emergency_contacts SET city = 'Fianarantsoa' WHERE city IS NULL OR city = '';
      UPDATE emergency_contacts SET lat = -21.4536, lng = 47.0858 WHERE lat IS NULL;
      -- Specific emergency locations:
      UPDATE emergency_contacts SET lat = -21.4540, lng = 47.0820 WHERE name LIKE '%Police%';
      UPDATE emergency_contacts SET lat = -21.4480, lng = 47.0910 WHERE name LIKE '%CHU%' OR name LIKE '%Tambohobe%';
      UPDATE emergency_contacts SET lat = -21.4560, lng = 47.0830 WHERE name LIKE '%Pompiers%';
      UPDATE emergency_contacts SET lat = -21.4589, lng = 47.0833 WHERE name LIKE '%Tourisme%';
    `);
  } catch {}

  // Initialize default active city config if none exists
  const configCount = db.prepare('SELECT count(*) as count FROM kiosk_config').get().count;
  if (configCount === 0) {
    const setCfg = db.prepare('INSERT OR REPLACE INTO kiosk_config (key, value) VALUES (?, ?)');
    setCfg.run('active_city', 'Fianarantsoa');
    setCfg.run('active_region', 'Haute Matsiatra');
    setCfg.run('active_lat', '-21.4536');
    setCfg.run('active_lng', '47.0858');
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

  // Seed default events if none exists
  const eventsCount = db.prepare('SELECT count(*) as count FROM events').get().count;
  if (eventsCount === 0) {
    const insertEvent = db.prepare(`
      INSERT INTO events (title_fr, title_mg, title_en, description_fr, location, event_date, event_time, lat, lng)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertEvent.run(
      "Grand Marché Traditionnel du Zoma",
      "Tsena Zoma lehibe",
      "Traditional Friday Market",
      "Étalages colorés de vannerie Betsileo, artisanat, fruits des Hautes Terres et épices.",
      "Place du Zoma, Fianarantsoa",
      "2026-11-20",
      "Tous les vendredis dès 6h00",
      -21.4545,
      47.0840
    );

    insertEvent.run(
      "Concert de Musique Traditionnelle Betsileo",
      "Fampisehoana Hira Gasy",
      "Betsileo Polyphonic Concert",
      "Découvrez les chants polyphoniques et la valiha avec les artistes renommés de la région.",
      "Salle d'Œuvre d'Ambozontany",
      "2026-11-25",
      "Samedi à 15h30",
      -21.4530,
      47.0862
    );

    insertEvent.run(
      "Fête des Vendanges et Dégustation des Vins",
      "Fety Fiotazana Voaloboka",
      "Betsileo Wine Harvest Festival",
      "Visite guidée des fûts de chêne et dégustation des grands crus avec les maîtres de chai.",
      "Domaine de Maromby, Fianarantsoa",
      "2026-12-05",
      "De 10h00 à 17h00",
      -21.4620,
      47.0780
    );
  }

  // Seed Comprehensive Real Directory of Fianarantsoa (Tourist Sites & Hotels/Restaurants)
  seedPlacesDirectory();
}

function seedPlacesDirectory() {
  const insertPlace = db.prepare(`
    INSERT OR REPLACE INTO places (
      id, category, name, desc_fr, desc_mg, desc_en,
      price_indicative, contact, lat, lng, rating,
      photo_url, distance_km, travel_time, itinerary_steps, google_maps_url
    ) VALUES (
      @id, @category, @name, @desc_fr, @desc_mg, @desc_en,
      @price_indicative, @contact, @lat, @lng, @rating,
      @photo_url, @distance_km, @travel_time, @itinerary_steps, @google_maps_url
    )
  `);

  const placesData = [
    // ════════════════════════════════════════════════════════════════════════
    // 1. SITES TOURISTIQUES, PATRIMOINE & ITINÉRAIRES (Pour "Carte & Itinéraires")
    // ════════════════════════════════════════════════════════════════════════
    {
      id: 'site_haute_ville',
      category: 'patrimoine',
      name: 'Haute-Ville Historique (Ivone & Ambozontany)',
      desc_fr: 'Cœur historique perché sur les crêtes rocheuses, célèbre pour ses 6 églises monumentales en briques rouges, ses ruelles pavées et ses maisons traditionnelles Betsileo du XIXe siècle inscrites sur la liste indicative de l’UNESCO.',
      desc_mg: 'Tampon-kavoana manan-tantara misy fiangonana lehibe enina sy trano biriky gasy nentim-paharazana.',
      desc_en: 'Historic upper city perched on mountain ridge, renowned for its 6 centennial brick churches and 19th-century Betsileo architecture.',
      price_indicative: 'Accès libre (Circuit guidé ~25 000 Ar)',
      contact: '+261 34 90 112 33',
      lat: -21.4536,
      lng: 47.0858,
      rating: 4.9,
      photo_url: 'https://images.unsplash.com/photo-1547471080-7cc2caa01a7e?auto=format&fit=crop&w=1200&q=80',
      distance_km: '2.2 km du centre',
      travel_time: '8 min en voiture / 25 min à pied',
      itinerary_steps: "Depuis la Gare FCE en ville basse : remonter l'Avenue Royale vers Ampitakely, bifurquer sur la rampe pavée en briques rouges en direction de la Cathédrale Saint-Nom-de-Jésus d'Ambozontany.",
      google_maps_url: 'https://www.google.com/maps/dir/?api=1&destination=-21.4536,47.0858'
    },
    {
      id: 'site_ranomafana',
      category: 'nature',
      name: 'Parc National de Ranomafana',
      desc_fr: 'Sanctuaire mondial de la biodiversité : forêt tropicale humide primaire, cascades spectaculaires de la rivière Namorona, thermes minéraux et refuge de 12 espèces de lémuriens dont le très rare lémurien doré.',
      desc_mg: 'Ala mando arovana misy varika volamena, riandrano mahatalanjona ary loharano mafana fandroana.',
      desc_en: 'World-renowned tropical rainforest sanctuary with 12 lemur species, thermal springs, and cascading rivers.',
      price_indicative: 'Billet parc : ~45 000 Ar + guidage officiel',
      contact: '+261 20 75 523 02',
      lat: -21.2583,
      lng: 47.4208,
      rating: 4.9,
      photo_url: 'https://images.unsplash.com/photo-1534567153574-2b12153a87f0?auto=format&fit=crop&w=1200&q=80',
      distance_km: '62 km de Fianarantsoa',
      travel_time: '1h30 en voiture ou taxi-brousse',
      itinerary_steps: "Prendre la Route Nationale 7 (RN7) en direction du Nord sur 22 km jusqu'à l'embranchement d'Alakamisy-Ambohimaha, puis emprunter la RN25 vers l'Est à travers les forêts de brume jusqu'à l'entrée du parc.",
      google_maps_url: 'https://www.google.com/maps/dir/?api=1&destination=-21.2583,47.4208'
    },
    {
      id: 'site_sahambavy_tea',
      category: 'agrotourisme',
      name: 'Plantation de Thé de Sahambavy & Lac',
      desc_fr: "L'unique plantation de thé de l'Océan Indien sud : 350 hectares de collines d'un vert émeraude ondulant au bord d'un lac paisible. Visites commentées des étapes de cueillette et de l'usine de torréfaction avec dégustation.",
      desc_mg: 'Saha fambolena dite tokana eto Madagasikara, manodidina ny farihy milamina.',
      desc_en: 'The only commercial tea plantation in Madagascar, sprawling across 350 hectares of emerald hills along a serene lake.',
      price_indicative: 'Visite usine : ~15 000 Ar',
      contact: '+261 34 02 048 55',
      lat: -21.4833,
      lng: 47.2167,
      rating: 4.8,
      photo_url: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=1200&q=80',
      distance_km: '23 km à l’Est',
      travel_time: '35 min de route goudronnée',
      itinerary_steps: "Sortir de Fianarantsoa vers l'Est par la route de Sahambavy. Dépasser la station de chemin de fer FCE puis longer les collines de théiers jusqu'à l'entrée principale du Lac Hôtel.",
      google_maps_url: 'https://www.google.com/maps/dir/?api=1&destination=-21.4833,47.2167'
    },
    {
      id: 'site_gare_fce',
      category: 'aventure',
      name: 'Ligne de Chemin de Fer FCE (Fianar - Manakara)',
      desc_fr: "Une des lignes ferroviaires les plus pittoresques au monde, construite dans les années 1930 : 163 km, 48 tunnels creusés dans la roche volcanique et 67 ponts franchissant les falaises luxuriantes jusqu'à l'Océan Indien.",
      desc_mg: 'Lalamby tantara mamakivaky tonelina 48 sy tetezana 67 mankany amin’ny Ranomasina Indianina.',
      desc_en: 'Legendary jungle railway descending the eastern cliffs through 48 tunnels and 67 bridges towards Manakara.',
      price_indicative: 'Billet train : 25 000 à 75 000 Ar',
      contact: '+261 20 75 506 67',
      lat: -21.4589,
      lng: 47.0833,
      rating: 4.8,
      photo_url: 'https://images.unsplash.com/photo-1532103054090-a3392330a6c3?auto=format&fit=crop&w=1200&q=80',
      distance_km: 'Au centre-ville (Ville Basse)',
      travel_time: 'Accès direct',
      itinerary_steps: "Située en ville basse, face à l'avenue principale de la gare. Point de départ pour les trains et siège de l'Office Régional du Tourisme (ORTF).",
      google_maps_url: 'https://www.google.com/maps/dir/?api=1&destination=-21.4589,47.0833'
    },
    {
      id: 'site_kianjasoa',
      category: 'panorama',
      name: 'Belvédère de Kianjasoa & Statue de la Vierge',
      desc_fr: 'Point culminant dominant toute la cuvette de Fianarantsoa. Offre un panorama spectaculaire à 360° sur les rizières en terrasses des vallées Betsileo, la Haute-Ville et les massifs montagneux au coucher du soleil.',
      desc_mg: 'Toerana avo indrindra ahitana ny tanànan’i Fianarantsoa manontolo sy ny tanimbary.',
      desc_en: 'Highest scenic peak overlooking the entire valley, terraced rice paddies, and the historical old town.',
      price_indicative: 'Accès gratuit',
      contact: '+261 34 90 112 33',
      lat: -21.4420,
      lng: 47.0910,
      rating: 4.9,
      photo_url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80',
      distance_km: '3.5 km du centre',
      travel_time: '15 min en voiture / 45 min randonnée',
      itinerary_steps: "Prendre la route menant vers le Nord-Est en direction de Kianjasoa. Une piste monte jusqu'au pied de la colline, suivie d'un sentier pédestre aménagé menant au sommet.",
      google_maps_url: 'https://www.google.com/maps/dir/?api=1&destination=-21.4420,47.0910'
    },
    {
      id: 'site_maromby',
      category: 'agrotourisme',
      name: 'Vignobles de Maromby & Monastère Trappiste',
      desc_fr: 'Tradition viticole ancestrale de Fianarantsoa : découverte des caves de vinification, des fûts de chêne et dégustation des crus réputés (vins rouges, blancs et gris) élaborés par les moines.',
      desc_mg: 'Tanim-boaloboka malaza sy toeram-pamokarana divay ao Maromby.',
      desc_en: 'Historic vineyards and monastery cellars producing the celebrated Betsileo wine.',
      price_indicative: 'Visite & Dégustation : ~10 000 Ar',
      contact: '+261 20 75 510 20',
      lat: -21.4650,
      lng: 47.0750,
      rating: 4.7,
      photo_url: 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?auto=format&fit=crop&w=1200&q=80',
      distance_km: '6 km au Sud-Ouest',
      travel_time: '15 min de route',
      itinerary_steps: "Prendre la RN7 vers le Sud en direction d'Ambalavao sur 4 km, puis suivre la piste fléchée à droite montant vers le domaine de Maromby.",
      google_maps_url: 'https://www.google.com/maps/dir/?api=1&destination=-21.4650,47.0750'
    },
    {
      id: 'site_cathedrale',
      category: 'patrimoine',
      name: 'Cathédrale Saint-Nom-de-Jésus d’Ambozontany',
      desc_fr: 'Majestueux édifice de style néo-roman construit en 1890 en briques rouges de terre cuite, précédé d’un escalier monumental de 132 marches dominant la ville basse.',
      desc_mg: 'Katedraly lehibe vato biriky mena misy tohatra 132 manintona mpitsidika maro.',
      desc_en: 'Iconic neo-Romanesque 1890 brick cathedral preceded by an imposing 132-step stone stairway.',
      price_indicative: 'Entrée libre',
      contact: '+261 20 75 504 12',
      lat: -21.4542,
      lng: 47.0855,
      rating: 4.8,
      photo_url: 'https://images.unsplash.com/photo-1548625361-195fe5787095?auto=format&fit=crop&w=1200&q=80',
      distance_km: '1.8 km de la gare',
      travel_time: '10 min',
      itinerary_steps: "Au sommet de la rampe pavée reliant la ville basse à la Haute-Ville. Visible depuis toute l'agglomération.",
      google_maps_url: 'https://www.google.com/maps/dir/?api=1&destination=-21.4542,47.0855'
    },
    {
      id: 'site_marche_zoma',
      category: 'marche',
      name: 'Grand Marché Traditionnel du Zoma',
      desc_fr: 'Le plus grand rassemblement commercial hebdomadaire de la province : étalages vivants de vannerie Betsileo, chapeaux tressés, épices des forêts (poivre sauvage, vanille, cannelle) et fruits frais des Hautes Terres.',
      desc_mg: 'Tsena lehibe isaky ny zoma ahitana asa-tanana sy vokatry ny tany.',
      desc_en: 'Bustling traditional Friday market showcasing woven baskets, local handicrafts, spices and highland fruits.',
      price_indicative: 'Accès libre',
      contact: 'Office du Marché',
      lat: -21.4545,
      lng: 47.0867,
      rating: 4.7,
      photo_url: 'https://images.unsplash.com/photo-1488459716781-31db52582fe9?auto=format&fit=crop&w=1200&q=80',
      distance_km: 'Centre-ville',
      travel_time: 'Accès direct',
      itinerary_steps: "Situé sur la Place du Zoma en ville basse, face à l'Hôtel Zomatel.",
      google_maps_url: 'https://www.google.com/maps/dir/?api=1&destination=-21.4545,47.0867'
    },

    // ════════════════════════════════════════════════════════════════════════
    // 2. HÔTELS, RÉSIDENCES & BONNES TABLES (Pour "Hôtels & Bonnes Tables")
    // Données réelles issues d'OpenStreetMap & de l'annuaire de Fianarantsoa
    // ════════════════════════════════════════════════════════════════════════
    {
      id: 'hotel_zomatel',
      category: 'hotel',
      name: 'Zomatel Hôtel & Spa',
      desc_fr: 'Hôtel de référence au cœur de Fianarantsoa avec piscine chauffée, spa, chambres climatisées modernes et restaurant gastronomique réputé.',
      desc_mg: 'Trano fandraisam-bahiny kintana misy dobo filomanosana sy sakafo matsiro ao afovoan-tanàna.',
      desc_en: 'Premier hotel in Fianarantsoa featuring swimming pool, spa, comfortable modern suites, and fine dining restaurant.',
      price_indicative: 'À partir de 125 000 Ar / nuit',
      contact: '+261 20 75 507 97',
      lat: -21.45475,
      lng: 47.08672,
      rating: 4.8,
      photo_url: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80',
      distance_km: 'Centre-ville (Place du Zoma)',
      travel_time: 'Centre-ville',
      itinerary_steps: 'Face à la place du Marché du Zoma en ville basse.',
      google_maps_url: 'https://www.google.com/maps/dir/?api=1&destination=-21.45475,47.08672'
    },
    {
      id: 'hotel_cotsoyannis',
      category: 'hotel',
      name: 'Hôtel Cotsoyannis',
      desc_fr: 'Bâtisse historique pleine de charme à l’architecture coloniale, chambres spacieuses avec boiseries, patio ombragé et restaurant convivial à deux pas de la gare FCE.',
      desc_mg: 'Hotely manan-tantara akaikin’ny gara FCE misy efitrano tsara sy sakafo matsiro.',
      desc_en: 'Charming historic hotel near FCE railway station, offering comfortable wooden rooms and traditional dining.',
      price_indicative: 'À partir de 95 000 Ar / nuit',
      contact: '+261 20 75 514 86',
      lat: -21.44935,
      lng: 47.08617,
      rating: 4.6,
      photo_url: 'https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&w=1200&q=80',
      distance_km: 'Rue Jean Ralaimongo (Ville Basse)',
      travel_time: '5 min de la gare',
      itinerary_steps: "Depuis la gare FCE, remonter la rue Jean Ralaimongo vers le Nord sur 400 mètres.",
      google_maps_url: 'https://www.google.com/maps/dir/?api=1&destination=-21.44935,47.08617'
    },
    {
      id: 'hotel_lac_sahambavy',
      category: 'hotel',
      name: 'Lac Hôtel Sahambavy',
      desc_fr: 'Écolodge de charme avec bungalows sur pilotis au bord du lac, entouré des collines de théiers. Bar panoramique, terrasse sur l’eau et gastronomie fraîche.',
      desc_mg: 'Bungalow eo ambony farihy manodidina ny saha dite, milamina sy madio.',
      desc_en: 'Scenic lakeside ecolodge with overwater bungalows bordering tea fields, offering serene nature and fine cuisine.',
      price_indicative: 'À partir de 180 000 Ar / nuit',
      contact: '+261 34 02 048 55',
      lat: -21.48330,
      lng: 47.21670,
      rating: 4.9,
      photo_url: 'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=1200&q=80',
      distance_km: 'Sahambavy (23 km à l’Est)',
      travel_time: '35 min de route',
      itinerary_steps: "Route goudronnée de Sahambavy vers l'Est jusqu'au bord du lac.",
      google_maps_url: 'https://www.google.com/maps/dir/?api=1&destination=-21.4833,47.2167'
    },
    {
      id: 'hotel_tsara_guest',
      category: 'hotel',
      name: 'Tsara Guest House',
      desc_fr: 'Maison d’hôtes de charme accrochée aux pentes de la Haute-Ville. Jardin fleuri luxuriant, vue imprenable sur la ville, chambres cosy et table d’hôtes raffinée.',
      desc_mg: 'Trano fandraisam-bahiny tsara tarehy eny amin’ny Haute-Ville misy zaridaina sy fijerena ny tanàna.',
      desc_en: 'Delightful boutique guest house on the slopes of the Upper Town, with terrace views, lush gardens, and gourmet table.',
      price_indicative: 'À partir de 115 000 Ar / nuit',
      contact: '+261 20 75 502 06',
      lat: -21.45320,
      lng: 47.08610,
      rating: 4.8,
      photo_url: 'https://images.unsplash.com/photo-1540541338287-41700207dee6?auto=format&fit=crop&w=1200&q=80',
      distance_km: 'Haute-Ville',
      travel_time: '7 min du centre',
      itinerary_steps: "Monter la rue de la Haute-Ville vers Ambozontany.",
      google_maps_url: 'https://www.google.com/maps/dir/?api=1&destination=-21.4532,47.0861'
    },
    {
      id: 'hotel_tombontsoa',
      category: 'hotel',
      name: 'Hôtel Tombontsoa',
      desc_fr: 'Hôtel calme niché dans un cadre verdoyant avec ferme d’application agro-pastorale. Produits laitiers artisanaux frais au petit-déjeuner et accueil chaleureux.',
      desc_mg: 'Toerana milamina sy madio misy vokatry ny ronono vaovao sy sakafo natoraly.',
      desc_en: 'Peaceful hotel set in agricultural greenery, known for its fresh local dairy products and warm hospitality.',
      price_indicative: 'À partir de 85 000 Ar / nuit',
      contact: '+261 20 75 516 62',
      lat: -21.45032,
      lng: 47.08768,
      rating: 4.5,
      photo_url: 'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1200&q=80',
      distance_km: 'Route d’Alakamisy, Ampitakely',
      travel_time: '10 min',
      itinerary_steps: "Depuis Ampitakely, suivre la route vers Tombontsoa.",
      google_maps_url: 'https://www.google.com/maps/dir/?api=1&destination=-21.45032,47.08768'
    },
    {
      id: 'hotel_rova',
      category: 'hotel',
      name: 'Rova Hôtel',
      desc_fr: 'Hôtel avec terrasse panoramique sur les toits de Fianarantsoa et la cathédrale. Chambres lumineuses, bar convivial et service attentionné.',
      desc_mg: 'Hotely misy fahitana malalaka ny tanàna sy ny fiangonana.',
      desc_en: 'Panoramic hotel with rooftop terrace views of the red-tiled city roofs and cathedral.',
      price_indicative: 'À partir de 78 000 Ar / nuit',
      contact: '+261 20 75 505 52',
      lat: -21.45420,
      lng: 47.08644,
      rating: 4.4,
      photo_url: 'https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&w=1200&q=80',
      distance_km: 'Proximité Haute-Ville',
      travel_time: '8 min',
      itinerary_steps: "À mi-hauteur sur la colline menant au Rova.",
      google_maps_url: 'https://www.google.com/maps/dir/?api=1&destination=-21.4542,47.08644'
    },
    {
      id: 'hotel_ranjalia',
      category: 'hotel',
      name: 'Hôtel Ranjalia',
      desc_fr: 'Hébergement calme et économique situé au quartier d’Ambalapaiso. Chambres propres avec sanitaires privés, idéal pour les séjours universitaires et touristiques.',
      desc_mg: 'Trano fandraisam-bahiny madio sy takatry ny vola ao Ambalapaiso.',
      desc_en: 'Budget-friendly and clean hotel in Ambalapaiso, convenient for independent travelers.',
      price_indicative: 'À partir de 65 000 Ar / nuit',
      contact: '+261 34 22 145 80',
      lat: -21.45228,
      lng: 47.08507,
      rating: 4.3,
      photo_url: 'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?auto=format&fit=crop&w=1200&q=80',
      distance_km: 'Ambalapaiso',
      travel_time: '6 min',
      itinerary_steps: "Làlana Randriantsilanzaka Joseph, quartier Ambalapaiso.",
      google_maps_url: 'https://www.google.com/maps/dir/?api=1&destination=-21.45228,47.08507'
    },
    {
      id: 'hotel_plazza_inn',
      category: 'hotel',
      name: 'Hôtel Plazza Inn',
      desc_fr: 'Établissement moderne au centre d’Ampitakely, à proximité immédiate des banques, commerces et transports régionaux.',
      desc_mg: 'Hotely maoderina ao Ampitakely akaikin’ny banky sy tsena.',
      desc_en: 'Modern hotel in commercial Ampitakely, close to financial and transport hubs.',
      price_indicative: 'À partir de 95 000 Ar / nuit',
      contact: '+261 32 05 520 10',
      lat: -21.45399,
      lng: 47.08846,
      rating: 4.5,
      photo_url: 'https://images.unsplash.com/photo-1596436889106-be35e843f974?auto=format&fit=crop&w=1200&q=80',
      distance_km: 'Centre commercial Ampitakely',
      travel_time: '5 min',
      itinerary_steps: "En face du centre commercial d'Ampitakely.",
      google_maps_url: 'https://www.google.com/maps/dir/?api=1&destination=-21.45399,47.08846'
    },
    {
      id: 'resto_riziere',
      category: 'restaurant',
      name: 'Restaurant La Rizière (Haute-Ville)',
      desc_fr: 'Restaurant gastronomique d’application de l’école hôtelière. Carte inventive mariant saveurs Betsileo et cuisine française, vue panoramique sur les rizières en terrasses.',
      desc_mg: 'Toeram-pisakafoanana kanto misy fijerena rizières sy sakafo nentin-drazana voadio.',
      desc_en: 'Celebrated hotel school culinary restaurant serving French-Malagasy fusion with panoramic rice terrace views.',
      price_indicative: 'Plats de 18 000 à 45 000 Ar',
      contact: '+261 34 11 254 78',
      lat: -21.45100,
      lng: 47.08500,
      rating: 4.8,
      photo_url: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80',
      distance_km: 'Rampe d’Ambozontany',
      travel_time: '7 min',
      itinerary_steps: "Sur la rampe menant à la Haute-Ville, fléché depuis le bas.",
      google_maps_url: 'https://www.google.com/maps/dir/?api=1&destination=-21.451,47.085'
    },
    {
      id: 'resto_entrecote',
      category: 'restaurant',
      name: 'L’Entrecôte du Zoma',
      desc_fr: 'Spécialités de viandes de zébu grillées au feu de bois, sauces madagascar au poivre vert frais, frites maison et terrasse conviviale ensoleillée.',
      desc_mg: 'Hena omby matsiro natsatsika tamin’ny afo sy saosy dipoavatra maitso.',
      desc_en: 'Wood-fired grilled zebu steakhouse, fresh green pepper sauces, and lively outdoor terrace.',
      price_indicative: 'Plats dès 18 000 Ar',
      contact: '+261 34 14 330 90',
      lat: -21.45497,
      lng: 47.08687,
      rating: 4.7,
      photo_url: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=1200&q=80',
      distance_km: 'Place du Zoma',
      travel_time: 'Centre-ville',
      itinerary_steps: "Angle de la place du Zoma en ville basse.",
      google_maps_url: 'https://www.google.com/maps/dir/?api=1&destination=-21.45497,47.08687'
    },
    {
      id: 'resto_chez_mi',
      category: 'restaurant',
      name: 'Restaurant Chez Mi (Spécialités Betsileo)',
      desc_fr: 'Table incontournable pour savourer le véritable Romazava royal, le Henakisoa sy ravitoto et les poissons d’eau douce accompagnés de riz rouge vary gasy.',
      desc_mg: 'Sakafo tena gasy henakisoa sy ravitoto ary romazava hena omby.',
      desc_en: 'Authentic Malagasy culinary favorite serving royal romazava and slow-cooked pork with cassava leaves.',
      price_indicative: 'Plats de 12 000 à 25 000 Ar',
      contact: '+261 34 60 789 12',
      lat: -21.45481,
      lng: 47.08520,
      rating: 4.6,
      photo_url: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1200&q=80',
      distance_km: 'Quartier Ampitakely',
      travel_time: '5 min',
      itinerary_steps: "Rue commerçante d'Ampitakely.",
      google_maps_url: 'https://www.google.com/maps/dir/?api=1&destination=-21.45481,47.0852'
    },
    {
      id: 'resto_chez_aina',
      category: 'restaurant',
      name: 'Restaurant Chez Aina',
      desc_fr: 'Cuisine familiale soignée : canard aux baies roses, tilapias grillés, soupes chinoises chaudes et jus de fruits frais de saison pressés minute.',
      desc_mg: 'Sakafo nentim-paharazana matsiro sy ranom-boankazo natoraly.',
      desc_en: 'Welcoming family bistro specializing in fresh lake fish, roast duck, and fresh fruit juices.',
      price_indicative: 'Plats dès 14 000 Ar',
      contact: '+261 33 12 345 67',
      lat: -21.45479,
      lng: 47.08529,
      rating: 4.5,
      photo_url: 'https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=1200&q=80',
      distance_km: 'Rue du Commerce',
      travel_time: 'Centre-ville',
      itinerary_steps: "Près de l'avenue commerçante principale.",
      google_maps_url: 'https://www.google.com/maps/dir/?api=1&destination=-21.45479,47.08529'
    },
    {
      id: 'resto_la_verdure',
      category: 'restaurant',
      name: 'Restaurant La Verdure',
      desc_fr: 'Cadre ombragé et reposant entouré d’arbres centenaires. Grillades mixtes, carpaccio de zébu, salades fraîches et vins locaux de Maromby.',
      desc_mg: 'Toerana milamina misy hazo manitra sy sakafo isan-karazany.',
      desc_en: 'Peaceful garden restaurant offering mixed grills, zebu carpaccio, fresh salads, and local wines.',
      price_indicative: 'Plats de 15 000 à 35 000 Ar',
      contact: '+261 34 04 887 23',
      lat: -21.45715,
      lng: 47.08727,
      rating: 4.6,
      photo_url: 'https://images.unsplash.com/photo-1543007630-9710e4a00a20?auto=format&fit=crop&w=1200&q=80',
      distance_km: 'Avenue Général de Gaulle',
      travel_time: '7 min',
      itinerary_steps: "Avenue Général de Gaulle en direction de la Haute-Ville.",
      google_maps_url: 'https://www.google.com/maps/dir/?api=1&destination=-21.45715,47.08727'
    },
    {
      id: 'resto_panda_pizza',
      category: 'restaurant',
      name: 'Pizzeria & Snack Le Panda',
      desc_fr: 'Pizzas cuites au four à bois, pâtes fraîches, burgers généreux, crêpes et glaces artisanales. Service continu idéal pour les familles et pauses rapides.',
      desc_mg: 'Pizza nandrahoina tamin’ny afo sy sakafo maivana.',
      desc_en: 'Wood-fired oven pizzas, pasta, burgers, crepes, and handmade ice cream.',
      price_indicative: 'Pizzas dès 16 000 Ar',
      contact: '+261 34 05 678 90',
      lat: -21.45350,
      lng: 47.08750,
      rating: 4.4,
      photo_url: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=1200&q=80',
      distance_km: 'Ville Basse',
      travel_time: 'Centre-ville',
      itinerary_steps: "Quartier animé d'Ampitakely.",
      google_maps_url: 'https://www.google.com/maps/dir/?api=1&destination=-21.4535,47.0875'
    },
    {
      id: 'guide_ortf',
      category: 'guide',
      name: 'Association des Guides de la Haute-Ville (ORTF)',
      desc_fr: 'Guides certifiés et accrédités par l’Office du Tourisme pour les visites architecturales, historiques et culturelles de la Haute-Ville et des rizières.',
      desc_mg: 'Mpitarika mpizahatany ofisialy manazava ny tantaran’ny Haute-Ville.',
      desc_en: 'Official accredited local guides for historic Upper Town architectural and cultural walking tours.',
      price_indicative: 'Circuit dès 25 000 Ar / pers.',
      contact: '+261 34 90 112 33',
      lat: -21.45300,
      lng: 47.08620,
      rating: 4.9,
      photo_url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80',
      distance_km: 'Pavillon d’accueil Haute-Ville',
      travel_time: 'Haute-Ville',
      itinerary_steps: "Point de rencontre au pavillon d'accueil en Haute-Ville ou à la gare FCE.",
      google_maps_url: 'https://www.google.com/maps/dir/?api=1&destination=-21.453,47.0862'
    },
    {
      id: 'transp_coop_fiana',
      category: 'transport',
      name: 'Coopérative Régionale Transport Fiana',
      desc_fr: 'Flotte de 4x4 tout-terrain récents avec chauffeurs expérimentés pour excursions vers Ranomafana, Ambalavao, l’Andringitra et circuits Sud.',
      desc_mg: 'Fiara 4x4 mankany Ranomafana sy Andringitra miaraka amin’ny mpamily.',
      desc_en: 'All-terrain 4WD rental with experienced drivers for national parks, Ranomafana, and southern circuits.',
      price_indicative: 'Tarifs selon circuit (devis immédiat)',
      contact: '+261 32 04 998 12',
      lat: -21.45400,
      lng: 47.08800,
      rating: 4.5,
      photo_url: 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=1200&q=80',
      distance_km: 'Gare Routière Ampitakely',
      travel_time: 'Centre-ville',
      itinerary_steps: "Agence principale à la gare routière d'Ampitakely.",
      google_maps_url: 'https://www.google.com/maps/dir/?api=1&destination=-21.454,47.088'
    }
  ];

  const insertMany = db.transaction((places) => {
    for (const place of places) {
      insertPlace.run(place);
    }
  });

  try {
    insertMany(placesData);
    console.log(`[KIOSK DB] Successfully seeded ${placesData.length} places (Sites + Hotels + Restaurants)`);
  } catch (err) {
    console.warn('[KIOSK DB] Seed places warning:', err.message);
  }
}

initDatabase();

// Warn at startup if legacy U+FFFD replacement characters are still stored.
// They indicate data corrupted by the old latin1 -> utf8 conversion bug.
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

function getActiveCityConfig() {
  const rows = db.prepare('SELECT key, value FROM kiosk_config').all();
  const cfg = {
    active_city: 'Fianarantsoa',
    active_region: 'Haute Matsiatra',
    active_lat: -21.4536,
    active_lng: 47.0858,
    active_country: 'Madagascar'
  };
  for (const r of rows) {
    if (r.key === 'active_lat' || r.key === 'active_lng') {
      cfg[r.key] = parseFloat(r.value);
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
  return getActiveCityConfig();
}

function getAvailableCities() {
  const cities = db.prepare(`
    SELECT DISTINCT city FROM (
      SELECT city FROM places WHERE city IS NOT NULL AND city != ''
      UNION
      SELECT city FROM events WHERE city IS NOT NULL AND city != ''
      UNION
      SELECT city FROM emergency_contacts WHERE city IS NOT NULL AND city != ''
    ) ORDER BY city ASC
  `).all();

  return cities.map(c => {
    const places_count = db.prepare('SELECT count(*) as count FROM places WHERE city = ?').get(c.city).count;
    const events_count = db.prepare('SELECT count(*) as count FROM events WHERE city = ?').get(c.city).count;
    const emergency_count = db.prepare('SELECT count(*) as count FROM emergency_contacts WHERE city = ?').get(c.city).count;
    const samplePlace = db.prepare('SELECT lat, lng FROM places WHERE city = ? AND lat IS NOT NULL AND lat != 0 LIMIT 1').get(c.city);

    let lat = samplePlace ? samplePlace.lat : -21.4536;
    let lng = samplePlace ? samplePlace.lng : 47.0858;
    let region = 'Madagascar';

    if (c.city === 'Fianarantsoa') {
      lat = -21.4536; lng = 47.0858; region = 'Haute Matsiatra';
    } else if (c.city === 'Manakara') {
      lat = -22.1450; lng = 48.0114; region = 'Fitovinany';
    } else if (c.city === 'Antsirabe') {
      lat = -19.8714; lng = 47.0347; region = 'Vakinankaratra';
    }

    return {
      city: c.city,
      lat,
      lng,
      region,
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

  const tx = db.transaction((name) => {
    const p = delPlaces.run(name);
    const e = delEvents.run(name);
    const em = delEmergency.run(name);
    return {
      deletedPlaces: p.changes,
      deletedEvents: e.changes,
      deletedEmergency: em.changes
    };
  });

  return tx(target);
}

db.getActiveCityConfig = getActiveCityConfig;
db.setActiveCityConfig = setActiveCityConfig;
db.getAvailableCities = getAvailableCities;
db.deleteCity = deleteCity;

module.exports = db;

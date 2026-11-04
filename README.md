# 🗺️ Kiosque Touristique Interactif — Fianarantsoa

> **Projet universitaire — ENI M1 — 2024/2025**  
> Kiosque d'affichage numérique interactif pour les touristes visitant Fianarantsoa, Haute Matsiatra, Madagascar.

---

## 📋 Table des matières

1. [Aperçu du projet](#aperçu)
2. [Architecture technique](#architecture)
3. [Prérequis](#prérequis)
4. [Installation & Démarrage (développement)](#développement)
5. [Déploiement kiosque (production)](#déploiement)
6. [Guide Back-Office administrateur](#back-office)
7. [Fonctionnalités détaillées](#fonctionnalités)
8. [Structure des dossiers](#structure)
9. [FAQ & Dépannage](#dépannage)

---

## 🎯 Aperçu {#aperçu}

Ce kiosque numérique fonctionne en **3 modes** :

| Mode | Déclencheur | Description |
|------|------------|-------------|
| **Veille** | Aucun visiteur détecté | Carousel de publicités en boucle |
| **Accueil** | Visage détecté à ~2 m | Sélection de langue (🇲🇬 / 🇫🇷 / 🇬🇧) |
| **Menu** | Langue choisie | 6 modules touristiques accessibles |

Le retour automatique à la veille se déclenche après **30 secondes d'inactivité** ou si le visiteur s'éloigne.

---

## 🏗️ Architecture technique {#architecture}

```
┌─────────────────────────────────────────────────┐
│              NAVIGATEUR (Chromium Kiosk)         │
│                                                  │
│  React 18 + Vite + Tailwind CSS                  │
│  ├── MediaPipe FaceDetector (détection caméra)   │
│  ├── Leaflet.js (carte OpenStreetMap)            │
│  ├── Web Audio API (phrases utiles audio)        │
│  └── Service Worker (mode hors-ligne)            │
└──────────────┬───────────────┬──────────────────┘
               │ HTTP REST API │ Fichiers statiques
               ▼               ▼
┌──────────────────────────────────────────────────┐
│          Node.js + Express (port 5000)            │
│  ├── SQLite (better-sqlite3) — kiosk.db          │
│  ├── Multer (upload images/vidéos)               │
│  ├── JWT (authentification admin)                │
│  └── bcryptjs (hashage mots de passe)            │
└──────────────────────────────────────────────────┘
```

### Stack technologique

| Composant | Technologie | Raison du choix |
|-----------|------------|-----------------|
| Frontend | React 18 + Vite | Moderne, hot reload, build rapide |
| Styles | Tailwind CSS v3 | Utility-first, idéal pour UI tactile |
| Icônes | Lucide React | Open source, cohérent |
| Carte | Leaflet + OpenStreetMap | Gratuit, 100% hors-ligne possible |
| Détection | MediaPipe FaceDetector | Local, rapide, RGPD compliant |
| Backend | Node.js + Express | Léger, performant |
| Base de données | SQLite (better-sqlite3) | Zéro configuration, fichier unique |
| Auth | JWT + bcryptjs | Sécurisé, sans serveur d'auth |
| Process | PM2 | Auto-restart, logs centralisés |

---

## 💻 Prérequis {#prérequis}

- **Node.js** ≥ 18.x → [nodejs.org](https://nodejs.org)
- **npm** ≥ 9.x (inclus avec Node.js)
- **Navigateur** : Chromium / Google Chrome (pour le mode kiosque)
- **Webcam** : obligatoire pour la détection de présence
- **Système** : Windows 10/11, Ubuntu 22.04+, ou Raspberry Pi OS

---

## 🚀 Installation & Démarrage (développement) {#développement}

### 1. Cloner / ouvrir le projet

```bash
cd "c:\Users\WINDOWS 10\Desktop\ENI\M1"
```

### 2. Installer les dépendances

```bash
# Backend
cd server
npm install

# Frontend
cd ../client
npm install
```

### 3. Démarrer les serveurs de développement

**Terminal 1 — Backend API :**
```bash
cd server
npm start
# → http://localhost:5000
```

**Terminal 2 — Frontend Vite :**
```bash
cd client
npm run dev -- --host
# → http://localhost:5173
```

### 4. Ouvrir dans le navigateur

```
http://localhost:5173
```

Pour simuler le mode kiosque (sans caméra) : appuyez sur **Alt + clic** sur l'écran de veille pour passer directement au menu.

---

## 🖥️ Déploiement kiosque (production) {#déploiement}

### Option A — Script automatique Windows (recommandé)

```bat
deploy\launch-kiosk.bat
```

Ce script :
1. Build le frontend (`npm run build`)
2. Lance backend + frontend via PM2
3. Ouvre Chromium en mode `--kiosk` plein écran sur `http://localhost:3000`

Pour arrêter :
```bat
deploy\stop-kiosk.bat
```

### Option B — Démarrage manuel avec PM2

```bash
# Installer PM2 globalement
npm install -g pm2

# Build du frontend
cd client
npm run build

# Lancer via PM2
cd ../deploy
pm2 start ecosystem.config.js

# Activer le démarrage automatique au boot
pm2 save
pm2 startup
```

### Option C — Mode développement avec URL de production

```bash
# Backend
cd server && npm start

# Frontend (prévisualisation build)
cd client && npm run preview -- --host --port 3000
```

Puis ouvrir Chromium manuellement :
```bash
chromium-browser --kiosk --noerrdialogs --disable-infobars http://localhost:3000
```

### Adresses de production

| Service | URL | Usage |
|---------|-----|-------|
| Kiosque public | http://localhost:3000 | Écran tactile |
| API Backend | http://localhost:5000 | Interne |
| Health check | http://localhost:5000/api/health | Monitoring |

---

## 🔐 Guide Back-Office administrateur {#back-office}

### Accès

Depuis le kiosque : **appui long (5 secondes) sur le coin inférieur droit** de l'écran.

> **Identifiants par défaut :**  
> Identifiant : `admin`  
> Mot de passe : `admin123`  
> ⚠️ Changez ces identifiants immédiatement en production !

### Onglets disponibles

| Onglet | Fonctionnalités |
|--------|----------------|
| 📢 **Publicités** | Ajouter/modifier/supprimer des slides (image URL ou fichier local, vidéo MP4) |
| 📍 **Lieux & Itinéraires** | CRUD des sites touristiques avec GPS (sélection sur carte), photos, étapes |
| 📅 **Événements & Météo** | CRUD événements avec validation date (pas de date passée), GPS via carte |
| 🚨 **Urgences** | Contacts d'urgence (police, médecins, pompiers) avec localisation |
| 📊 **Statistiques** | Sessions, durée moyenne, langues, pics d'affluence, graphe 7 jours, top QR |
| 👥 **Comptes** | Modifier son profil, créer des comptes admin, supprimer des comptes |

### Upload de fichiers

Les médias uploadés sont stockés dans `server/uploads/`.  
Formats supportés : `.jpg`, `.jpeg`, `.png`, `.webp`, `.gif`, `.mp4`

---

## 📱 Fonctionnalités détaillées {#fonctionnalités}

### 1. Mode Veille
- Carousel automatique des publicités actives (backend) avec fallback mock
- Supporte images (URL ou fichier) et vidéos MP4
- Durée configurable par slide

### 2. Détection de présence
- **Technologie** : MediaPipe FaceDetector (WASM local, GPU si dispo)
- **Distance estimée** : ~2 m (basé sur la taille du visage dans le frame)
- **Délai de confirmation** : 1 seconde (évite les faux déclenchements)
- **Respect vie privée** : aucune image enregistrée ni transmise

### 3. Carte & Itinéraires
- Carte OpenStreetMap interactive (Leaflet)
- 9 catégories de lieux : Patrimoine, Nature, Hôtels, Restaurants, Musées, Boutiques, Marchés, Parcs, Panoramas
- QR Code d'itinéraire direct Google Maps (`dir/?api=1&destination=...`)
- Photos des lieux, étapes d'itinéraire, distance et durée

### 4. Hôtels & Bonnes Tables
- Données chargées depuis le backend avec fallback hors-ligne
- Filtres par catégorie : Hôtels, Restaurants, Guides, Transports, Boutiques, Patrimoine
- QR Code itinéraire par établissement
- Photos, prix indicatifs, contacts téléphoniques

### 5. Événements & Météo
- Météo simulée (intégration API météo possible)
- Événements avec date d'expiration automatique
- QR Code de navigation vers le lieu de l'événement
- Badges visuels : "Aujourd'hui", "Cette semaine", "Expiré"

### 6. Phrases utiles
- Trilingue : Malagasy / Français / English
- Catégories : Salutations, Restauration, Transport, Urgences, Commerce
- Synthèse vocale via Web Speech API (`SpeechSynthesis`)
- Son de confirmation via Web Audio API

### 7. Numéros d'urgence
- Police, CHU, Pompiers, Office du Tourisme
- Numéro affiché en grand pour lecture à distance
- QR Code de navigation vers le service
- Localisation GPS précise

### 8. Convertisseur de devises
- Conversion instantanée Ariary (MGA) ⇄ Euro (€) / Dollar US ($)
- Pavé numérique tactile et montants rapides adaptés aux prix locaux
- Taux indicatifs par défaut : `1 EUR = 5 000 MGA`, `1 USD = 4 600 MGA`
- Actualisation optionnelle via `open.er-api.com` avec cache local (`localStorage`)
- Fonctionne hors-ligne grâce aux taux en cache ou aux taux par défaut

### 9. Statistiques anonymes
- Comptage de sessions (sans données personnelles)
- Durée moyenne par session
- Répartition des langues choisies
- Pics d'affluence par tranche horaire
- Top des modules consultés
- Top des QR Codes scannés
- Tendance sur 7 jours (histogramme)

---

## 📁 Structure des dossiers {#structure}

```
M1/
├── client/                     # Frontend React
│   ├── public/
│   │   ├── wasm/              # Fichiers WASM MediaPipe
│   │   └── models/            # Modèle TFLite FaceDetector
│   ├── src/
│   │   ├── components/        # Header, CameraHud, LocationPicker, InactivityModal
│   │   ├── data/              # translations.js (i18n), mockData.js
│   │   ├── hooks/             # usePresenceCamera, useInactivityTimer
│   │   ├── services/          # api.js, analytics.js
│   │   ├── utils/             # navigation.js (QR Code + Google Maps)
│   │   └── views/
│   │       ├── admin/         # BackOfficeModal.jsx
│   │       ├── converter/     # ConverterModuleView.jsx
│   │       ├── emergency/     # EmergencyModuleView.jsx
│   │       ├── language/      # LanguageSelectView.jsx
│   │       ├── map/           # MapModuleView.jsx
│   │       ├── menu/          # MainMenuView.jsx
│   │       ├── phrases/       # PhrasesModuleView.jsx
│   │       ├── places/        # PlacesModuleView.jsx
│   │       ├── screensaver/   # ScreensaverView.jsx
│   │       └── weather/       # WeatherModuleView.jsx
│   ├── App.jsx                # Machine à états principale
│   └── index.html
│
├── server/                     # Backend Node.js
│   ├── src/
│   │   ├── db/database.js     # SQLite init + migrations + seed
│   │   ├── middlewares/       # authMiddleware.js (JWT)
│   │   └── routes/
│   │       ├── ads.js         # CRUD publicités
│   │       ├── auth.js        # Login, users, profil
│   │       ├── emergency.js   # CRUD urgences
│   │       ├── events.js      # CRUD événements
│   │       ├── places.js      # CRUD lieux + itinéraires
│   │       └── stats.js       # Télémétrie anonyme
│   ├── uploads/               # Médias uploadés (images, vidéos)
│   ├── kiosk.db               # Base de données SQLite
│   └── server.js              # Point d'entrée Express
│
├── deploy/                     # Scripts de déploiement
│   ├── ecosystem.config.js    # Configuration PM2
│   ├── launch-kiosk.bat       # Lanceur Windows (production)
│   └── stop-kiosk.bat         # Arrêt du kiosque
│
├── logs/                       # Logs PM2 (créés au premier démarrage)
└── README.md                   # Ce fichier
```

---

## 🔧 FAQ & Dépannage {#dépannage}

### La caméra ne démarre pas
- Vérifiez que le navigateur a la permission d'accéder à la caméra
- Ouvrez `http://localhost:5173` (pas `file://...`)
- HTTPS requis sur certains navigateurs — en dev, `localhost` suffit

### Le moniteur IA (MediaPipe) clignote
- Causé par des re-renders React trop fréquents
- Solution : le composant `CameraDebugHud` utilise `useRef` + `requestAnimationFrame` stable
- Désactivez le HUD en production : `<CameraDebugHud visible={false} />`

### Les images uploadées n'apparaissent pas
- Vérifiez que `server/uploads/` existe et est accessible
- Vérifiez la configuration Multer dans `server/src/routes/ads.js`
- URL attendue : `http://localhost:5000/uploads/nom-fichier.jpg`

### Les caractères accentués s'affichent mal (� / ?)
- Cause historique : l'ancienne fonction `fixUtf8` convertissait en `latin1 -> UTF-8` des chaînes déjà correctes, produisant le caractère de remplacement `U+FFFD` (`�`).
- Correction : `fixUtf8` a été supprimée ; Multer/busboy 1.6 décode déjà les champs multipart en UTF-8.
- Données déjà corrompues : lancer `node server/scripts/repair-utf8.js` (les valeurs ciblées sont réécrites, avec un mode `--dry-run`).
- Garde-fou : au démarrage, le serveur logue un avertissement si des valeurs `U+FFFD` subsistent en base.

### Erreur `table places has no column named photo_url`
- La DB existante n'a pas la colonne
- Solution : les migrations `try { ALTER TABLE ... ADD COLUMN } catch {}` dans `database.js` gèrent ça automatiquement

### Le QR Code ne lance pas l'itinéraire
- L'URL doit être `https://www.google.com/maps/dir/?api=1&destination=LAT,LNG`
- Vérifiez `client/src/utils/navigation.js` → fonction `getDirectionsUrl()`

### Retour veille trop rapide / trop lent
- Modifiez `INACTIVITY_TIMEOUT` dans `client/src/hooks/useInactivityTimer.js` (défaut : 30s)
- Modifiez `LANG_SELECT_TIMEOUT` dans `client/src/views/language/LanguageSelectView.jsx` (défaut : 15s)

### Commandes PM2 utiles

```bash
pm2 list              # État de tous les processus
pm2 logs              # Logs en temps réel
pm2 restart all       # Redémarrer tous les services
pm2 stop all          # Arrêter tous les services
pm2 monit             # Dashboard interactif
```

---

## 🛡️ Sécurité & Vie privée

- **Aucune image** de la caméra n'est stockée ou transmise — traitement 100% local (MediaPipe WASM)
- **Aucune donnée personnelle** n'est collectée — statistiques 100% anonymes
- **JWT** avec durée limitée pour le back-office admin
- **Mots de passe** hashés avec `bcryptjs` (10 rounds de salt)
- **SQLite** locale — pas de connexion à un serveur distant

---

## 📄 Licence

Projet académique — École Nationale d'Informatique (ENI), Madagascar.  
Usage éducatif uniquement.

---

*Développé avec ❤️ pour promouvoir le tourisme à Fianarantsoa, capitale spirituelle de Madagascar.*


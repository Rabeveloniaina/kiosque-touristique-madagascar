# Kiosque Touristique Interactif — Madagascar

> **Projet de Kiosque Numérique Tactile**  
> Borne interactive d'affichage et de guidage touristique multi-villes pour Madagascar.

---

## Table des matières

1. [Aperçu du projet](#apercu)
2. [Architecture technique](#architecture)
3. [Prérequis](#prerequis)
4. [Installation & Démarrage (développement)](#developpement)
5. [Déploiement kiosque (production)](#deploiement)
6. [Guide Back-Office administrateur](#back-office)
7. [Fonctionnalités détaillées](#fonctionnalites)
8. [Structure des dossiers](#structure)
9. [FAQ & Dépannage](#depannage)
10. [Sécurité & Vie privée](#securite)
11. [Licence](#licence)

---

## Aperçu {#apercu}

Ce kiosque numérique fonctionne en **3 modes** :

| Mode | Déclencheur | Description |
|------|------------|-------------|
| **Veille** | Aucun visiteur détecté | Carousel de publicités et promotions locales en boucle |
| **Accueil** | Visage détecté à ~2 m | Sélection de la langue (Malagasy / Français / English) |
| **Menu** | Langue choisie | 6 modules touristiques accessibles de manière tactile |

Le retour automatique à la veille se déclenche après **30 secondes d'inactivité** ou si le visiteur s'éloigne.

---

## Architecture technique {#architecture}

```
┌─────────────────────────────────────────────────┐
│              NAVIGATEUR (Chromium Kiosk)         │
│                                                  │
│  React 18 + Vite + Tailwind CSS                  │
│  ├── MediaPipe FaceDetector (détection caméra)   │
│  ├── Leaflet.js (carte OpenStreetMap)            │
│  ├── Web Audio API + MMS-TTS (audio malgache)    │
│  └── Service Worker (mode hors-ligne)            │
└──────────────┬───────────────┬──────────────────┘
               │ HTTP REST API │ Fichiers statiques
               ▼               ▼
┌──────────────────────────────────────────────────┐
│          Node.js + Express (port 5000)            │
│  ├── SQLite (better-sqlite3) — kiosk.db          │
│  ├── Multer (images, vidéos, audio)              │
│  ├── JWT (authentification admin)                │
│  └── bcryptjs (hashage mots de passe)            │
└──────────────────────────────────────────────────┘
```

### Stack technologique

| Composant | Technologie | Raison du choix |
|-----------|------------|-----------------|
| Frontend | React 18 + Vite | Moderne, hot reload, build rapide |
| Styles | Tailwind CSS v3 | Utility-first, adapté aux écrans tactiles |
| Icônes | Lucide React | Vectoriel SVG léger et uniforme |
| Carte | Leaflet + OpenStreetMap | Autonome, routage in-app sans onglet externe |
| Détection | MediaPipe FaceDetector | Traitement local sur l'appareil, respect de la vie privée |
| Backend | Node.js + Express | Léger, performant |
| Base de données | SQLite (better-sqlite3) | Zéro configuration, fichier unique, portable |
| Synthèse vocale | Meta MMS-TTS (ONNX) | Prononciation native malgache en local |
| Auth | JWT + bcryptjs | Sécurisé, sans dépendance externe |
| Process | PM2 | Démarrage automatique, supervision et logs |

---

## Prérequis {#prerequis}

- **Node.js** ≥ 18.x ([nodejs.org](https://nodejs.org))
- **npm** ≥ 9.x (inclus avec Node.js)
- **Navigateur** : Chromium / Google Chrome / Microsoft Edge (pour le mode kiosque plein écran)
- **Webcam** : caméra standard pour la détection de présence
- **Système** : Windows 10/11, Ubuntu 22.04+, ou Raspberry Pi OS

---

## Installation & Démarrage (développement) {#developpement}

### 1. Cloner le projet

```bash
git clone https://github.com/Rabeveloniaina/kiosque-touristique-madagascar.git
cd kiosque-touristique-madagascar
```

### 2. Installer les dépendances

```bash
# Dépendances du serveur backend
cd server
npm install

# Dépendances du client frontend
cd ../client
npm install
```

### 3. Démarrer les serveurs en mode développement

**Terminal 1 — Serveur Backend :**
```bash
cd server
npm start
# API accessible sur : http://localhost:5000
```

**Terminal 2 — Application Client :**
```bash
cd client
npm run dev -- --host
# Application accessible sur : http://localhost:5173
```

### 4. Générer les audios de prononciation malgache (optionnel)

```bash
cd server
npm run generate:audio
# Génération locale via MMS-TTS (Meta)
```

### 5. Accéder à l'application

Ouvrez votre navigateur sur :
```
http://localhost:5173
```

Pour simuler l'approche d'un visiteur sans webcam : utilisez le bouton « Simuler présence » situé en bas à droite de l'écran.

---

## Déploiement kiosque (production) {#deploiement}

### Option A — Script automatique Windows

```bat
deploy\launch-kiosk.bat
```

Ce script effectue automatiquement les opérations suivantes :
1. Compilation de production du frontend (`npm run build`)
2. Lancement du serveur backend et de l'application via PM2
3. Ouverture du navigateur en mode plein écran `--kiosk` sur `http://localhost:3000`

Pour arrêter le kiosque :
```bat
deploy\stop-kiosk.bat
```

### Option B — Démarrage manuel avec PM2

```bash
# Installation globale de PM2
npm install -g pm2

# Compilation du frontend
cd client
npm run build

# Lancement des processus
cd ../deploy
pm2 start ecosystem.config.js

# Sauvegarde pour démarrage automatique au boot du système
pm2 save
pm2 startup
```

### Option C — Mode démonstration avec prévisualisation

```bash
# Backend
cd server && npm start

# Frontend
cd client && npm run preview -- --host --port 3000
```

### Adresses et ports par défaut

| Service | URL | Usage |
|---------|-----|-------|
| Kiosque tactile public | http://localhost:3000 | Affichage écran borne |
| API Backend | http://localhost:5000 | Services REST et médias |
| Health check | http://localhost:5000/api/health | Supervision technique |

---

## Guide Back-Office administrateur {#back-office}

### Accès administrateur

Depuis le kiosque, deux méthodes d'accès sont disponibles :
- **Bouton d'administration** en bas à droite de l'écran.
- **Appui long (5 secondes)** sur le coin inférieur droit de la borne.

> **Identifiants par défaut :**  
> Identifiant : `admin`  
> Mot de passe : `admin123`  
> *Important : modifiez ces identifiants lors de la mise en service finale.*

### Modules d'administration

| Section | Fonctionnalités |
|---------|----------------|
| **Publicités** | Gestion des diapositives en boucle (images locales, URL web, vidéos MP4) |
| **Lieux & Itinéraires** | Gestion des sites touristiques, coordonnées GPS, photos et étapes de parcours |
| **Événements & Météo** | Programmation d'événements avec dates d'expiration et météo en temps réel |
| **Urgences** | Répertoire des services d'urgence locaux (hôpitaux, police, pompiers, pharmacies) |
| **Phrases utiles** | Gestion des expressions trilingues, réordonnancement par glisser-déposer dans chaque catégorie et génération audio MMS-TTS |
| **Configuration Ville** | Changement de la ville active du kiosque avec import automatique résilient multi-sources OpenStreetMap (Nominatim / Overpass / Wikimedia) |
| **Statistiques** | Télémétrie anonyme : nombre de visites, langues choisies, fonctionnalités les plus consultées |
| **Comptes Admin** | Gestion des utilisateurs et mots de passe d'administration |

### Stockage des médias

Les fichiers médias téléversés (photos, vidéos, audios) sont conservés localement dans le dossier `server/uploads/`.  
Formats acceptés : `.jpg`, `.jpeg`, `.png`, `.webp`, `.gif`, `.mp4`, `.mp3`, `.wav`.

---

## Fonctionnalités détaillées {#fonctionnalites}

### 1. Économiseur d'écran dynamique
- Défilement automatique des affiches publicitaires et culturelles
- Prise en charge des images et des vidéos MP4 en boucle
- Durée d'affichage paramétrable pour chaque diapositive

### 2. Détection de présence par caméra
- Détecteur de visage MediaPipe exécuté localement dans le navigateur (WASM)
- Détection à environ 2 mètres pour réveiller la borne
- Zéro transfert réseau : les images de la caméra ne sont ni stockées ni transmises

### 3. Carte interactive & Navigation sans onglet externe
- Cartographie OpenStreetMap intégrée via Leaflet
- Calcul d'itinéraire routier réel via OSRM (Open Source Routing Machine)
- Modal d'aperçu d'itinéraire in-app sans ouverture d'onglets externes
- Flashcode QR Code pour emporter l'itinéraire sur smartphone

### 4. Hébergements & Restauration
- Données géo-localisées isolées par ville
- Filtres par catégorie : Hôtels, Restaurants, Guides, Transports, Boutiques
- Contacts téléphoniques et tarifs indicatifs

### 5. Météo et Événements locaux
- Données météo en direct via Open-Meteo API selon les coordonnées GPS de la ville active
- Calendrier des festivités avec suppression automatique des dates échues

### 6. Expressions utiles & Synthèse vocale malgache
- Expressions courantes trilingues (Malagasy / Français / English)
- Prononciation audio authentique générée avec le modèle Meta MMS-TTS (`facebook/mms-tts-mlg`)
- Repli sur la synthèse vocale du navigateur si aucun fichier audio n'est présent

### 7. Services d'urgence
- Numéros d'urgence affichés en très grand format pour une lisibilité immédiate
- Itinéraire direct vers les centres hospitaliers, postes de police et pompiers les plus proches

### 8. Convertisseur de devises
- Conversion bidirectionnelle Ariary (MGA) ⇄ Euro (EUR) / Dollar US (USD)
- Pavé numérique tactile et montants usuels adaptés au pouvoir d'achat local
- Fonctionnement autonome hors-ligne

### 9. Portabilité multi-villes
- Aucune donnée codée en dur
- Le kiosque peut être installé dans n'importe quelle ville de Madagascar
- Importation automatisée des données locales réelles via OpenStreetMap (Overpass API)

---

## Structure des dossiers {#structure}

```
kiosque-touristique-madagascar/
├── client/                     # Application Frontend React
│   ├── public/                # Modèles WASM et ressources statiques
│   ├── src/
│   │   ├── components/        # Header, sélecteur de position, modal d'itinéraire
│   │   ├── data/              # Traductions (i18n) et phrases de secours
│   │   ├── hooks/             # Détection caméra et minuteur d'inactivité
│   │   ├── services/          # Client API, météo, télémétrie
│   │   ├── utils/             # Géolocalisation résiliente et navigation
│   │   └── views/             # Modules de l'interface (menu, carte, lieux, urgences...)
│   ├── App.jsx                # Composant racine et gestion des états
│   └── index.html
│
├── server/                     # Backend Node.js Express
│   ├── src/
│   │   ├── db/database.js     # Gestion SQLite (better-sqlite3)
│   │   ├── middlewares/       # Sécurité et authentification JWT
│   │   └── routes/            # Routes API REST (ads, config, places, emergency...)
│   ├── scripts/               # Script de génération audio MMS-TTS
│   ├── uploads/               # Dossier des médias téléversés
│   ├── kiosk.db               # Base de données locale SQLite
│   └── server.js              # Point d'entrée de l'API
│
├── deploy/                     # Fichiers de déploiement en production
│   ├── ecosystem.config.js    # Configuration des services PM2
│   ├── launch-kiosk.bat       # Script de lancement automatique
│   └── stop-kiosk.bat         # Script d'arrêt des services
│
└── README.md                   # Documentation du projet
```

---

## FAQ & Dépannage {#depannage}

### La caméra ne s'active pas
- Assurez-vous d'avoir accordé l'autorisation d'accès à la caméra dans le navigateur.
- L'API navigateur requiert un contexte sécurisé (`localhost` ou `https://`).
- Le bouton de simulation permet de tester l'interface même sans webcam connectée.

### Position GPS de l'appareil
- Les ordinateurs de bureau ne possèdent généralement pas de puce satellite matérielle.
- L'application utilise un système à plusieurs niveaux : géolocalisation navigateur standard, puis fallback automatique par IP pour localiser le kiosque.
- L'administrateur peut également pointer la position exacte de la borne directement sur la carte interactive.

### Les photos ou audios téléversés ne s'affichent pas
- Vérifiez que le dossier `server/uploads/` dispose des droits d'écriture.
- Les fichiers sont servis sur l'URL `http://localhost:5000/uploads/...`.

### Commandes utiles pour la supervision

```bash
pm2 list              # Voir l'état des services en production
pm2 logs              # Consulter les journaux en direct
pm2 restart all       # Redémarrer l'ensemble des services
pm2 stop all          # Stopper le kiosque
```

---

## Sécurité & Vie privée {#securite}

- **Traitement local** : la détection faciale fonctionne intégralement en mémoire dans le navigateur (WASM), aucune image n'est enregistrée.
- **Anonymat** : aucune donnée nominative relative aux visiteurs n'est conservée.
- **Authentification** : jetons JWT à durée limitée et mots de passe hashés avec `bcryptjs`.
- **Données locales** : base SQLite stockée sur l'appareil sans transmission vers des serveurs tiers.

---

## Licence {#licence}

Projet développé pour l'affichage interactif et la promotion du tourisme à Madagascar.

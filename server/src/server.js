const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS for kiosk frontend and local network devices
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Set strict UTF-8 response encoding
app.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded advertisement media statically from EXACT server/uploads folder
const uploadsDir = path.resolve(__dirname, '../uploads');
app.use('/uploads', express.static(uploadsDir, {
  setHeaders: (res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
}));

// Initialize database
require('./db/database');

// Routes registration
const authRoutes = require('./routes/auth');
const adsRoutes = require('./routes/ads');
const statsRoutes = require('./routes/stats');
const placesRoutes = require('./routes/places');
const eventsRoutes = require('./routes/events');
const emergencyRoutes = require('./routes/emergency');
const configRoutes = require('./routes/config');

app.use('/api/auth', authRoutes);
app.use('/api/ads', adsRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/places', placesRoutes);
app.use('/api/events', eventsRoutes);
app.use('/api/emergency', emergencyRoutes);
app.use('/api/config', configRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    kiosk: 'Fianarantsoa Interactive Kiosk API',
    uploadsDir: uploadsDir,
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`[KIOSK SERVER] Backend API running at http://localhost:${PORT}`);
  console.log(`[KIOSK SERVER] Serving media from: ${uploadsDir}`);
});

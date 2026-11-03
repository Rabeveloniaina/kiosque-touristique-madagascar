// PM2 Ecosystem — Kiosque Touristique Fianarantsoa
// Utilisation :
//   pm2 start ecosystem.config.js   (lancement)
//   pm2 save                         (persistance au redémarrage)
//   pm2 startup                      (démarrage automatique Windows/Linux)
//   pm2 logs                         (voir les logs en temps réel)

module.exports = {
  apps: [
    // ─── Backend API (Node.js + Express + SQLite) ───────────────────────────
    {
      name: 'kiosk-backend',
      cwd: '../server',
      script: 'src/server.js',
      interpreter: 'node',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '256M',
      restart_delay: 2000,
      env: {
        NODE_ENV: 'production',
        PORT: 5000
      },
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      out_file: '../logs/backend-out.log',
      error_file: '../logs/backend-error.log',
      merge_logs: true
    },

    // ─── Frontend (Vite Preview — build de production) ────────────────────
    {
      name: 'kiosk-frontend',
      cwd: '../client',
      script: 'npm',
      args: 'run preview -- --host --port 3000',
      interpreter: 'none',   // utilise le npm système
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '256M',
      restart_delay: 3000,
      env: {
        NODE_ENV: 'production'
      },
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      out_file: '../logs/frontend-out.log',
      error_file: '../logs/frontend-error.log',
      merge_logs: true
    }
  ]
};


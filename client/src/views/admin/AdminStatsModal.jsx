import React, { useState, useEffect } from 'react';
import { BarChart3, Users, Clock, Globe2, X, Trash2, Lock, ShieldCheck } from 'lucide-react';
import { analytics } from '../../services/analytics';

export default function AdminStatsModal({ isOpen, onClose }) {
  const [stats, setStats] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setStats(analytics.getStats());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleLogin = (e) => {
    e.preventDefault();
    if (passwordInput === 'admin123' || passwordInput === 'fianar2026') {
      setIsAuthenticated(true);
      setAuthError(false);
    } else {
      setAuthError(true);
    }
  };

  const handleReset = () => {
    if (confirm('Voulez-vous réinitialiser toutes les statistiques anonymes ?')) {
      localStorage.removeItem('kiosk_analytics_data');
      setStats(analytics.getStats());
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-6 select-none">
      <div className="bg-slate-900 border-2 border-slate-700 rounded-3xl p-8 max-w-2xl w-full text-white shadow-2xl relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full bg-slate-800 text-slate-400 hover:text-white"
        >
          <X className="w-6 h-6" />
        </button>

        {!isAuthenticated ? (
          /* Password prompt */
          <div className="text-center py-6">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto mb-4 border border-amber-400/30">
              <Lock className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-black">Accès Administration & Statistiques</h2>
            <p className="text-slate-400 text-sm mt-1">
              Entrez le code administrateur du kiosque (défaut : <span className="font-mono text-amber-400">admin123</span>)
            </p>

            <form onSubmit={handleLogin} className="mt-6 max-w-xs mx-auto">
              <input
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="Mot de passe"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-center text-white text-lg font-mono focus:outline-none focus:border-amber-400"
                autoFocus
              />
              {authError && (
                <p className="text-rose-400 text-xs mt-2 font-semibold">Mot de passe incorrect</p>
              )}
              <button
                type="submit"
                className="mt-4 w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl active:scale-95 transition"
              >
                Déverrouiller
              </button>
            </form>
          </div>
        ) : (
          /* Live Stats Dashboard */
          <div>
            <div className="flex items-center space-x-3 mb-6">
              <div className="p-3 bg-amber-500/20 text-amber-400 rounded-2xl border border-amber-400/30">
                <BarChart3 className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-2xl font-black">Statistiques Anonymes d'Utilisation</h2>
                <p className="text-slate-400 text-xs">Données locales 100 % privées (aucune information nominative)</p>
              </div>
            </div>

            {/* Key KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800 text-center">
                <Users className="w-5 h-5 text-blue-400 mx-auto" />
                <div className="text-3xl font-black mt-2 text-white">{stats?.totalSessions || 0}</div>
                <div className="text-xs text-slate-400 uppercase font-bold mt-1">Sessions totales</div>
              </div>

              <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800 text-center">
                <Clock className="w-5 h-5 text-emerald-400 mx-auto" />
                <div className="text-3xl font-black mt-2 text-white">{stats?.avgDurationSeconds || 0}s</div>
                <div className="text-xs text-slate-400 uppercase font-bold mt-1">Durée moyenne</div>
              </div>

              <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800 text-center col-span-2 md:col-span-1">
                <Globe2 className="w-5 h-5 text-amber-400 mx-auto" />
                <div className="text-xs text-slate-300 mt-2 flex justify-around font-mono font-bold">
                  <span>MG: {stats?.languages.mg || 0}</span>
                  <span>FR: {stats?.languages.fr || 0}</span>
                  <span>EN: {stats?.languages.en || 0}</span>
                </div>
                <div className="text-xs text-slate-400 uppercase font-bold mt-2">Langues choisies</div>
              </div>
            </div>

            {/* Feature Usage Bars */}
            <div className="bg-slate-950/60 p-5 rounded-2xl border border-slate-800 mb-6">
              <h3 className="text-sm uppercase font-bold text-slate-400 tracking-wider mb-4">
                Fonctionnalités les plus consultées
              </h3>
              {stats?.featureCounts && Object.keys(stats.featureCounts).length > 0 ? (
                <div className="space-y-3">
                  {Object.entries(stats.featureCounts).map(([feature, count]) => {
                    const max = Math.max(...Object.values(stats.featureCounts), 1);
                    const percentage = Math.round((count / max) * 100);
                    return (
                      <div key={feature}>
                        <div className="flex justify-between text-xs font-bold mb-1">
                          <span className="text-slate-300 uppercase">{feature}</span>
                          <span className="text-amber-400 font-mono">{count} clics</span>
                        </div>
                        <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
                          <div
                            className="bg-amber-500 h-full rounded-full transition-all duration-500"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-slate-500 text-sm italic">Aucune interaction enregistrée pour le moment.</p>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-800">
              <button
                onClick={handleReset}
                className="flex items-center space-x-2 text-rose-400 hover:text-rose-300 text-sm font-semibold p-2"
              >
                <Trash2 className="w-4 h-4" />
                <span>Effacer les statistiques</span>
              </button>

              <button
                onClick={onClose}
                className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-sm"
              >
                Fermer
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


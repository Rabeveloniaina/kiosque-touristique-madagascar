import { api } from './api';

const STORAGE_KEY = 'kiosk_analytics_data';

function getStoredData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : { sessions: [], interactions: [] };
  } catch {
    return { sessions: [], interactions: [] };
  }
}

function saveData(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.error('Failed to save analytics', err);
  }
}

export const analytics = {
  currentSession: null,

  startSession(language) {
    const session = {
      id: 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
      startTime: Date.now(),
      language: language,
      interactions: []
    };
    this.currentSession = session;

    // Async sync with SQLite backend
    api.syncSession({
      id: session.id,
      language: session.language,
      duration_seconds: 0
    });

    return session.id;
  },

  logInteraction(featureName, itemId = null) {
    if (!this.currentSession) return;
    const event = {
      feature: featureName,
      item: itemId,
      timestamp: Date.now()
    };
    this.currentSession.interactions.push(event);

    const data = getStoredData();
    data.interactions.push({
      sessionId: this.currentSession.id,
      ...event
    });
    saveData(data);

    // Async sync with SQLite backend
    api.syncInteraction({
      session_id: this.currentSession.id,
      feature_name: featureName,
      item_clicked: itemId
    });
  },

  endSession() {
    if (!this.currentSession) return;
    const durationSeconds = Math.round((Date.now() - this.currentSession.startTime) / 1000);
    const completedSession = {
      id: this.currentSession.id,
      startTime: new Date(this.currentSession.startTime).toISOString(),
      durationSeconds: Math.max(durationSeconds, 1),
      language: this.currentSession.language,
      interactionCount: this.currentSession.interactions.length
    };

    const data = getStoredData();
    data.sessions.push(completedSession);
    saveData(data);

    // Async sync with SQLite backend
    api.syncSession({
      id: completedSession.id,
      language: completedSession.language,
      duration_seconds: completedSession.durationSeconds
    });

    this.currentSession = null;
    return completedSession;
  },

  async getStats() {
    // Try to get aggregated data directly from SQLite
    const backendStats = await api.getSummaryStats();
    if (backendStats) return backendStats;

    // Fallback to local storage if offline
    const data = getStoredData();
    const totalSessions = data.sessions.length;
    
    const langs = { mg: 0, fr: 0, en: 0 };
    data.sessions.forEach((s) => {
      if (langs[s.language] !== undefined) langs[s.language]++;
    });

    const featureCounts = {};
    data.interactions.forEach((i) => {
      featureCounts[i.feature] = (featureCounts[i.feature] || 0) + 1;
    });

    const totalDuration = data.sessions.reduce((acc, s) => acc + (s.durationSeconds || 0), 0);
    const avgDuration = totalSessions > 0 ? Math.round(totalDuration / totalSessions) : 0;

    return {
      totalSessions,
      avgDurationSeconds: avgDuration,
      languages: langs,
      featureCounts
    };
  }
};

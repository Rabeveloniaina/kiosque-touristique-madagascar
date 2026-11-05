import { api } from '../services/api';

/**
 * Robust device location detection for kiosks running on PCs, laptops, or mobile devices.
 * 
 * Why standard navigator.geolocation fails on Windows PCs:
 * 1. enableHighAccuracy: true forces satellite GPS chip search, which desktop PCs do not have.
 * 2. Windows Location Services is often toggled OFF in Windows Settings (ms-settings:privacy-location).
 * 3. Browser permission might have been blocked or dismissed by user.
 * 4. Non-secure HTTP context on local network IP (must be localhost or HTTPS).
 *
 * This function:
 * 1. Tries standard browser geolocation with graceful settings (low accuracy first for Wi-Fi/IP resolution).
 * 2. Automatically falls back to IP-based geolocation if hardware/browser geolocation is unavailable.
 * 3. Returns actionable error diagnosis.
 */
export async function getDevicePosition() {
  // Check Secure Context
  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  if (!window.isSecureContext && !isLocal) {
    throw new Error(
      "La géolocalisation navigateur requiert HTTPS ou localhost. Utilisez la sélection sur carte pour définir l'emplacement."
    );
  }

  // Helper promise for browser geolocation
  const queryBrowserGeo = (highAccuracy = false, timeoutMs = 8000) => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        return reject(new Error('GEOLOCATION_UNSUPPORTED'));
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve(pos),
        (err) => reject(err),
        { enableHighAccuracy: highAccuracy, timeout: timeoutMs, maximumAge: 60000 }
      );
    });
  };

  // 1. Try standard browser location (moderate accuracy, fast)
  try {
    const pos = await queryBrowserGeo(false, 7000);
    return {
      lat: Number(pos.coords.latitude.toFixed(6)),
      lng: Number(pos.coords.longitude.toFixed(6)),
      source: 'gps',
      accuracy: pos.coords.accuracy || null,
      message: 'Position GPS / Réseau détectée avec succès par le navigateur.'
    };
  } catch (geoErr) {
    // If permission was explicitly denied, inform the user clearly
    if (geoErr && geoErr.code === 1) { // PERMISSION_DENIED
      // Try IP fallback but explain permission
      try {
        const ipLoc = await api.getIpLocation();
        return {
          lat: Number(ipLoc.lat.toFixed(6)),
          lng: Number(ipLoc.lng.toFixed(6)),
          source: 'ip',
          message: `Position approximative estimée par IP (${ipLoc.city || 'Madagascar'}). L'accès GPS direct a été refusé dans le navigateur.`
        };
      } catch {
        throw new Error(
          "L'accès à la position a été refusé dans votre navigateur. Cliquez sur l'icône de cadenas à gauche de l'URL pour autoriser la position, ou utilisez la sélection sur carte."
        );
      }
    }

    // For POSITION_UNAVAILABLE (code 2) or TIMEOUT (code 3), try IP geolocation fallback
    try {
      const ipLoc = await api.getIpLocation();
      return {
        lat: Number(ipLoc.lat.toFixed(6)),
        lng: Number(ipLoc.lng.toFixed(6)),
        source: 'ip',
        city: ipLoc.city,
        region: ipLoc.region,
        message: `Position approximative détectée par réseau IP (${ipLoc.city || 'Madagascar'}). Le PC ne dispose pas de puce GPS satellite directe.`
      };
    } catch {
      let reason = "Impossible d'obtenir la position du PC.";
      if (geoErr && geoErr.code === 2) {
        reason = "Position GPS indisponible sur ce PC (pas de puce GPS matérielle et service de localisation Windows inactif).";
      } else if (geoErr && geoErr.code === 3) {
        reason = "Délai d'attente dépassé pour la localisation du PC.";
      }
      throw new Error(`${reason} Vous pouvez ajuster ou pointer l'emplacement directement sur la carte interactive.`);
    }
  }
}

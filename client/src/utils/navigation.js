/**
 * Generates the official Google Maps direct Navigation / Directions URL.
 * When scanned by a phone camera, it immediately opens Google Maps in Directions mode
 * calculating the route from the user's current location to the target destination.
 */
export function getDirectionsUrl(lat, lng, name = '') {
  const safeLat = parseFloat(lat) || -18.7669;
  const safeLng = parseFloat(lng) || 46.8691;
  const placeParam = name ? `&destination_place_id=${encodeURIComponent(name)}` : '';
  return `https://www.google.com/maps/dir/?api=1&destination=${safeLat},${safeLng}${placeParam}&travelmode=driving`;
}

/**
 * Returns a QR Code image URL for any destination
 */
export function getQrCodeImageUrl(lat, lng, name = '', size = 240) {
  const directionsUrl = getDirectionsUrl(lat, lng, name);
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(directionsUrl)}`;
}


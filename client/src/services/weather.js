/**
 * Real Live Weather Service for Fianarantsoa (Haute Matsiatra, Madagascar)
 * Powered by Open-Meteo (100% free, open-source, no API key required).
 * Coordinates of Fianarantsoa: Lat -21.4536, Lng 47.0858, Alt ~1130m.
 */

const FIANAR_LAT = -21.4536;
const FIANAR_LNG = 47.0858;

const WMO_DESCRIPTIONS = {
  0: { fr: 'Ciel dégagé et ensoleillé', mg: 'Masoandro migajigaji', en: 'Clear and sunny sky' },
  1: { fr: 'Peu nuageux', mg: 'Masoandro misy rahona vitsy', en: 'Mainly clear' },
  2: { fr: 'Partiellement nuageux', mg: 'Mandrahona amin’ny ampahany', en: 'Partly cloudy' },
  3: { fr: 'Ciel couvert', mg: 'Manjombona ny andro', en: 'Overcast' },
  45: { fr: 'Brouillard sur les collines', mg: 'Zavona amin’ny kavoana', en: 'Fog on the hills' },
  48: { fr: 'Brouillard givrant', mg: 'Zavona mangatsiaka', en: 'Depositing rime fog' },
  51: { fr: 'Bruine légère', mg: 'Eran-drahona manify', en: 'Light drizzle' },
  53: { fr: 'Bruine modérée', mg: 'Eran-drahona antonony', en: 'Moderate drizzle' },
  55: { fr: 'Bruine dense', mg: 'Eran-drahona mikitroka', en: 'Dense drizzle' },
  61: { fr: 'Pluie légère', mg: 'Misy erika ny andro', en: 'Slight rain' },
  63: { fr: 'Pluie modérée', mg: 'Ranom-panala antonony', en: 'Moderate rain' },
  65: { fr: 'Pluie forte', mg: 'Oram-be mikitroka', en: 'Heavy rain' },
  80: { fr: 'Averses légères', mg: 'Erana kely mitsidika', en: 'Slight rain showers' },
  81: { fr: 'Averses modérées', mg: 'Eran-dranonorana', en: 'Moderate rain showers' },
  82: { fr: 'Averses violentes', mg: 'Oran-drivotra mahery', en: 'Violent rain showers' },
  95: { fr: 'Orage tropical', mg: 'Oram-baratra eto an-toerana', en: 'Thunderstorm' },
  96: { fr: 'Orage avec grêle légère', mg: 'Oram-baratra misy havandra', en: 'Thunderstorm with slight hail' },
  99: { fr: 'Orage violent avec grêle', mg: 'Oram-baratra mahery misy havandra', en: 'Severe thunderstorm with heavy hail' }
};

export async function fetchLiveWeather(lat = FIANAR_LAT, lng = FIANAR_LNG, cityName = 'Fianarantsoa') {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m&timezone=auto`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Météo indisponible');
    const data = await response.json();

    const current = data.current;
    const code = current.weather_code || 0;
    const condition = WMO_DESCRIPTIONS[code] || WMO_DESCRIPTIONS[0];

    return {
      temp: Math.round(current.temperature_2m),
      apparentTemp: Math.round(current.apparent_temperature),
      humidity: `${current.relative_humidity_2m} %`,
      wind: `${Math.round(current.wind_speed_10m)} km/h`,
      precipitation: `${current.precipitation} mm`,
      isDay: current.is_day === 1,
      city: cityName,
      condition,
      isRealLive: true,
      updatedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
  } catch (err) {
    console.warn('Utilisation météo locale de secours (Open-Meteo hors ligne):', err);
    return {
      temp: 24,
      apparentTemp: 25,
      humidity: '58 %',
      wind: '12 km/h Sud-Est',
      precipitation: '0 mm',
      isDay: true,
      city: cityName,
      condition: {
        fr: 'Climat agréable et tempéré',
        mg: 'Toetrandro mahafinaritra an-tampon-kavoana',
        en: 'Pleasant local weather'
      },
      isRealLive: false,
      updatedAt: 'Mode hors-ligne'
    };
  }
}


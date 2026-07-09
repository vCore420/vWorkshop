/**
 * WeatherProvider
 * -----------------
 * The Live Weather mode's entire outside-world dependency, isolated here
 * on purpose: geolocation and a network fetch are the only two things in
 * this entire project that touch the outside world at all, and both are
 * things that can fail in ways completely outside the Workshop's control
 * (permission denied, offline, a slow or unreachable API). Keeping both
 * behind one small `fetchLiveWeather()` function means EnvironmentSystem
 * itself never needs to know *why* live weather isn't available, only
 * that `fetchLiveWeather()` rejected — every failure path leads to the
 * exact same graceful fallback to Workshop Dynamic mode.
 *
 * Uses Open-Meteo (https://open-meteo.com) — chosen specifically because
 * it needs no API key and no account: a plain HTTPS GET with a
 * latitude/longitude, straightforward for a static, backend-free project
 * to call directly from the browser. Its current-conditions response
 * reports a WMO weather interpretation code (`weather_code`) — a
 * standardised international code table, not something Open-Meteo
 * invented — which `mapWmoCodeToState` translates into one of this
 * project's own ten weather states.
 */

const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const GEOLOCATION_TIMEOUT_MS = 8000;
const FETCH_TIMEOUT_MS = 8000;

/**
 * WMO weather-interpretation codes -> this project's own WEATHER_STATES
 * ids. Open-Meteo (like most weather providers) has no direct equivalent
 * of "Windy" or "Mist" as a standalone code — wind is its own separate
 * variable, and "mist" vs. "fog" is a severity distinction the WMO table
 * doesn't really draw either. Both are handled as deliberate
 * reinterpretations of the raw data (see `deriveState` below) rather than
 * a gap in the table.
 */
const WMO_CODE_MAP = {
  0: "clear",
  1: "clear",
  2: "partlyCloudy",
  3: "overcast",
  45: "mist",
  48: "fog",
  51: "drizzle",
  53: "drizzle",
  55: "lightRain",
  56: "drizzle",
  57: "lightRain",
  61: "lightRain",
  63: "lightRain",
  65: "heavyRain",
  66: "lightRain",
  67: "heavyRain",
  71: "lightRain", // snow has no dedicated visual in this project yet — approximated by precipitation intensity, see docs/WORLD.md
  73: "lightRain",
  75: "heavyRain",
  77: "drizzle",
  80: "lightRain",
  81: "lightRain",
  82: "heavyRain",
  85: "lightRain",
  86: "heavyRain",
  95: "storm",
  96: "storm",
  99: "storm",
};

const WINDY_THRESHOLD_KMH = 32; // above this, "windy" reads as the more honest description than whatever the base sky condition was

function deriveState(weatherCode, windSpeedKmh) {
  const base = WMO_CODE_MAP[weatherCode] ?? "partlyCloudy";
  // Wind overrides only the calmer conditions — a windy thunderstorm is
  // still "Storm", not "Windy"; a windy clear sky genuinely is "Windy".
  const calmConditions = new Set(["clear", "partlyCloudy", "overcast", "mist"]);
  if (windSpeedKmh >= WINDY_THRESHOLD_KMH && calmConditions.has(base)) return "windy";
  return base;
}

function withTimeout(promise, ms, message) {
  return Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms))]);
}

function getPosition() {
  if (!("geolocation" in navigator)) return Promise.reject(new Error("Geolocation is not available in this browser."));
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      timeout: GEOLOCATION_TIMEOUT_MS,
      maximumAge: 10 * 60 * 1000, // a position up to 10 minutes old is perfectly fine for weather purposes
    });
  });
}

/**
 * Resolves to `{ state, windSpeedKmh, windDirectionDeg, temperatureC,
 * isDay }` or rejects with a plain Error describing what went wrong
 * (shown as-is in the Environment panel — see EnvironmentSystem.js).
 */
export async function fetchLiveWeather() {
  let position;
  try {
    position = await withTimeout(getPosition(), GEOLOCATION_TIMEOUT_MS, "Location request timed out.");
  } catch (err) {
    throw new Error(err?.code === 1 ? "Location permission was denied." : "Couldn't determine your location.");
  }

  const { latitude, longitude } = position.coords;
  const url = `${FORECAST_URL}?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code,wind_speed_10m,wind_direction_10m,is_day&timezone=auto`;

  let response;
  try {
    response = await withTimeout(fetch(url), FETCH_TIMEOUT_MS, "Weather request timed out.");
  } catch {
    throw new Error("Couldn't reach the weather service.");
  }
  if (!response.ok) throw new Error("The weather service returned an error.");

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error("The weather service returned an unreadable response.");
  }
  const current = data?.current;
  if (!current || typeof current.weather_code !== "number") throw new Error("The weather service response was incomplete.");

  return {
    state: deriveState(current.weather_code, current.wind_speed_10m ?? 0),
    windSpeedKmh: current.wind_speed_10m ?? 0,
    windDirectionDeg: current.wind_direction_10m ?? 0,
    temperatureC: current.temperature_2m ?? null,
    isDay: current.is_day !== 0,
  };
}

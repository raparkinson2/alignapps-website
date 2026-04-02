import { Hono } from "hono";

const app = new Hono();

type WeatherCondition = "sunny" | "partly_cloudy" | "cloudy" | "rain" | "snow" | "indoor";

function wmoToCondition(code: number): WeatherCondition {
  if (code === 0) return "sunny";
  if (code <= 2) return "partly_cloudy";
  if (code === 3 || (code >= 45 && code <= 48)) return "cloudy";
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return "rain";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "snow";
  return "cloudy";
}

function cToF(c: number): number {
  return Math.round((c * 9) / 5 + 32);
}

function parseGameHour(timeStr: string): number {
  try {
    // Handle 24-hour format like "15:00" or "19:00"
    const match24 = timeStr.match(/^(\d{1,2}):(\d{2})$/);
    if (match24 && match24[1]) {
      const h = parseInt(match24[1], 10);
      if (h >= 0 && h <= 23) return h;
    }
    // Handle 12-hour format like "3:00 PM"
    const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (!match || !match[1] || !match[3]) return 12;
    let hour = parseInt(match[1], 10);
    const period = match[3].toUpperCase();
    if (period === "PM" && hour !== 12) hour += 12;
    if (period === "AM" && hour === 12) hour = 0;
    return hour;
  } catch {
    return 12;
  }
}

// Simple in-memory geocode cache to avoid hammering external services
const geocodeCache = new Map<string, { lat: number; lon: number }>();

/**
 * Returns true if the string looks like a real geocodable address.
 * Rejects generic venue names like "Main Practice Rink" or "Home Field".
 * A real address must contain digits (street number / zip) OR a comma
 * separating components (e.g. "City, State").
 */
function looksLikeRealAddress(address: string): boolean {
  const trimmed = address.trim();
  if (trimmed.length < 5) return false;
  const hasDigits = /\d/.test(trimmed);
  const hasComma = trimmed.includes(',');
  return hasDigits || hasComma;
}

async function safeJsonFetch<T>(url: string, options?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(url, options);
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(`[weather] HTTP ${res.status} from ${url}: ${text.slice(0, 100)}`);
      return null;
    }
    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("application/json") && !contentType.includes("text/json")) {
      const text = await res.text().catch(() => "");
      console.error(`[weather] Non-JSON (${contentType}) from ${url}: ${text.slice(0, 150)}`);
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    console.error(`[weather] Fetch error for ${url}:`, err);
    return null;
  }
}

async function geocodeAddress(address: string): Promise<{ lat: number; lon: number } | null> {
  if (!looksLikeRealAddress(address)) {
    console.log(`[weather] Skipping geocode — not a real address: "${address}"`);
    return null;
  }
  const cacheKey = address.toLowerCase().trim();
  if (geocodeCache.has(cacheKey)) {
    return geocodeCache.get(cacheKey)!;
  }

  const encoded = encodeURIComponent(address);

  // 1. Try Nominatim
  const nominatimData = await safeJsonFetch<Array<{ lat: string; lon: string }>>(
    `https://nominatim.openstreetmap.org/search?q=${encoded}&format=json&limit=1`,
    { headers: { "User-Agent": "TeamManagementApp/1.0 contact@vibecode.run" } }
  );
  if (nominatimData && nominatimData.length > 0 && nominatimData[0]) {
    const result = { lat: parseFloat(nominatimData[0].lat), lon: parseFloat(nominatimData[0].lon) };
    geocodeCache.set(cacheKey, result);
    return result;
  }

  // 2. Fall back to Photon (komoot)
  console.log(`[weather] Nominatim failed, trying Photon for: ${address}`);
  const photonData = await safeJsonFetch<{ features?: Array<{ geometry: { coordinates: [number, number] } }> }>(
    `https://photon.komoot.io/api/?q=${encoded}&limit=1`
  );
  if (photonData?.features && photonData.features.length > 0 && photonData.features[0]) {
    const [lon, lat] = photonData.features[0].geometry.coordinates;
    const result = { lat, lon };
    geocodeCache.set(cacheKey, result);
    return result;
  }

  console.error(`[weather] Both geocoders failed for: ${address}`);
  return null;
}

// GET /api/weather?address=...&date=YYYY-MM-DD&time=15:00
app.get("/", async (c) => {
  const address = c.req.query("address");
  const date = c.req.query("date"); // YYYY-MM-DD
  const time = c.req.query("time") ?? "12:00";

  if (!address || !date) {
    return c.json({ error: "Missing address or date" }, 400);
  }

  try {
    // 1. Geocode the address
    const coords = await geocodeAddress(address);
    if (!coords) {
      return c.json({ error: "Geocoding failed" }, 404);
    }
    const { lat, lon } = coords;

    // 2. Determine if past or future
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const gameDate = new Date(date + "T00:00:00");
    const diffDays = Math.round(
      (gameDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (diffDays > 16) {
      return c.json({ error: "Too far in the future" }, 400);
    }

    const isFuture = diffDays >= 0;
    const gameHour = parseGameHour(time);

    // 3. Fetch weather from Open-Meteo
    const baseUrl = isFuture
      ? "https://api.open-meteo.com/v1/forecast"
      : "https://archive-api.open-meteo.com/v1/archive";

    const weatherUrl = `${baseUrl}?latitude=${lat}&longitude=${lon}&start_date=${date}&end_date=${date}&hourly=temperature_2m,weathercode&temperature_unit=celsius&timezone=auto`;

    const weatherData = await safeJsonFetch<{
      hourly?: { temperature_2m: number[]; weathercode: number[] };
    }>(weatherUrl);

    if (!weatherData?.hourly?.temperature_2m || !weatherData?.hourly?.weathercode) {
      console.error(`[weather] No hourly data from Open-Meteo for ${date} at ${lat},${lon}`);
      return c.json({ error: "No weather data" }, 404);
    }

    const temps = weatherData.hourly.temperature_2m;
    const codes = weatherData.hourly.weathercode;
    const tempC = (temps[gameHour] ?? temps[12]) as number;
    const wmoCode = (codes[gameHour] ?? codes[12]) as number;

    const tempF = cToF(tempC);
    const condition = wmoToCondition(wmoCode);

    console.log(`[weather] ${address} on ${date} at hour ${gameHour}: ${condition}, ${tempF}°F`);

    return c.json({ tempF, condition, isForecast: isFuture });
  } catch (err) {
    console.error("[weather] backend fetch error:", err);
    return c.json({ error: "Weather fetch failed" }, 500);
  }
});

export const weatherRouter = app;

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

// GET /api/weather?address=...&date=YYYY-MM-DD&time=7:30 PM
app.get("/", async (c) => {
  const address = c.req.query("address");
  const date = c.req.query("date"); // YYYY-MM-DD
  const time = c.req.query("time") ?? "12:00 PM";

  if (!address || !date) {
    return c.json({ error: "Missing address or date" }, 400);
  }

  try {
    // 1. Geocode the address via Nominatim
    const encoded = encodeURIComponent(address);
    const geoRes = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encoded}&format=json&limit=1`,
      { headers: { "User-Agent": "TeamManagementApp/1.0" } }
    );
    const geoData = (await geoRes.json()) as Array<{ lat: string; lon: string }>;

    if (!geoData?.length) {
      return c.json({ error: "Geocoding failed" }, 404);
    }

    const lat = parseFloat(geoData[0]!.lat);
    const lon = parseFloat(geoData[0]!.lon);

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

    const isFuture = diffDays > 0;
    const gameHour = parseGameHour(time);

    // 3. Fetch weather from Open-Meteo
    const baseUrl = isFuture
      ? "https://api.open-meteo.com/v1/forecast"
      : "https://archive-api.open-meteo.com/v1/archive";

    const weatherUrl = `${baseUrl}?latitude=${lat}&longitude=${lon}&start_date=${date}&end_date=${date}&hourly=temperature_2m,weathercode&temperature_unit=celsius&timezone=auto`;
    const weatherRes = await fetch(weatherUrl);
    const weatherData = (await weatherRes.json()) as {
      hourly?: { temperature_2m: number[]; weathercode: number[] };
    };

    if (!weatherData?.hourly?.temperature_2m || !weatherData?.hourly?.weathercode) {
      return c.json({ error: "No weather data" }, 404);
    }

    const temps = weatherData.hourly.temperature_2m;
    const codes = weatherData.hourly.weathercode;
    const tempC = (temps[gameHour] ?? temps[12]) as number;
    const wmoCode = (codes[gameHour] ?? codes[12]) as number;

    const tempF = cToF(tempC);
    const condition = wmoToCondition(wmoCode);

    return c.json({ tempF, condition, isForecast: isFuture });
  } catch (err) {
    console.error("[weather] backend fetch error:", err);
    return c.json({ error: "Weather fetch failed" }, 500);
  }
});

export const weatherRouter = app;

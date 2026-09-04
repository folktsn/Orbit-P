import { NextRequest, NextResponse } from "next/server";

type LoginWeatherScene = "clear" | "cloudy" | "rain" | "night";

type MetNoLocationForecastResponse = {
  properties?: {
    timeseries?: Array<{
      time?: string;
      data?: {
        instant?: {
          details?: {
            air_temperature?: number;
          };
        };
        next_1_hours?: {
          summary?: {
            symbol_code?: string;
          };
        };
        next_6_hours?: {
          summary?: {
            symbol_code?: string;
          };
        };
      };
    }>;
  };
};

type WeatherPayload = {
  scene: LoginWeatherScene;
  condition: string;
  temperature: number;
  observedAt: string | null;
};

type WeatherCacheEntry = {
  value: WeatherPayload;
  expiresAt: number;
  lastModified: string | null;
};

const BROWSER_CACHE_SECONDS = 10 * 60;
const PROVIDER_FALLBACK_CACHE_MS = 30 * 60 * 1000;
const MAX_CACHE_ENTRIES = 256;
const weatherCache = new Map<string, WeatherCacheEntry>();

function getWeatherScene(symbolCode: string): LoginWeatherScene {
  const symbol = symbolCode.toLowerCase();
  if (/(rain|sleet|snow|thunder)/.test(symbol)) return "rain";
  if (symbol.endsWith("_night")) return "night";
  if (symbol.includes("clearsky") || symbol.includes("fair")) return "clear";
  return "cloudy";
}

function getWeatherCondition(symbolCode: string) {
  const symbol = symbolCode.toLowerCase();
  if (symbol.includes("thunder")) return "พายุฝนฟ้าคะนอง";
  if (symbol.includes("heavyrain")) return "ฝนตกหนัก";
  if (symbol.includes("lightrain")) return "ฝนเล็กน้อย";
  if (symbol.includes("rainshowers")) return "ฝนตกเป็นช่วง";
  if (symbol.includes("rain")) return "ฝนตก";
  if (symbol.includes("sleet")) return "ฝนปนหิมะ";
  if (symbol.includes("snow")) return "หิมะตก";
  if (symbol.includes("fog")) return "มีหมอก";
  if (symbol.includes("partlycloudy")) return "มีเมฆบางส่วน";
  if (symbol.includes("cloudy")) return "เมฆมาก";
  if (symbol.includes("fair")) return "ท้องฟ้าโปร่งเป็นส่วนใหญ่";
  if (symbol.includes("clearsky")) return "ท้องฟ้าแจ่มใส";
  return "สภาพอากาศแปรปรวน";
}

function parseCoordinate(value: string | null, minimum: number, maximum: number) {
  if (value === null || value.trim() === "") return null;
  const coordinate = Number(value);
  if (!Number.isFinite(coordinate) || coordinate < minimum || coordinate > maximum) return null;
  return Number(coordinate.toFixed(2));
}

function getProviderExpiry(expiresHeader: string | null) {
  const expiresAt = expiresHeader ? Date.parse(expiresHeader) : Number.NaN;
  return Number.isFinite(expiresAt) && expiresAt > Date.now()
    ? expiresAt
    : Date.now() + PROVIDER_FALLBACK_CACHE_MS;
}

function weatherResponse(value: WeatherPayload, expiresAt: number) {
  const remainingSeconds = Math.floor((expiresAt - Date.now()) / 1000);
  const maxAge = Math.max(60, Math.min(BROWSER_CACHE_SECONDS, remainingSeconds));
  return NextResponse.json(value, {
    headers: {
      "Cache-Control": `private, max-age=${maxAge}, stale-while-revalidate=60`,
    },
  });
}

export async function GET(request: NextRequest) {
  const latitude = parseCoordinate(request.nextUrl.searchParams.get("latitude"), -90, 90);
  const longitude = parseCoordinate(request.nextUrl.searchParams.get("longitude"), -180, 180);

  if (latitude === null || longitude === null) {
    return NextResponse.json({ error: "Invalid location coordinates" }, { status: 400 });
  }

  const cacheKey = `${latitude},${longitude}`;
  const cached = weatherCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return weatherResponse(cached.value, cached.expiresAt);
  }

  const params = new URLSearchParams({ lat: String(latitude), lon: String(longitude) });

  try {
    const headers: Record<string, string> = {
      Accept: "application/json",
      "User-Agent": "OrbitHire/1.0 https://orbithire.pattayaaviation.com",
    };
    if (cached?.lastModified) headers["If-Modified-Since"] = cached.lastModified;

    const response = await fetch(`https://api.met.no/weatherapi/locationforecast/2.0/compact?${params}`, {
      cache: "no-store",
      headers,
      signal: AbortSignal.timeout(6000),
    });

    if (response.status === 304 && cached) {
      cached.expiresAt = getProviderExpiry(response.headers.get("expires"));
      weatherCache.set(cacheKey, cached);
      return weatherResponse(cached.value, cached.expiresAt);
    }

    if (!response.ok) {
      throw new Error(`MET Norway returned ${response.status}`);
    }

    const data = (await response.json()) as MetNoLocationForecastResponse;
    const current = data.properties?.timeseries?.[0];
    const temperature = current?.data?.instant?.details?.air_temperature;
    const symbolCode = current?.data?.next_1_hours?.summary?.symbol_code
      || current?.data?.next_6_hours?.summary?.symbol_code;

    if (typeof temperature !== "number" || typeof symbolCode !== "string") {
      throw new Error("MET Norway response was incomplete");
    }

    const value: WeatherPayload = {
      scene: getWeatherScene(symbolCode),
      condition: getWeatherCondition(symbolCode),
      temperature: Number(temperature.toFixed(1)),
      observedAt: current?.time || null,
    };
    const expiresAt = getProviderExpiry(response.headers.get("expires"));

    if (!weatherCache.has(cacheKey) && weatherCache.size >= MAX_CACHE_ENTRIES) {
      const oldestKey = weatherCache.keys().next().value;
      if (oldestKey) weatherCache.delete(oldestKey);
    }
    weatherCache.set(cacheKey, {
      value,
      expiresAt,
      lastModified: response.headers.get("last-modified"),
    });

    return weatherResponse(value, expiresAt);
  } catch (error) {
    console.error("Unable to load current weather", error);
    if (cached) return weatherResponse(cached.value, Date.now() + 60 * 1000);
    return NextResponse.json({ error: "Weather service is unavailable" }, { status: 502 });
  }
}

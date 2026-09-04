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

type StationLocation = {
  code: string;
  label: string;
  latitude: number;
  longitude: number;
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
const DEFAULT_STATION_CODE = "HDQ";
const STATION_LOCATIONS: Record<string, StationLocation> = {
  BKK: { code: "BKK", label: "Suvarnabhumi Airport", latitude: 13.69, longitude: 100.75 },
  CEI: { code: "CEI", label: "Mae Fah Luang Chiang Rai Airport", latitude: 19.95, longitude: 99.88 },
  CJM: { code: "CJM", label: "Chumphon Airport", latitude: 10.71, longitude: 99.36 },
  CNX: { code: "CNX", label: "Chiang Mai Airport", latitude: 18.77, longitude: 98.96 },
  DMK: { code: "DMK", label: "Don Mueang Airport", latitude: 13.91, longitude: 100.61 },
  HDQ: { code: "HDQ", label: "Headquarters Bangkok", latitude: 13.76, longitude: 100.5 },
  HDY: { code: "HDY", label: "Hat Yai Airport", latitude: 6.93, longitude: 100.39 },
  HKT: { code: "HKT", label: "Phuket Airport", latitude: 8.11, longitude: 98.32 },
  KBV: { code: "KBV", label: "Krabi Airport", latitude: 8.1, longitude: 98.99 },
  KKC: { code: "KKC", label: "Khon Kaen Airport", latitude: 16.47, longitude: 102.78 },
  LPT: { code: "LPT", label: "Lampang Airport", latitude: 18.27, longitude: 99.5 },
  NST: { code: "NST", label: "Nakhon Si Thammarat Airport", latitude: 8.54, longitude: 99.94 },
  PHS: { code: "PHS", label: "Phitsanulok Airport", latitude: 16.78, longitude: 100.28 },
  ROI: { code: "ROI", label: "Roi Et Airport", latitude: 16.12, longitude: 103.77 },
  TST: { code: "TST", label: "Trang Airport", latitude: 7.51, longitude: 99.62 },
  UBP: { code: "UBP", label: "Ubon Ratchathani Airport", latitude: 15.25, longitude: 104.87 },
  URT: { code: "URT", label: "Surat Thani Airport", latitude: 9.13, longitude: 99.14 },
  USM: { code: "USM", label: "Samui Airport", latitude: 9.55, longitude: 100.06 },
  UTH: { code: "UTH", label: "Udon Thani Airport", latitude: 17.39, longitude: 102.79 },
  UTP: { code: "UTP", label: "U-Tapao Airport", latitude: 12.68, longitude: 101.01 },
};

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

function resolveStation(value: string | null) {
  const normalized = String(value || "").trim().toUpperCase();
  const aliases: Array<[string, string]> = [
    ["SUVARNABHUMI", "BKK"],
    ["DON MUEANG", "DMK"],
    ["DON MUANG", "DMK"],
    ["HEADQUARTERS", "HDQ"],
    ["HEAD OFFICE", "HDQ"],
  ];
  const alias = aliases.find(([name]) => normalized.includes(name))?.[1];
  const code = alias || Object.keys(STATION_LOCATIONS).find((candidate) => {
    const index = normalized.indexOf(candidate);
    if (index < 0) return false;
    const before = normalized[index - 1];
    const after = normalized[index + candidate.length];
    return (!before || !/[A-Z]/.test(before)) && (!after || !/[A-Z]/.test(after));
  });
  const matched = Boolean(code && STATION_LOCATIONS[code]);
  return {
    location: STATION_LOCATIONS[code || DEFAULT_STATION_CODE] || STATION_LOCATIONS[DEFAULT_STATION_CODE],
    matched,
  };
}

function getProviderExpiry(expiresHeader: string | null) {
  const expiresAt = expiresHeader ? Date.parse(expiresHeader) : Number.NaN;
  return Number.isFinite(expiresAt) && expiresAt > Date.now()
    ? expiresAt
    : Date.now() + PROVIDER_FALLBACK_CACHE_MS;
}

function weatherResponse(
  value: WeatherPayload,
  expiresAt: number,
  station: StationLocation,
  stationMatched: boolean,
) {
  const remainingSeconds = Math.floor((expiresAt - Date.now()) / 1000);
  const maxAge = Math.max(60, Math.min(BROWSER_CACHE_SECONDS, remainingSeconds));
  return NextResponse.json({
    ...value,
    stationCode: station.code,
    stationLabel: station.label,
    stationMatched,
  }, {
    headers: {
      "Cache-Control": `private, max-age=${maxAge}, stale-while-revalidate=60`,
    },
  });
}

export async function GET(request: NextRequest) {
  const { location, matched } = resolveStation(request.nextUrl.searchParams.get("station"));
  const cacheKey = location.code;
  const cached = weatherCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return weatherResponse(cached.value, cached.expiresAt, location, matched);
  }

  const params = new URLSearchParams({
    lat: String(location.latitude),
    lon: String(location.longitude),
  });

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
      return weatherResponse(cached.value, cached.expiresAt, location, matched);
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

    return weatherResponse(value, expiresAt, location, matched);
  } catch (error) {
    console.error("Unable to load current weather", error);
    if (cached) return weatherResponse(cached.value, Date.now() + 60 * 1000, location, matched);
    return NextResponse.json({ error: "Weather service is unavailable" }, { status: 502 });
  }
}

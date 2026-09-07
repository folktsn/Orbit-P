export const DISPLAY_PREFERENCES_KEY = "orbithire:display-preferences:v1";
export const MIN_FONT_SCALE = 90;
export const MAX_FONT_SCALE = 130;

export type DisplayPreferences = { fontScale: number; reduceMotion: boolean };

export const DEFAULT_DISPLAY_PREFERENCES: DisplayPreferences = {
  fontScale: 100,
  reduceMotion: false,
};

export function normalizeDisplayPreferences(value: unknown): DisplayPreferences {
  const input = value && typeof value === "object" ? value as Partial<DisplayPreferences> : {};
  const scale = typeof input.fontScale === "number" && Number.isFinite(input.fontScale)
    ? Math.round(input.fontScale / 10) * 10 : 100;
  return {
    fontScale: Math.min(MAX_FONT_SCALE, Math.max(MIN_FONT_SCALE, scale)),
    reduceMotion: input.reduceMotion === true,
  };
}

export function parseDisplayPreferences(value: string | null): DisplayPreferences {
  try {
    return normalizeDisplayPreferences(value ? JSON.parse(value) : null);
  } catch {
    return { ...DEFAULT_DISPLAY_PREFERENCES };
  }
}

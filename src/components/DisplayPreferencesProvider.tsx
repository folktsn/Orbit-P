"use client";

import { createContext, useContext, useEffect, useSyncExternalStore, type ReactNode } from "react";
import { MotionConfig } from "framer-motion";
import {
  DEFAULT_DISPLAY_PREFERENCES, DISPLAY_PREFERENCES_KEY,
  normalizeDisplayPreferences, parseDisplayPreferences, type DisplayPreferences,
} from "@/lib/display-preferences";

const CHANGE_EVENT = "orbithire:display-preferences-changed";
let snapshot = DEFAULT_DISPLAY_PREFERENCES;
let initialized = false;

function getSnapshot() {
  if (!initialized) {
    initialized = true;
    try { snapshot = parseDisplayPreferences(localStorage.getItem(DISPLAY_PREFERENCES_KEY)); } catch { /* Storage can be disabled by the browser. */ }
  }
  return snapshot;
}

function subscribe(notify: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === DISPLAY_PREFERENCES_KEY || event.key === null) {
      snapshot = parseDisplayPreferences(event.newValue);
      notify();
    }
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(CHANGE_EVENT, notify);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(CHANGE_EVENT, notify);
  };
}

function updatePreferences(patch: Partial<DisplayPreferences>) {
  snapshot = normalizeDisplayPreferences({ ...getSnapshot(), ...patch });
  try { localStorage.setItem(DISPLAY_PREFERENCES_KEY, JSON.stringify(snapshot)); } catch { /* Keep controls usable for this tab without storage. */ }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

const PreferencesContext = createContext({ preferences: DEFAULT_DISPLAY_PREFERENCES, updatePreferences });

export function DisplayPreferencesProvider({ children }: { children: ReactNode }) {
  const preferences = useSyncExternalStore(subscribe, getSnapshot, () => DEFAULT_DISPLAY_PREFERENCES);

  useEffect(() => {
    const root = document.documentElement;
    root.style.fontSize = `${14 * preferences.fontScale / 100}px`;
    root.dataset.fontScale = String(preferences.fontScale);
    root.dataset.reducedMotion = String(preferences.reduceMotion);
  }, [preferences]);

  return (
    <PreferencesContext.Provider value={{ preferences, updatePreferences }}>
      <MotionConfig reducedMotion={preferences.reduceMotion ? "always" : "user"}>
        {children}
      </MotionConfig>
    </PreferencesContext.Provider>
  );
}

export const useDisplayPreferences = () => useContext(PreferencesContext);

"use client";

import { useEffect, useState } from "react";
import { getEmployeeToday, millisecondsToNextEmployeeDay } from "./age";

// Subscribe at page/drawer level, never once per employee card.
export function useEmployeeToday(enabled = true) {
  const [today, setToday] = useState("");

  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setTimeout>;
    const refresh = () => {
      const now = new Date();
      setToday(getEmployeeToday(now));
      clearTimeout(timer);
      timer = setTimeout(refresh, millisecondsToNextEmployeeDay(now));
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    timer = setTimeout(refresh, 0);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled]);

  return today;
}

"use client";

import { useSyncExternalStore } from "react";

const timeZone = "Asia/Bangkok";
const calendarDate = new Intl.DateTimeFormat("en-US", {
  timeZone, calendar: "gregory", year: "numeric", month: "2-digit", day: "2-digit",
});
const thaiDate = new Intl.DateTimeFormat("th-TH", {
  timeZone, calendar: "buddhist", numberingSystem: "latn", day: "numeric", month: "long", year: "numeric",
});
const thaiMonthYear = new Intl.DateTimeFormat("th-TH", {
  timeZone, calendar: "buddhist", numberingSystem: "latn", month: "long", year: "numeric",
});

function getDateSnapshot() {
  const parts = calendarDate.formatToParts(new Date());
  const value = (type: "year" | "month" | "day") => parts.find((part) => part.type === type)!.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function subscribeToDate(onChange: () => void) {
  const interval = window.setInterval(onChange, 60_000);
  const onVisible = () => { if (document.visibilityState === "visible") onChange(); };
  document.addEventListener("visibilitychange", onVisible);
  window.addEventListener("focus", onChange);
  return () => {
    window.clearInterval(interval);
    document.removeEventListener("visibilitychange", onVisible);
    window.removeEventListener("focus", onChange);
  };
}

// An empty server snapshot prevents a build-time date or hydration mismatch.
const getServerSnapshot = () => "";

export function DashboardDate({ className }: { className?: string }) {
  const date = useSyncExternalStore(subscribeToDate, getDateSnapshot, getServerSnapshot);
  const day = date ? new Date(`${date}T12:00:00+07:00`) : null;

  return (
    <time className={className} dateTime={date || undefined} aria-label={day ? thaiDate.format(day) : "วันที่ปัจจุบัน"}>
      <span>{date ? date.slice(-2) : "\u00a0"}</span>
      <i aria-hidden="true" />
      <span>{day ? thaiMonthYear.format(day) : "\u00a0"}</span>
    </time>
  );
}

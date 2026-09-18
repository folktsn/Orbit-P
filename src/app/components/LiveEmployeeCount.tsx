"use client";

import { useEffect, useState } from "react";
import { parseHeadcountSnapshot, type HeadcountSnapshot } from "@/lib/employee-headcount";
import { STATION_LOCATIONS } from "./station-map-data";
import { CountUp } from "./CountUp";
import styles from "../dashboard.module.css";

type CountState = { snapshot: HeadcountSnapshot | null; status: "loading" | "live" | "auto" | "error" | "restricted" };
const initialState: CountState = { snapshot: null, status: "loading" };

export function LiveEmployeeCount({ allowed, reducedMotion = false, station = null }: { allowed: boolean; reducedMotion?: boolean; station?: string | null }) {
  const [result, setResult] = useState<CountState>(initialState);

  useEffect(() => {
    if (!allowed) return;
    let stream: EventSource | null = null;
    let request: AbortController | null = null;
    let stopped = false;
    let blocked = false;
    let lastEvent = Date.now();

    const accept = (snapshot: HeadcountSnapshot, status: "live" | "auto") => {
      if (stopped) return;
      setResult((previous) => previous.snapshot && previous.snapshot.updatedAt > snapshot.updatedAt ? previous : { snapshot, status });
    };
    const fallback = async () => {
      if (stopped || blocked || request || document.visibilityState !== "visible") return;
      const current = new AbortController();
      request = current;
      const started = Date.now();
      const timeout = window.setTimeout(() => current.abort(), 25_000);
      try {
        const response = await fetch("/api/dashboard/headcount", { cache: "no-store", signal: current.signal });
        if (stopped || current !== request) return;
        if (response.status === 401 || response.status === 403) {
          blocked = true;
          stream?.close();
          setResult({ snapshot: null, status: "restricted" });
          return;
        }
        if (!response.ok) throw new Error("Headcount unavailable");
        const snapshot = parseHeadcountSnapshot(await response.json());
        if (!current.signal.aborted && current === request) accept(snapshot, "auto");
      } catch {
        if (!stopped && current === request && lastEvent <= started) setResult((previous) => ({ ...previous, status: "error" }));
      } finally {
        window.clearTimeout(timeout);
        if (request === current) request = null;
      }
    };
    const disconnect = () => {
      stream?.close();
      stream = null;
      request?.abort();
      request = null;
    };
    const connect = () => {
      disconnect();
      if (stopped || blocked || document.visibilityState !== "visible") return;
      lastEvent = Date.now();
      if (typeof EventSource === "undefined") { void fallback(); return; }
      const connection = new EventSource("/api/dashboard/headcount?stream=1");
      stream = connection;
      connection.addEventListener("headcount", (event) => {
        if (connection !== stream || stopped) return;
        try {
          accept(parseHeadcountSnapshot(JSON.parse(event.data)), "live");
          lastEvent = Date.now();
        } catch { void fallback(); }
      });
      connection.addEventListener("unavailable", () => {
        if (connection === stream && !stopped) setResult((previous) => ({ ...previous, status: "error" }));
      });
      connection.addEventListener("reconnect", () => { if (connection === stream) connect(); });
      connection.onerror = () => {
        if (connection !== stream || stopped) return;
        setResult((previous) => ({ ...previous, status: "error" }));
        void fallback();
      };
    };
    connect();
    // Fallback for offline connections or proxies that buffer event streams.
    const interval = window.setInterval(() => {
      if (!stream || stream.readyState !== EventSource.OPEN || Date.now() - lastEvent > 30_000) void fallback();
    }, 15_000);
    window.addEventListener("focus", connect);
    window.addEventListener("online", connect);
    document.addEventListener("visibilitychange", connect);
    return () => {
      stopped = true;
      disconnect();
      window.clearInterval(interval);
      window.removeEventListener("focus", connect);
      window.removeEventListener("online", connect);
      document.removeEventListener("visibilitychange", connect);
    };
  }, [allowed]);

  const snapshot = allowed ? result.snapshot : null;
  const count = snapshot ? (station ? snapshot.byStation[station] : snapshot.count) : undefined;
  const location = STATION_LOCATIONS.find((item) => item.codes.includes(station ?? ""));
  const caption = station ? `${station} · ${location?.name ?? "Station"}` : "Total employees";
  const status = allowed ? result.status : "restricted";
  const statusText = { loading: "Loading…", live: "Live", auto: "Auto update", error: "Reconnecting…", restricted: "No access" }[status];
  const updated = snapshot ? new Date(snapshot.updatedAt).toLocaleTimeString("en-GB", { timeZone: "Asia/Bangkok" }) : null;

  return (
    <span id="employee-headcount" className={styles.liveHeadcount} data-station={station ?? "all"} data-status={status} data-updated-at={snapshot?.updatedAt} title={updated ? `Last updated ${updated} (Thailand time)` : undefined}>
      <span className={styles.headcountNumber}>
        {count !== undefined ? <CountUp value={count} reducedMotion={reducedMotion} /> : <span aria-hidden="true">—</span>}
        <span className={styles.headcountAccessible} aria-live="polite" aria-atomic="true">{count !== undefined ? `${count.toLocaleString("en-US")} ${station ? `employees at ${caption}` : "total employees"}` : "Employee count unavailable"}</span>
      </span>
      <span className={styles.headcountCaption}>{caption}<span className={styles.headcountStatus}><i aria-hidden="true" />{statusText}</span></span>
    </span>
  );
}

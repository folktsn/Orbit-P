"use client";

import { useState, type CSSProperties } from "react";
import Image from "next/image";
import { Building2, MapPin } from "lucide-react";
import { MAP_VIEWBOX, STATION_COUNT, STATION_LOCATIONS, projectStation } from "./station-map-data";
import styles from "./ThailandStationMap.module.css";

const points = STATION_LOCATIONS.map((location) => ({ ...location, point: projectStation(location.latitude, location.longitude) }));
const position = (x: number, y: number): CSSProperties => ({ left: `${(x - MAP_VIEWBOX.x) / MAP_VIEWBOX.width * 100}%`, top: `${y / MAP_VIEWBOX.height * 100}%` });

export function ThailandStationMap({ paused }: { paused: boolean }) {
  const [selectedId, setSelectedId] = useState("HDQ");
  const selected = points.find((location) => location.id === selectedId)!;
  const Icon = selected.headquarters ? Building2 : MapPin;

  return (
    <div className={styles.map} role="group" aria-label={`แผนที่สถานีปฏิบัติงาน ${STATION_COUNT} Station`}>
      <div className={styles.canvas} style={{ animationPlayState: paused ? "paused" : "running" }}>
        <Image className={styles.land} src="/dashboard/thailand.svg?v=3" alt="แผนที่ประเทศไทยพร้อมสถานีปฏิบัติงานของบริษัท" width={340} height={570} sizes="(max-width: 760px) 100vw, 64vw" loading="eager" fetchPriority="high" unoptimized />
        <svg className={styles.markers} viewBox="230 0 340 570" aria-hidden="true">
          {points.map(({ id, headquarters, point, label }) => (
            <g key={id} className={`${styles.marker} ${selectedId === id ? styles.selectedMarker : ""}`}>
              <path className={styles.leader} d={`M${point.x} ${point.y} L${label[0]} ${label[1]}`} />
              {selectedId === id && <circle className={styles.halo} cx={point.x} cy={point.y} r="8" />}
              {headquarters
                ? <rect className={styles.dot} x={point.x - 2.5} y={point.y - 2.5} width="5" height="5" rx=".6" />
                : <circle className={styles.dot} cx={point.x} cy={point.y} r="2.7" />}
            </g>
          ))}
        </svg>
        {points.map(({ id, codes, name, province, headquarters, point, label }) => {
          const accessibleName = `${codes.join(" / ")} · ${name} · ${province}`;
          return (
            <div key={id}>
              <button type="button" className={styles.pinTarget} style={position(point.x, point.y)} tabIndex={-1} aria-label={`หมุด ${accessibleName}`} onClick={() => setSelectedId(id)} />
              <button type="button" className={styles.label} style={position(label[0], label[1])} aria-label={accessibleName} aria-pressed={selectedId === id} aria-controls="station-map-detail" title={accessibleName} onClick={() => setSelectedId(id)}>
                <span>{headquarters && <Building2 size={11} aria-hidden="true" />}{codes.join(" / ")}</span>
              </button>
            </div>
          );
        })}
      </div>
      <div className={styles.detail} id="station-map-detail" aria-live="polite" aria-atomic="true">
        <Icon size={15} strokeWidth={1.5} aria-hidden="true" />
        <div><strong>{selected.codes.join(" / ")} <span>· {selected.name}</span></strong><p>{selected.province}{selected.headquarters ? " · ตำแหน่งโดยประมาณ" : selected.codes.length > 1 ? " · 2 Station ในสนามบินเดียวกัน" : " · สนามบินที่มีพนักงานปฏิบัติงาน"}</p></div>
      </div>
      <p className={styles.hint}>{STATION_COUNT} STATIONS <i /> แตะรหัสเพื่อดูสถานี</p>
    </div>
  );
}

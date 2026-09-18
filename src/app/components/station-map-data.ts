export type StationLocation = {
  id: string;
  codes: readonly string[];
  name: string;
  province: string;
  latitude: number;
  longitude: number;
  label: readonly [number, number];
  labelSide: "left" | "right";
  headquarters?: boolean;
};

// Company coverage is the user's supplied roster, not a live employee count.
// Airport coordinates: CAAT AIP AD 2.2, AIRAC 2026-09-03. See ARTWORK.md.
// HDQ is an approximate location in Ban Mai, Pak Kret, Nonthaburi.
export const STATION_LOCATIONS: readonly StationLocation[] = [
  { id: "HDQ", codes: ["HDQ"], name: "สำนักงานใหญ่", province: "นนทบุรี", latitude: 13.908333, longitude: 100.55, label: [280, 246], labelSide: "left", headquarters: true },
  { id: "BKK", codes: ["BKKPA", "BKK"], name: "สุวรรณภูมิ", province: "สมุทรปราการ", latitude: 13.685833, longitude: 100.748889, label: [455, 278], labelSide: "right" },
  { id: "DMK", codes: ["DMK"], name: "ดอนเมือง", province: "กรุงเทพมหานคร", latitude: 13.914372, longitude: 100.605692, label: [455, 220], labelSide: "right" },
  { id: "CEI", codes: ["CEI"], name: "เชียงราย", province: "เชียงราย", latitude: 19.952222, longitude: 99.883056, label: [408, 48], labelSide: "right" },
  { id: "CNX", codes: ["CNX"], name: "เชียงใหม่", province: "เชียงใหม่", latitude: 18.771389, longitude: 98.962778, label: [280, 96], labelSide: "left" },
  { id: "UTH", codes: ["UTH"], name: "อุดรธานี", province: "อุดรธานี", latitude: 17.386389, longitude: 102.788333, label: [528, 112], labelSide: "right" },
  { id: "UBP", codes: ["UBP"], name: "อุบลราชธานี", province: "อุบลราชธานี", latitude: 15.251272, longitude: 104.870244, label: [528, 228], labelSide: "right" },
  { id: "KKC", codes: ["KKC"], name: "ขอนแก่น", province: "ขอนแก่น", latitude: 16.466667, longitude: 102.783611, label: [528, 170], labelSide: "right" },
  { id: "UTP", codes: ["UTP"], name: "อู่ตะเภา", province: "ระยอง", latitude: 12.679722, longitude: 101.005, label: [455, 336], labelSide: "right" },
  { id: "HKT", codes: ["HKT"], name: "ภูเก็ต", province: "ภูเก็ต", latitude: 8.1125, longitude: 98.309167, label: [280, 452], labelSide: "left" },
  { id: "URT", codes: ["URT"], name: "สุราษฎร์ธานี", province: "สุราษฎร์ธานี", latitude: 9.136111, longitude: 99.139167, label: [280, 394], labelSide: "left" },
  { id: "CJM", codes: ["CJM"], name: "ชุมพร", province: "ชุมพร", latitude: 10.711111, longitude: 99.361667, label: [280, 336], labelSide: "left" },
  { id: "HDY", codes: ["HDY"], name: "หาดใหญ่", province: "สงขลา", latitude: 6.932778, longitude: 100.395, label: [407, 515], labelSide: "right" },
  { id: "KBV", codes: ["KBV"], name: "กระบี่", province: "กระบี่", latitude: 8.095833, longitude: 98.988889, label: [407, 457], labelSide: "right" },
  { id: "NST", codes: ["NST"], name: "นครศรีธรรมราช", province: "นครศรีธรรมราช", latitude: 8.539617, longitude: 99.944725, label: [407, 399], labelSide: "right" },
];

export const STATION_CODES = STATION_LOCATIONS.flatMap((location) => location.codes);
export const STATION_COUNT = STATION_CODES.length;
export const MAP_VIEWBOX = { x: 230, y: 0, width: 340, height: 570 } as const;

// Same Mercator transform used to draw public/dashboard/thailand.svg.
// Keeping pins in the artwork's coordinate system preserves alignment at every size.
export function projectStation(latitude: number, longitude: number) {
  const scale = 1806.3258054171747;
  return {
    x: -2800.158299060579 + longitude * Math.PI / 180 * scale,
    y: 689.9939789326535 - Math.log(Math.tan(Math.PI / 4 + latitude * Math.PI / 360)) * scale,
  };
}

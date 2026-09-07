export type DepartureRecord = {
  id?: string;
  status?: string;
  resignDate?: string;
  lastWorkingDate?: string;
  resignStatus?: string;
  separationType?: string;
  separationDate?: string;
  lastWorkDate?: string;
};

function text(value: unknown) {
  const result = String(value ?? "").normalize("NFKC").trim();
  return ["", "-", "null", "undefined"].includes(result.toLowerCase()) ? "" : result;
}

export function getDepartureDate(record: DepartureRecord) {
  return [record.resignDate, record.lastWorkingDate, record.separationDate, record.lastWorkDate]
    .map(text)
    .find(Boolean) || "";
}

export function isDepartureRecord(record: DepartureRecord) {
  const status = text(record.status).toLowerCase();
  if (status.includes("resign") || status === "failed probation") return true;

  return Boolean(
    getDepartureDate(record)
    || text(record.resignStatus)
    || text(record.separationType),
  );
}

export function parseEmployeeDate(value: unknown): Date | null {
  const raw = text(value);
  if (!raw) return null;

  const createDate = (yearValue: number, month: number, day: number) => {
    const year = yearValue > 2400 ? yearValue - 543 : yearValue;
    const date = new Date(year, month - 1, day);
    if (
      date.getFullYear() !== year
      || date.getMonth() !== month - 1
      || date.getDate() !== day
    ) {
      return null;
    }
    date.setHours(0, 0, 0, 0);
    return date;
  };

  const yearFirst = raw.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (yearFirst) {
    return createDate(Number(yearFirst[1]), Number(yearFirst[2]), Number(yearFirst[3]));
  }

  const dayFirst = raw.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (dayFirst) {
    return createDate(Number(dayFirst[3]), Number(dayFirst[2]), Number(dayFirst[1]));
  }

  return null;
}

export function compareDepartureRecords(
  first: DepartureRecord,
  second: DepartureRecord,
  referenceDate = new Date(),
) {
  const today = new Date(referenceDate);
  today.setHours(0, 0, 0, 0);

  const rank = (record: DepartureRecord) => {
    const date = parseEmployeeDate(getDepartureDate(record));
    if (!date) return { group: 2, distance: 0 };
    const days = Math.round((date.getTime() - today.getTime()) / 86_400_000);
    return days >= 0
      ? { group: 0, distance: days }
      : { group: 1, distance: Math.abs(days) };
  };

  const a = rank(first);
  const b = rank(second);
  return a.group - b.group
    || a.distance - b.distance
    || text(first.id).localeCompare(text(second.id), "en", { numeric: true });
}

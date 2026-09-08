import { parseEmployeeDate } from "./resignation";

const thaiDateFormatter = new Intl.DateTimeFormat("en", {
  timeZone: "Asia/Bangkok", calendar: "gregory", numberingSystem: "latn",
  year: "numeric", month: "2-digit", day: "2-digit",
});

export function getEmployeeToday(now = new Date()): string {
  const parts = thaiDateFormatter.formatToParts(now);
  const value = (type: string) => parts.find((part) => part.type === type)?.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export function millisecondsToNextEmployeeDay(now = new Date()): number {
  const midnight = Date.parse(`${getEmployeeToday(now)}T00:00:00+07:00`);
  return midnight + 86_400_000 - now.getTime();
}

export function getEmployeeAge(birthDate: unknown, today: string): number | null {
  const birth = parseEmployeeDate(birthDate);
  const current = parseEmployeeDate(today);
  if (!birth || !current || birth > current) return null;

  const birthdayPassed = current.getMonth() > birth.getMonth()
    || (current.getMonth() === birth.getMonth() && current.getDate() >= birth.getDate());
  // A February 29 birthday advances on March 1 in non-leap years.
  return current.getFullYear() - birth.getFullYear() - (birthdayPassed ? 0 : 1);
}
